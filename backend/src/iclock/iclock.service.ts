import { DeviceState } from '../tenancy/device-state.js';
import { Injectable, Logger } from '@nestjs/common';
import { DeviceUserService } from '../biometric/device-user.service';
import { AttendanceLogService } from '../attendance/attendance-log.service';
import { ZKTecoService } from '../biometric/zkteco.service';

const DEVICE_TIME_ZONE_OFFSET_HOURS = 6; // Asia/Dhaka = UTC+6

interface AttlogRecord {
    pin: string;
    time: Date;
    status: number;
    verify: number;
}

interface UserInfoRecord {
    pin: string;
    name: string | null;
}

/**
 * `fp` is the legacy fingerprint-template table (F18-era firmware). `biodata` is its
 * replacement on push protocol 2.4+ (M2-LR and newer): the same "template saved" signal,
 * carrying any biometric type — 1=fingerprint, 9=face, 10=palm.
 */
type AdmsTableContext = 'attlog' | 'userinfo' | 'operlog' | 'fp' | 'biodata';

@Injectable()
@DeviceState()
export class IclockService {
    private readonly logger = new Logger(IclockService.name);
    private static readonly RECENT_PUSH_CONTEXT_TTL_MS = 2 * 60 * 1000;
    private readonly recentTableContextBySerial = new Map<string, { table: AdmsTableContext; seenAt: number }>();
    private readonly recentRegistrationPinBySerial = new Map<string, { pin: string; seenAt: number }>();
    private readonly pendingFpCompletionBySerial = new Map<string, number>();

    constructor(
        private readonly deviceUserService: DeviceUserService,
        private readonly attendanceLogService: AttendanceLogService,
        private readonly zkTecoService: ZKTecoService,
    ) { }

    /**
     * Called on every GET /iclock/cdata heartbeat from the device.
     * Records cloud contact for connectivity status tracking.
     */
    recordHeartbeat(sn: string): void {
        this.zkTecoService.recordCloudContact(sn);
    }

