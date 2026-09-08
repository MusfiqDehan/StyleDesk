import { Optional } from '@nestjs/common';
import { TenantCron, TenantJobs } from '../tenancy/tenant-jobs.js';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { AttendanceLog } from './entities/attendance-log.entity';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { Employee } from '../employee/entities/employee.entity';
import { DeviceUser } from '../biometric/entities/device-user.entity';
import { ZKTecoService } from '../biometric/zkteco.service';
import { BiometricGateway } from '../biometric/biometric.gateway';

const BUSINESS_TIME_ZONE = 'Asia/Dhaka';
const BUSINESS_TIME_OFFSET_HOURS = 6;

// ─── Business rule thresholds ──────────────────────────────────────────────
const FULL_DAY_MIN_MINS = 7.5 * 60; // 450 min
const HALF_DAY_MIN_MINS = 4 * 60;   // 240 min

@Injectable()
export class AttendanceLogService implements OnModuleInit {
  private readonly logger = new Logger(AttendanceLogService.name);

  constructor(
    @InjectRepository(AttendanceLog)
    private readonly logRepo: Repository<AttendanceLog>,

    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,

    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,

    @InjectRepository(DeviceUser)
    private readonly deviceUserRepo: Repository<DeviceUser>,

    private readonly zkTecoService: ZKTecoService,
    private readonly biometricGateway: BiometricGateway,
    @Optional() private readonly tenantJobs?: TenantJobs,
  ) { }

  onModuleInit(): void {
    // Device work runs with a registered tenant/device scope.
  }

  // ─── Cloud push entry point ────────────────────────────────────────────────

  /**
   * Called by IclockService for each ATTLOG record received via the ADMS cloud push.
   * Deduplicates by (deviceUserId, scannedAt), saves the log, processes it into the
   * Attendance table, and emits a WebSocket event so the frontend refreshes in real time.
   */
  async handleCloudLogEntry(
    deviceUserId: string,
    scannedAt: Date,
    verifyMethod: number,
    inOutStatus: number,
    deviceSerial: string | null = null,
  ): Promise<void> {
    // Deterministic dedup: ignore if we already recorded this exact scan
    const exists = await this.logRepo.findOne({ where: { deviceUserId, scannedAt } });
    if (exists) return;

    const log = await this.logRepo.save(
      this.logRepo.create({ deviceUserId, scannedAt, verifyMethod, inOutStatus, deviceSerial }),
    );

    await this.processLogs([log], true);

    this.biometricGateway.emitAttendanceUpdated({
      refreshedAt: new Date().toISOString(),
      attendanceDates: [this.toDateString(log.scannedAt)],
      deviceUserIds: [log.deviceUserId],
    });
  }

  // ─── Polling ───────────────────────────────────────────────────────────────