    /**
     * Called on every POST /iclock/cdata data push from the device.
     * Parses the ADMS protocol body and processes attendance and user data.
     */
    async processPush(sn: string, rawBody: string, tableParam?: string): Promise<void> {
        this.zkTecoService.recordCloudContact(sn);

        if (!rawBody || !rawBody.trim()) return;

        const normalizedBody = this.normalizeAdmsBody(rawBody);
        const tableContext = this.resolveTableContext(sn, normalizedBody, tableParam);

        // Photo/config tables carry PIN= and Size= fields that look exactly like a template
        // row to the body heuristics — never read biometric completion out of them.
        const carriesNoTemplate = this.isNonBiometricTable(tableParam);

        const rawAttlogs = this.parseAttlogs(normalizedBody);
        const rawUserInfos = this.parseUserInfos(normalizedBody, tableContext);
        const rawOperlogPins = this.parseOperlogPins(normalizedBody);
        // BIODATA rows mean the same thing as FP rows: a template was saved on the device.
        const rawFpPins = carriesNoTemplate
            ? new Set<string>()
            : new Set<string>([
                ...this.parseFpPins(normalizedBody, tableContext),
                ...this.parseBioDataPins(normalizedBody, tableContext),
            ]);

        // Drop anything whose PIN is not a valid numeric device UID. Devices send
        // INFO/OPTIONS blocks on reconnect (especially after an offline backlog)
        // that contain IP addresses and other config values; without this guard
        // those leak through as phantom, nameless device users (e.g. the server IP
        // "13.140.141.131" shown as a device UID).
        const droppedPins: string[] = [];
        const keepValidPin = (pin: string): boolean => {
            if (this.isValidDevicePin(pin)) return true;
            droppedPins.push(pin);
            return false;
        };

        const attlogs = rawAttlogs.filter((log) => keepValidPin(log.pin));
        const userInfos = rawUserInfos.filter((ui) => keepValidPin(ui.pin));
        const operlogPins = new Set([...rawOperlogPins].filter((pin) => keepValidPin(pin)));
        const fpPins = new Set([...rawFpPins].filter((pin) => keepValidPin(pin)));

        if (droppedPins.length > 0) {
            // Capture the raw body so the exact offline-batch format can be analysed.
            this.logger.warn(
                `Dropped ${droppedPins.length} invalid PIN(s) from SN=${sn}: ` +
                `[${droppedPins.slice(0, 10).join(', ')}] — raw: ` +
                normalizedBody.substring(0, 500).replace(/\r?\n/g, '\\n'),
            );
        }

        for (const ui of userInfos) {
            this.rememberRecentRegistrationPin(sn, ui.pin);
        }

        for (const pin of operlogPins) {
            this.rememberRecentRegistrationPin(sn, pin);
        }

        const recentPin = this.getRecentRegistrationPin(sn);
        const pinsFromCurrentPush = new Set<string>([
            ...userInfos.map((ui) => ui.pin),
            ...operlogPins,
        ]);

        if (fpPins.size === 0 && this.hasPendingFpCompletion(sn) && pinsFromCurrentPush.size > 0) {
            for (const pin of pinsFromCurrentPush) {
                fpPins.add(pin);
            }
            this.clearPendingFpCompletion(sn);
        }

        if (
            fpPins.size === 0 &&
            !carriesNoTemplate &&
            this.looksLikeFingerprintTemplateFragment(normalizedBody, tableContext, Boolean(recentPin))
        ) {
            if (recentPin) {
                fpPins.add(recentPin);
            } else {
                this.rememberPendingFpCompletion(sn);
            }
        }

        if (fpPins.size > 0) {
            this.clearPendingFpCompletion(sn);
        }

        // Upsert users with name data first (if available)
        for (const ui of userInfos) {
            await this.deviceUserService.upsertFromCloud(ui.pin, ui.name, {
                emitModal: false,
                markPending: true,
                deviceSerial: sn,
            });
        }

        // before any fingerprint template has actually been saved. Record the UID,
        // but do not open the frontend modal yet.
        for (const pin of operlogPins) {
            await this.deviceUserService.upsertFromCloud(pin, null, { emitModal: false, deviceSerial: sn });
            // Terminals that never push a template (M2-LR) leave OPERLOG as the only
            // enrollment signal — arm the grace-period completion for a pending enroll.
            this.deviceUserService.noteBiometricOperation(pin, sn);
        }

        // FP is the first reliable signal that a fingerprint template was actually saved.
        // Use it to open the frontend modal after registration is truly completed.
        for (const pin of fpPins) {
            await this.deviceUserService.upsertFromCloud(pin, null, { emitModal: true, deviceSerial: sn });
        }

        // Process attendance scans
        for (const log of attlogs) {
            // Ensure DeviceUser row exists before inserting AttendanceLog.
            // Do not open the registration modal from ATTLOG. Some devices emit
            // attendance-style rows during the enrollment flow before the template
            // save is complete, which causes the popup to appear too early.
            await this.deviceUserService.upsertFromCloud(log.pin, null, {
                emitModal: false,
                deviceSerial: sn,
            });
            await this.attendanceLogService.handleCloudLogEntry(
                log.pin,
                log.time,
                log.verify,
                log.status,
                sn,
            );
        }

        if (attlogs.length > 0 || operlogPins.size > 0 || userInfos.length > 0 || fpPins.size > 0) {
            const pinList = (pins: Set<string>) =>
                pins.size > 0 ? ` [${[...pins].join(',')}]` : '';
            this.logger.log(
                `Push SN=${sn}: ${attlogs.length} ATTLOG, ` +
                `${userInfos.length} USERINFO, ${operlogPins.size} OPERLOG pins${pinList(operlogPins)}, ` +
                `${fpPins.size} FP pins${pinList(fpPins)}`,
            );
        } else if (this.isKnownTableFragment(normalizedBody, tableContext, Boolean(recentPin))) {
            this.logger.debug(
                `Ignored ${tableContext ?? 'unknown'} table fragment from SN=${sn} — raw: ${normalizedBody.substring(0, 300).replace(/\r?\n/g, '\\n')}`,
            );
        } else {
            // warn, not debug: an unrecognised push is the one thing that silently breaks
            // enrollment on a new device model, and debug is off in production.
            this.logger.warn(
                `Unrecognised push from SN=${sn} table=${tableContext ?? 'unknown'} — raw: ${normalizedBody.substring(0, 300).replace(/\r?\n/g, '\\n')}`,
            );
        }
    }

    /**
     * A valid ZKTeco device user PIN is a positive integer. Anything containing
     * dots (IP addresses), letters, or other punctuation is config/INFO noise the
     * device emits — never a real user — and must not become a device user.
     */
    private isValidDevicePin(pin: string | null | undefined): boolean {
        if (!pin) return false;
        const trimmed = pin.trim();
        if (!/^\d{1,10}$/.test(trimmed)) return false;
        return trimmed !== '0';
    }

    private normalizeAdmsBody(body: string): string {
        const withoutBom = body.replace(/\uFEFF/g, '');

        return Array.from(withoutBom)
            .filter((char) => {
                const code = char.charCodeAt(0);
                const isControlChar =
                    (code >= 0x00 && code <= 0x08) ||
                    code === 0x0B ||
                    code === 0x0C ||
                    (code >= 0x0E && code <= 0x1F) ||
                    code === 0x7F;

                return !isControlChar;
            })
            .join('');
    }

    // ─── ATTLOG parser ────────────────────────────────────────────────────────

    private parseAttlogs(body: string): AttlogRecord[] {
        const results: AttlogRecord[] = [];
        const lines = body.split(/\r?\n/);

        let inAttlog = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Table declaration lines
            if (/^table\s*=/i.test(trimmed)) {
                inAttlog = /^table\s*=\s*attlog/i.test(trimmed);
                continue;
            }

            // Explicit ATTLOG-prefixed record (no table= header needed)
            if (/^attlog\t/i.test(trimmed)) {
                const fields = trimmed.split('\t').slice(1); // drop "ATTLOG" prefix
                const rec = this.parseAttlogFields(fields);
                if (rec) results.push(rec);
                continue;
            }

            // Key/value punch row (RTLOG on push 2.4+ firmware), e.g.:
            // time=2026-07-30 09:15:00\tpin=7\tevent=0\tinoutstatus=0\tverifytype=1
            const kvRec = this.parseKeyValueAttlogLine(trimmed);
            if (kvRec) {
                results.push(kvRec);
                continue;
            }

            // Some F18 ADMS firmwares push a single plain attendance row with
            // spaces and no table header, e.g.:
            // 1        2026-05-05 18:15:26     0       1       0 ...
            const looseRec = this.parseLooseAttlogLine(trimmed);
            if (looseRec) {
                results.push(looseRec);
                continue;
            }

            // Plain record under a table=ATTLOG block
            if (inAttlog) {
                const fields = trimmed.split('\t');
                // Must have at least Pin + Timestamp
                if (fields.length >= 2) {
                    const rec = this.parseAttlogFields(fields);
                    if (rec) results.push(rec);
                }
            }
        }