  @TenantCron('*/30 * * * * *')
  async syncFromDevice(): Promise<void> {
    await this.zkTecoService.connect();
    if (!this.zkTecoService.isConnected()) return;

    try {
      const result = await this.zkTecoService.getAttendances();
      if (!result.length) return;

      const newLogs: AttendanceLog[] = [];
      const seenKeys = new Set<string>();

      for (const scan of result) {
        const scannedAt = this.resolveScannedAt(scan);
        if (!scannedAt) {
          this.logger.warn('Skipping attendance scan with invalid timestamp');
          continue;
        }

        const deviceUserId = this.resolveDeviceUserId(scan);
        if (!deviceUserId) {
          this.logger.warn('Skipping attendance scan with missing device user ID');
          continue;
        }

        const uniqueKey = `${deviceUserId}__${scannedAt.getTime()}`;
        if (seenKeys.has(uniqueKey)) continue;
        seenKeys.add(uniqueKey);

        const exists = await this.logRepo.findOne({
          where: { deviceUserId, scannedAt },
        });
        if (exists) continue;

        newLogs.push(
          this.logRepo.create({
            deviceUserId,
            scannedAt,
            verifyMethod: scan.verifyMethod ?? 0,
            inOutStatus: scan.inOutStatus ?? 0,
          }),
        );
      }

      if (newLogs.length > 0) {
        await this.logRepo.save(newLogs);
        this.logger.log(`Stored ${newLogs.length} new attendance log(s) from device`);
        await this.processLogs(newLogs, true);
        this.biometricGateway.emitAttendanceUpdated({
          refreshedAt: new Date().toISOString(),
          attendanceDates: [...new Set(newLogs.map((log) => this.toDateString(log.scannedAt)))],
          deviceUserIds: [...new Set(newLogs.map((log) => log.deviceUserId))],
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error syncing attendance logs: ${msg}`);
    }
  }

  // ─── Processing ────────────────────────────────────────────────────────────

  async processLogs(logs: AttendanceLog[], emitOnUnlinked = false): Promise<void> {
    // Group by (deviceUserId, date)
    const groups = new Map<string, AttendanceLog[]>();
    for (const log of logs) {
      const date = this.toDateString(log.scannedAt);
      const key = `${log.deviceUserId}__${date}`;
      const arr = groups.get(key) ?? [];
      arr.push(log);
      groups.set(key, arr);
    }

    for (const [key, rawLogs] of groups.entries()) {
      const [deviceUserId, date] = key.split('__');
      await this.processGroup(deviceUserId, date, rawLogs, emitOnUnlinked);
    }
  }

  private async processGroup(
    deviceUserId: string,
    date: string,
    rawLogs: AttendanceLog[],
    emitOnUnlinked = false,
  ): Promise<void> {
    const linked = await this.deviceUserRepo.findOne({ where: { deviceUid: deviceUserId } });
    const employee = linked?.linkedEmployeeId ? await this.employeeRepo.findOne({ where: { id: linked.linkedEmployeeId } }) : null;
    if (!employee) {
      this.logger.warn(`No employee for device UID ${deviceUserId} — skipping`);
      if (emitOnUnlinked) {
        const deviceUser = await this.deviceUserRepo.findOne({ where: { deviceUid: deviceUserId } });
        this.biometricGateway.emitUnlinkedFingerprintScanned({
          deviceUserId,
          name: deviceUser?.name ?? null,
          attendanceDate: date,
        });
      }
      return;
    }

    // Fetch only non-suppressed logs — suppressed logs belong to deleted attendance
    // records and must not influence the new entry→exit cycle.
    const { start: dayStart, end: dayEnd } = this.getBusinessDayBounds(date);
    const allDayLogs = await this.logRepo.find({
      where: { deviceUserId, scannedAt: Between(dayStart, dayEnd), suppressed: false },
      order: { scannedAt: 'ASC' },
    });

    const validScans = this.deduplicateScans(allDayLogs);
    if (validScans.length === 0) return;

    // Most recent known serial for this user/day — identifies the physical device.
    const deviceSerial =
      [...allDayLogs].reverse().find((l) => l.deviceSerial)?.deviceSerial ?? null;

    const entryTime = validScans[0].scannedAt;
    const exitTime = validScans.length > 1 ? validScans[validScans.length - 1].scannedAt : null;
    const workingMinutes = exitTime
      ? Math.round((exitTime.getTime() - entryTime.getTime()) / 60_000)
      : null;
    const status = exitTime
      ? this.calculateStatus(entryTime, exitTime, workingMinutes)
      : null;

    const existing = await this.attendanceRepo.findOne({
      where: { employeeId: employee.id, attendanceDate: date },
    });

    if (existing) {
      existing.checkInTime = entryTime;
      existing.checkOutTime = exitTime;
      existing.workingMinutes = workingMinutes;
      existing.status = status;
      if (deviceSerial) existing.deviceSerial = deviceSerial;
      await this.attendanceRepo.save(existing);
    } else {
      await this.attendanceRepo.save(
        this.attendanceRepo.create({
          employeeId: employee.id,
          employee,
          employeeName: employee.name,
          machineId: deviceUserId,
          deviceSerial,
          attendanceDate: date,
          checkInTime: entryTime,
          checkOutTime: exitTime,
          workingMinutes,
          status,
        }),
      );
    }
  }

  // ─── De-duplication ────────────────────────────────────────────────────────

  private deduplicateScans(sorted: AttendanceLog[]): AttendanceLog[] {
    const valid: AttendanceLog[] = [];
    const seen = new Set<string>();
    for (const log of sorted) {
      const key = `${log.deviceUserId}__${log.scannedAt.getTime()}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      if (valid.length === 0) {
        valid.push(log);
        continue;
      }
      valid.push(log);
    }
    return valid;
  }

  // ─── Status Engine ─────────────────────────────────────────────────────────

  calculateStatus(
    _entryTime: Date,
    _exitTime: Date | null,
    workingMinutes: number | null,
  ): AttendanceStatus {
    // Business rule:
    // - 7.5 hours or more = full day
    // - 4 to 7.49 hours   = half day
    // - less than 4 hours = absent
    if (workingMinutes === null || workingMinutes < HALF_DAY_MIN_MINS) {
      return AttendanceStatus.ABSENT;
    }

    if (workingMinutes < FULL_DAY_MIN_MINS) {
      return AttendanceStatus.HALF_DAY;
    }

    return AttendanceStatus.PRESENT;
  }

  // ─── Re-process a specific date (utility) ─────────────────────────────────

  async reprocessDate(date: string): Promise<void> {
    const { start: dayStart, end: dayEnd } = this.getBusinessDayBounds(date);
    const logs = await this.logRepo.find({
      where: { scannedAt: Between(dayStart, dayEnd) },
    });
    await this.processLogs(logs);
  }

  async reprocessForDeviceUser(deviceUserId: string): Promise<void> {
    const logs = await this.logRepo.find({
      where: { deviceUserId, suppressed: false },
    });
    if (logs.length === 0) return;
    await this.processLogs(logs);
  }

  // Called when the admin denies the unlinked-fingerprint popup. Marks every log
  // for that (deviceUserId, business-date) as suppressed so they are never
  // counted in attendance — even if the device user is later linked manually.
  async suppressForDeviceOnDate(deviceUserId: string, attendanceDate: string): Promise<void> {
    const { start, end } = this.getBusinessDayBounds(attendanceDate);
    const logs = await this.logRepo.find({
      where: { deviceUserId, suppressed: false, scannedAt: Between(start, end) },
    });
    if (logs.length === 0) return;
    for (const log of logs) log.suppressed = true;
    await this.logRepo.save(logs);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toDateString(d: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);

    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  private getBusinessDayBounds(date: string): { start: Date; end: Date } {
    const [year, month, day] = date.split('-').map(Number);
    const startUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - BUSINESS_TIME_OFFSET_HOURS * 60 * 60 * 1000;
    const endUtc = startUtc + 24 * 60 * 60 * 1000 - 1;
    return {
      start: new Date(startUtc),
      end: new Date(endUtc),
    };
  }

  private resolveDeviceUserId(scan: {
    deviceUserId?: string | number | null;
    uid?: string | number | null;
    userId?: string | number | null;
    userSn?: string | number | null;
  }): string | null {
    const direct = scan.deviceUserId;
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
      return String(direct).trim();
    }

    const uid = scan.uid;
    if (uid !== undefined && uid !== null && String(uid).trim() !== '') {
      return String(uid).trim();
    }

    const userId = scan.userId;
    if (userId !== undefined && userId !== null && String(userId).trim() !== '') {
      return String(userId).trim();
    }

    const userSn = scan.userSn;
    if (userSn !== undefined && userSn !== null && String(userSn).trim() !== '') {
      return String(userSn).trim();
    }

    return null;
  }

  private resolveScannedAt(scan: {
    attTime?: Date | string | number | null;
    recordTime?: Date | string | number | null;
  }): Date | null {
    const raw = scan.attTime ?? scan.recordTime;
    if (raw === undefined || raw === null) {
      return null;
    }

    if (raw instanceof Date) {
      return isNaN(raw.getTime()) ? null : raw;
    }

    if (typeof raw === 'number') {
      const millis = raw < 1_000_000_000_000 ? raw * 1000 : raw;
      const parsed = new Date(millis);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      const millis = trimmed.length <= 10 ? numeric * 1000 : numeric;
      const parsed = new Date(millis);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    const parsed = new Date(normalized);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
}