        return results;
    }

    /**
     * Fields: [Pin, YYYY-MM-DD HH:MM:SS, Status, Verify, WorkCode?, Reserved?...]
     */
    private parseAttlogFields(fields: string[]): AttlogRecord | null {
        const pin = fields[0]?.trim();
        const timeStr = fields[1]?.trim();
        const status = parseInt(fields[2] ?? '0', 10);
        const verify = parseInt(fields[3] ?? '1', 10);

        if (!pin || !timeStr) return null;

        const time = this.parseDeviceTimestamp(timeStr);
        if (!time) return null;

        return {
            pin,
            time,
            status: Number.isNaN(status) ? 0 : status,
            verify: Number.isNaN(verify) ? 1 : verify,
        };
    }

    /**
     * Some devices send ATTLOG rows without tabs or a table header.
     * Match the first four meaningful fields: pin, timestamp, status, verify.
     */
    private parseLooseAttlogLine(line: string): AttlogRecord | null {
        const match = line.match(
            /^(\S+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})(?:\s+(-?\d+))?(?:\s+(-?\d+))?(?:\s+.*)?$/,
        );

        if (!match) return null;

        return this.parseAttlogFields([
            match[1],
            match[2],
            match[3] ?? '0',
            match[4] ?? '1',
        ]);
    }

    /**
     * Punch rows written as key/value pairs — the RTLOG shape used by push 2.4+ firmware:
     *   time=2026-07-30 09:15:00\tpin=7\tevent=0\tinoutstatus=0\tverifytype=1\tindex=1
     * Both `pin` and `time` must be present, so USERINFO/BIODATA rows (PIN but no time)
     * can never be mistaken for attendance.
     */
    private parseKeyValueAttlogLine(line: string): AttlogRecord | null {
        if (!/(?:^|\s)time=/i.test(line) || !/(?:^|\s)pin=/i.test(line)) return null;

        const pin = this.extractKeyValue(line, 'pin');
        const timeStr = this.extractKeyValue(line, 'time');
        if (!pin || !timeStr) return null;

        const status =
            this.extractKeyValue(line, 'inoutstatus') ??
            this.extractKeyValue(line, 'status') ??
            this.extractKeyValue(line, 'event') ??
            '0';
        const verify =
            this.extractKeyValue(line, 'verifytype') ??
            this.extractKeyValue(line, 'verify') ??
            '1';

        return this.parseAttlogFields([pin, timeStr, status, verify]);
    }

    // ─── USERINFO parser ──────────────────────────────────────────────────────

    private parseUserInfos(body: string, tableContext: AdmsTableContext | null): UserInfoRecord[] {
        const results: UserInfoRecord[] = [];
        const lines = body.split(/\r?\n/);

        let inUserInfo = tableContext === 'userinfo';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (/^table\s*=/i.test(trimmed)) {
                inUserInfo = /^table\s*=\s*userinfo/i.test(trimmed);
                continue;
            }

            if (/^(?:userinfo\t|user\s+|userinfo\s+)/i.test(trimmed) || inUserInfo) {
                const clean = /^(?:userinfo\t|user\s+|userinfo\s+)/i.test(trimmed)
                    ? trimmed.replace(/^(?:userinfo\t|user\s+|userinfo\s+)/i, '')
                    : trimmed;
                const rec = this.parseUserInfoLine(clean) ?? this.parseUserInfoTableLine(clean);
                if (rec) results.push(rec);
            }
        }

        if (results.length === 0) {
            const fallback = this.parseUserInfoFromBody(body);
            if (fallback) results.push(fallback);
        }

        return results;
    }

    /**
     * Format: PIN=1\tName=John Doe\tGender=M\t...
     */
    private parseUserInfoLine(line: string): UserInfoRecord | null {
        const pin = this.extractKeyValue(line, 'PIN');
        const name = this.extractKeyValue(line, 'Name');

        if (!pin) return null;
        return { pin, name };
    }

    private parseUserInfoTableLine(line: string): UserInfoRecord | null {
        if (this.isSeparatorLine(line) || this.looksLikeUserInfoHeader(line)) return null;

        const fields = this.splitAdmsColumns(line);
        if (fields.length < 2) return null;

        const pin = fields[0]?.trim();
        const name = fields[1]?.trim() || null;

        if (!pin || /^pin$/i.test(pin)) return null;
        return { pin, name };
    }

    private looksLikeUserInfoTableRow(line: string): boolean {
        if (this.isSeparatorLine(line) || this.looksLikeUserInfoHeader(line)) return false;

        const fields = this.splitAdmsColumns(line);
        if (fields.length < 2) return false;

        const pin = fields[0]?.trim();
        const name = fields[1]?.trim();

        return Boolean(pin && /^\d+$/.test(pin) && name && /[A-Za-z]/.test(name));
    }

    // ─── OPERLOG parser ───────────────────────────────────────────────────────

    /**
     * Returns a Set of device user PIDs seen in OPERLOG (biometric enrollment).
     * Format: OPLOG\t{AdminPin}\t{OpType}\t{Date}\t{Time}\t{Pin}\t...
     */
    private parseOperlogPins(body: string): Set<string> {
        const pins = new Set<string>();
        const lines = body.split(/\r?\n/);

        let inOperlog = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (/^table\s*=/i.test(trimmed)) {
                inOperlog = /^table\s*=\s*operlog/i.test(trimmed);
                continue;
            }

            let fields: string[] | null = null;
            if (/^oplog\t/i.test(trimmed)) {
                fields = trimmed.split('\t');
            } else if (/^oplog\s+/i.test(trimmed)) {
                fields = trimmed.split(/\s+/);
            } else if (inOperlog) {
                fields = trimmed.split('\t');
            }

            // OPLOG fields: [OPLOG, AdminPin, OpType, Date, Time, Pin, ...]
            if (fields && fields.length >= 6) {
                const pin = fields[5]?.trim();
                if (pin && pin !== '0') pins.add(pin);
            }
        }

        if (pins.size === 0) {
            const fallbackPins = body.match(/OPLOG\s+\S+\s+\S+\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+(\S+)/gi) ?? [];
            for (const entry of fallbackPins) {
                const match = entry.match(/OPLOG\s+\S+\s+\S+\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+(\S+)/i);
                const pin = match?.[1]?.trim();
                if (pin && pin !== '0') pins.add(pin);
            }
        }

        return pins;
    }

    private parseFpPins(body: string, tableContext: AdmsTableContext | null): Set<string> {
        const pins = new Set<string>();
        const lines = body.split(/\r?\n/);
        let inFp = tableContext === 'fp';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (/^table\s*=\s*fp/i.test(trimmed)) {
                inFp = true;
                continue;
            }

            if (/^table\s*=/i.test(trimmed)) {
                inFp = false;
                continue;
            }

            if (/^fp\s+/i.test(trimmed)) {
                const pin = this.extractKeyValue(trimmed, 'PIN');
                if (pin) pins.add(pin);
                continue;
            }

            if (inFp) {
                const pin = this.parseFpTablePin(trimmed);
                if (pin) pins.add(pin);
            }
        }

        if (pins.size === 0) {
            const fallbackPins = body.match(/(?:^|\s)FP\s+PIN=(\S+)/gi) ?? [];
            for (const entry of fallbackPins) {
                const match = entry.match(/PIN=(\S+)/i);
                const pin = match?.[1]?.trim();
                if (pin) pins.add(pin);
            }
        }

        return pins;
    }

    // ─── BIODATA parser (push protocol 2.4+) ─────────────────────────────────

    /**
     * Rows look like:
     *   BIODATA Pin=4\tNo=0\tIndex=0\tValid=1\tDuress=0\tType=1\tMajorVer=…\tTmp=<base64>
     * and arrive either with that prefix or as bare rows under `table=BIODATA`
     * (which recent firmware sends in the query string, not the body).
     *
     * `Valid=0` marks a cleared template — that is a deletion, not an enrollment,
     * so it must never complete a pending registration.
     */
    private parseBioDataPins(body: string, tableContext: AdmsTableContext | null): Set<string> {
        const pins = new Set<string>();
        const lines = body.split(/\r?\n/);
        let inBioData = tableContext === 'biodata';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (/^table\s*=\s*biodata/i.test(trimmed)) {
                inBioData = true;
                continue;
            }

            if (/^table\s*=/i.test(trimmed)) {
                inBioData = false;
                continue;
            }

            const prefixed = /^biodata\b/i.test(trimmed);
            if (!prefixed && !inBioData) continue;

            const valid = this.extractKeyValue(trimmed, 'Valid');
            if (valid !== null && valid.trim() === '0') continue;

            const pin = this.extractKeyValue(trimmed, 'PIN');
            if (pin) pins.add(pin);
        }

        return pins;
    }

    private looksLikeBioDataRow(line: string): boolean {
        if (!/(?:^|\s)(?:Pin|PIN)=/i.test(line)) return false;
        return /^biodata\b/i.test(line.trim()) || /(?:^|\s)(?:Tmp|Template)=/i.test(line);
    }

    private parseFpTablePin(line: string): string | null {
        if (this.isSeparatorLine(line) || this.looksLikeFpHeader(line)) return null;

        const inlinePin = this.extractKeyValue(line, 'PIN');
        if (inlinePin && /(FID=|Size=|Valid=|TMP=)/i.test(line)) {
            return inlinePin;
        }

        const fields = this.splitAdmsColumns(line);
        if (fields.length < 3) return null;

        const pin = fields[0]?.trim();
        const fid = fields[1]?.trim();
        const size = fields[2]?.trim();

        if (!pin || /^pin$/i.test(pin)) return null;
        if (!fid || !/^-?\d+$/.test(fid)) return null;
        if (!size || !/^-?\d+$/.test(size)) return null;

        return pin;
    }

    private looksLikeFpTableRow(line: string): boolean {
        return this.parseFpTablePin(line) !== null;
    }

    private parseUserInfoFromBody(body: string): UserInfoRecord | null {
        if (!/PIN=|Name=/i.test(body)) return null;

        const pin = this.extractKeyValue(body, 'PIN');
        const name = this.extractKeyValue(body, 'Name');

        if (!pin || name === null) return null;
        return { pin, name };
    }

    private extractKeyValue(line: string, key: string): string | null {
        const pattern = new RegExp(`(?:^|\\s)${key}=([^\\r\\n]*?)(?=\\s+[A-Za-z]+[A-Za-z0-9]*=|$)`, 'i');
        const match = line.match(pattern);
        const value = match?.[1]?.trim();
        return value ? value : null;
    }

    private splitAdmsColumns(line: string): string[] {
        const tabSeparated = line.split('\t').map((part) => part.trim()).filter(Boolean);
        if (tabSeparated.length >= 2) return tabSeparated;

        return line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
    }

    private isSeparatorLine(line: string): boolean {
        const compact = line.replace(/\s+/g, '');
        return compact.length > 0 && /^-+$/.test(compact);
    }

    private looksLikeUserInfoHeader(line: string): boolean {
        return /(\bPIN\b.*\bName\b)|(\bName\b.*\bPasswd\b)|(\bVerify\b.*\bStartDatetime\b)|(\bame\b.*\basswd\b)|(\berify-?\b.*\btartatetime\b.*\bndatetime\b)/i.test(line);
    }

    private looksLikeFpHeader(line: string): boolean {
        return /(\bPIN\b.*\bFID\b.*\bSize\b)|(\bFID\b.*\bSize\b.*\bValid\b)|(\bSize\b.*\bValid\b)|(\bize\b.*\balid\b)/i.test(line);
    }

    private detectExplicitTableContext(body: string): AdmsTableContext | null {
        const match = body.match(/^table\s*=\s*(attlog|userinfo|operlog|biodata|fp)\b/im);
        return this.normalizeTableName(match?.[1]);
    }

    /** Tables that never carry a biometric template, however template-shaped their rows look. */
    private isNonBiometricTable(value: string | null | undefined): boolean {
        const table = value?.trim().toLowerCase();
        if (!table) return false;
        return ['biophoto', 'attphoto', 'options', 'errorlog'].includes(table);
    }

    /**
     * Maps a `table=` value — from the query string or the body — onto a parser context.
     * Unknown tables (options, ATTPHOTO, BIOPHOTO, …) return null so they fall through to
     * the body heuristics instead of being mistaken for biometric data. BIOPHOTO in
     * particular is the enrollment *photo*, never a template, and must not complete a
     * pending registration.
     */
    private normalizeTableName(value: string | null | undefined): AdmsTableContext | null {
        const table = value?.trim().toLowerCase();
        if (!table) return null;

        switch (table) {
            case 'attlog':
                return 'attlog';
            case 'userinfo':
            case 'user':
                return 'userinfo';
            case 'operlog':
            case 'oplog':
                return 'operlog';
            case 'biodata':
                return 'biodata';
            case 'fp':
            case 'fingertmp':
            case 'templatev10':
                return 'fp';
            default:
                return null;
        }
    }

    private inferTableContextFromBody(body: string): AdmsTableContext | null {
        const compact = body.trim();
        if (!compact) return null;

        if (/^attlog\b/i.test(compact) || this.parseLooseAttlogLine(compact)) return 'attlog';
        if (/^oplog\b/i.test(compact)) return 'operlog';
        if (/^(?:userinfo|user)\b/i.test(compact)) return 'userinfo';
        if (/^fp\b/i.test(compact)) return 'fp';
        if (/^biodata\b/i.test(compact) || this.looksLikeBioDataRow(compact)) return 'biodata';
        if (this.looksLikeUserInfoHeader(compact) || this.looksLikeUserInfoTableRow(compact)) return 'userinfo';
        if (this.looksLikeFpHeader(compact) || this.looksLikeFpTableRow(compact)) return 'fp';

        const looksLikeFpBlob =
            /[A-Za-z0-9+/]{80,}/.test(compact) ||
            /(?:^|\s)(?:ize|size)\s+(?:alid|valid)\b/i.test(compact);
        if (looksLikeFpBlob) return 'fp';

        return null;
    }

    private resolveTableContext(
        sn: string,
        body: string,
        tableParam?: string,
    ): AdmsTableContext | null {
        // The query-string table is authoritative — recent firmware sends nothing else.
        const fromQuery = this.normalizeTableName(tableParam);
        if (fromQuery) {
            this.recentTableContextBySerial.set(sn, { table: fromQuery, seenAt: Date.now() });
            return fromQuery;
        }

        const explicit = this.detectExplicitTableContext(body);
        if (explicit) {
            this.recentTableContextBySerial.set(sn, { table: explicit, seenAt: Date.now() });
            return explicit;
        }

        const inferred = this.inferTableContextFromBody(body);
        if (inferred) {
            this.recentTableContextBySerial.set(sn, { table: inferred, seenAt: Date.now() });
            return inferred;
        }

        const recent = this.recentTableContextBySerial.get(sn);
        if (!recent) return null;
        if (Date.now() - recent.seenAt > IclockService.RECENT_PUSH_CONTEXT_TTL_MS) {
            this.recentTableContextBySerial.delete(sn);
            return null;
        }

        return recent.table;
    }

    private rememberRecentRegistrationPin(sn: string, pin: string): void {
        this.recentRegistrationPinBySerial.set(sn, { pin, seenAt: Date.now() });
    }

    private rememberPendingFpCompletion(sn: string): void {
        this.pendingFpCompletionBySerial.set(sn, Date.now());
    }

    private getRecentRegistrationPin(sn: string): string | null {
        const recent = this.recentRegistrationPinBySerial.get(sn);
        if (!recent) return null;
        if (Date.now() - recent.seenAt > IclockService.RECENT_PUSH_CONTEXT_TTL_MS) {
            this.recentRegistrationPinBySerial.delete(sn);
            return null;
        }

        return recent.pin;
    }

    private hasPendingFpCompletion(sn: string): boolean {
        const seenAt = this.pendingFpCompletionBySerial.get(sn);
        if (!seenAt) return false;
        if (Date.now() - seenAt > IclockService.RECENT_PUSH_CONTEXT_TTL_MS) {
            this.pendingFpCompletionBySerial.delete(sn);
            return false;
        }

        return true;
    }

    private clearPendingFpCompletion(sn: string): void {
        this.pendingFpCompletionBySerial.delete(sn);
    }

    private looksLikeFingerprintTemplateFragment(
        body: string,
        tableContext: AdmsTableContext | null,
        hasRecentRegistrationPin: boolean,
    ): boolean {
        const isTemplateTable = tableContext === 'fp' || tableContext === 'biodata';
        if (!isTemplateTable && !hasRecentRegistrationPin) return false;

        const compact = body.trim();
        if (!compact || this.isSeparatorLine(compact)) return false;

        const hasTemplatePayload =
            /[A-Za-z0-9+/]{80,}/.test(compact) ||
            /(?:^|\s)(?:ize|size)\s+(?:alid|valid)\b/i.test(compact) ||
            compact.length > 120;

        if (this.looksLikeFpHeader(compact) && !hasTemplatePayload) return false;

        return hasTemplatePayload;
    }

    private isKnownTableFragment(
        body: string,
        tableContext: AdmsTableContext | null,
        hasRecentRegistrationPin: boolean,
    ): boolean {
        const compact = body.trim();
        if (!compact) return true;
        if (this.detectExplicitTableContext(body)) return true;
        if (this.isSeparatorLine(compact)) return true;
        if (this.looksLikeUserInfoHeader(compact)) return true;
        if (this.looksLikeFpHeader(compact)) return true;
        if (this.looksLikeBioDataRow(compact)) return true;
        if (this.looksLikeFingerprintTemplateFragment(body, tableContext, hasRecentRegistrationPin)) return true;

        return false;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Parse "YYYY-MM-DD HH:MM:SS" as Asia/Dhaka local time and return a UTC Date.
     * The device clock is set to Asia/Dhaka (UTC+6), so we subtract the offset.
     */
    private parseDeviceTimestamp(ts: string): Date | null {
        const match = ts.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})$/);
        if (!match) return null;

        const [, year, month, day, hour, min, sec] = match.map(Number);

        // Build as if it's UTC, then shift by the local offset to convert to true UTC
        const pseudoUtcMs = Date.UTC(year, month - 1, day, hour, min, sec);
        const utcMs = pseudoUtcMs - DEVICE_TIME_ZONE_OFFSET_HOURS * 60 * 60 * 1000;

        const d = new Date(utcMs);
        return Number.isNaN(d.getTime()) ? null : d;
    }
}
