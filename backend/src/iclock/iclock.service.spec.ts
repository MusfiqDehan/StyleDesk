import { IclockService } from './iclock.service';

describe('IclockService enrollment fragments', () => {
    function createService() {
        const deviceUserService = {
            upsertFromCloud: jest.fn().mockResolvedValue(undefined),
        };
        const attendanceLogService = {
            handleCloudLogEntry: jest.fn().mockResolvedValue(undefined),
        };
        const zkTecoService = {
            recordCloudContact: jest.fn(),
        };

        const service = new IclockService(
            deviceUserService as never,
            attendanceLogService as never,
            zkTecoService as never,
        );

        return { service, deviceUserService, attendanceLogService, zkTecoService };
    }

    it('keeps printable ADMS payload text intact during normalization', () => {
        const { service } = createService();

        const normalized = (service as unknown as {
            normalizeAdmsBody: (body: string) => string;
        }).normalizeAdmsBody('USER PIN=4 Name=P\x00');

        expect(normalized).toBe('USER PIN=4 Name=P');
    });

    it('keeps USERINFO and FP headers intact during normalization', () => {
        const { service } = createService();

        const normalize = (service as unknown as {
            normalizeAdmsBody: (body: string) => string;
        }).normalizeAdmsBody;

        expect(normalize('Name Pri Passwd Card Grp Verify- Card StartDatetime EndDatetime')).toBe(
            'Name Pri Passwd Card Grp Verify- Card StartDatetime EndDatetime',
        );
        expect(normalize('Size Valid abcdefghijklmnopqrstuvwxyz')).toBe(
            'Size Valid abcdefghijklmnopqrstuvwxyz',
        );
        expect(normalize('FP PIN=4 FID=4 Size=512 Valid=1 TMP=abc')).toBe(
            'FP PIN=4 FID=4 Size=512 Valid=1 TMP=abc',
        );
    });

    it('recognizes truncated USERINFO headers from the device logs', () => {
        const { service } = createService();

        const result = (service as unknown as {
            isKnownTableFragment: (body: string, tableContext: 'userinfo' | null, hasRecentRegistrationPin: boolean) => boolean;
        }).isKnownTableFragment(
            '  ame     ri      asswd   ard     rp              erify-  iceard  tartatetime     ndatetime',
            'userinfo',
            false,
        );

        expect(result).toBe(true);
    });

    it('uses the recent registration pin for blob-only fingerprint fragments', async () => {
        const { service, deviceUserService, attendanceLogService } = createService();

        await service.processPush('BAY5253500544', 'USER PIN=4 Name=P');
        deviceUserService.upsertFromCloud.mockClear();

        await service.processPush(
            'BAY5253500544',
            'ize     alid    zdncddkhseowwotdgggclgedugdgznkdhgagbbiggidlzpwa/lowdrosobswcwgbds+wgbiwuglps+pdssbnw+kdawccwsfdsnaonwbbpgfckdcgjnlbsvcgsbqqdgpvwcwcrwc/dwwh/hqhml+gfylqwfwzip++chiz+mnzdfjnikunsirrjkzuwitsnamsdic/cjpbmkdo/rgp+flvmyzmgkdfilf/gyqsgjweh/tfupddlsc/fr++hdf/r/gcvofqgibhvwgdsg/dbtywrn/csry+fodv',
        );

        expect(deviceUserService.upsertFromCloud).toHaveBeenCalledWith('4', null, {
            emitModal: true,
            deviceSerial: 'BAY5253500544',
        });
        expect(attendanceLogService.handleCloudLogEntry).not.toHaveBeenCalled();
    });

    it('applies a previously seen anonymous fingerprint completion when the pin arrives later', async () => {
        const { service, deviceUserService } = createService();

        await service.processPush(
            'BAY5253500544',
            'ize     alid    uzpqkcbpkgscqncwspgwpnoqhsgupyk+ptoaamwmoigoppknciagpgwptgabgcock/mpzwaa+agbarghgwcvwohaqghcyblcdnqoj+zafsagrto+nkmtpegmregagicnduktvgzz/scw+grfgrotpkancog/jyeene+ewphafldhjhrhchkhysqr/wwcakw///wwpwmb/wkphshnjufs/g+hewqifmlgcdgkjn+gmpmlemwswpgoee/+/w/wmwwckdnworwwlor+maownmahpovdbwsaswvl',
        );

        expect(deviceUserService.upsertFromCloud).not.toHaveBeenCalledWith('4', null, {
            emitModal: true,
            deviceSerial: 'BAY5253500544',
        });

        await service.processPush('BAY5253500544', 'USER PIN=4 Name=P');

        expect(deviceUserService.upsertFromCloud).toHaveBeenNthCalledWith(1, '4', 'P', {
            emitModal: false,
            markPending: true,
            deviceSerial: 'BAY5253500544',
        });
        expect(deviceUserService.upsertFromCloud).toHaveBeenNthCalledWith(2, '4', null, {
            emitModal: true,
            deviceSerial: 'BAY5253500544',
        });
    });

    // ─── Push protocol 2.4+ (M2-LR): BIODATA table, named in the query string ───

    const TEMPLATE =
        'TICkgAERBUEEAQEBAAAAAAAAAAAAAAAAAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8A' +
        'AP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAA==';

    it('completes enrollment from a BIODATA push announced only in the query string', async () => {
        const { service, deviceUserService, attendanceLogService } = createService();

        await service.processPush('M2LR001', 'USER PIN=7\tName=Rahim', 'USERINFO');
        deviceUserService.upsertFromCloud.mockClear();

        await service.processPush(
            'M2LR001',
            `Pin=7\tNo=0\tIndex=0\tValid=1\tDuress=0\tType=1\tMajorVer=53\tMinorVer=1\tFormat=0\tTmp=${TEMPLATE}`,
            'BIODATA',
        );

        expect(deviceUserService.upsertFromCloud).toHaveBeenCalledWith('7', null, {
            emitModal: true,
            deviceSerial: 'M2LR001',
        });
        expect(attendanceLogService.handleCloudLogEntry).not.toHaveBeenCalled();
    });

    it('completes enrollment from a BIODATA-prefixed row with no query table', async () => {
        const { service, deviceUserService } = createService();

        await service.processPush(
            'M2LR001',
            `BIODATA Pin=12\tNo=0\tIndex=0\tValid=1\tType=1\tTmp=${TEMPLATE}`,
        );

        expect(deviceUserService.upsertFromCloud).toHaveBeenCalledWith('12', null, {
            emitModal: true,
            deviceSerial: 'M2LR001',
        });
    });

    it('treats a face template (Type=9) as a completed enrollment too', async () => {
        const { service, deviceUserService } = createService();

        await service.processPush(
            'M2LR001',
            `Pin=3\tNo=0\tIndex=0\tValid=1\tType=9\tTmp=${TEMPLATE}`,
            'BIODATA',
        );

        expect(deviceUserService.upsertFromCloud).toHaveBeenCalledWith('3', null, {
            emitModal: true,
            deviceSerial: 'M2LR001',
        });
    });

    it('ignores a cleared template (Valid=0) so a deletion never closes the modal', async () => {
        const { service, deviceUserService } = createService();

        await service.processPush(
            'M2LR001',
            'Pin=7\tNo=0\tIndex=0\tValid=0\tType=1\tTmp=',
            'BIODATA',
        );

        expect(deviceUserService.upsertFromCloud).not.toHaveBeenCalledWith('7', null, {
            emitModal: true,
            deviceSerial: 'M2LR001',
        });
    });

    it('ignores BIOPHOTO — the enrollment photo is not a template', async () => {
        const { service, deviceUserService } = createService();

        await service.processPush(
            'M2LR001',
            `PIN=7\tFileName=7.jpg\tSize=2048\tContent=${TEMPLATE}`,
            'BIOPHOTO',
        );

        expect(deviceUserService.upsertFromCloud).not.toHaveBeenCalledWith('7', null, {
            emitModal: true,
            deviceSerial: 'M2LR001',
        });
    });

    it('still routes ATTLOG announced only in the query string', async () => {
        const { service, attendanceLogService } = createService();

        await service.processPush('M2LR001', '7\t2026-07-30 09:15:00\t0\t1\t0\t0', 'ATTLOG');

        expect(attendanceLogService.handleCloudLogEntry).toHaveBeenCalledTimes(1);
        expect(attendanceLogService.handleCloudLogEntry).toHaveBeenCalledWith(
            '7',
            expect.any(Date),
            1,
            0,
            'M2LR001',
        );
    });

    it('records a punch pushed as a key/value RTLOG row', async () => {
        const { service, attendanceLogService, deviceUserService } = createService();

        await service.processPush(
            'M2LR001',
            'time=2026-07-30 09:15:00\tpin=7\tcardno=0\tevent=0\tinoutstatus=0\tverifytype=1\tindex=1',
            'RTLOG',
        );

        expect(attendanceLogService.handleCloudLogEntry).toHaveBeenCalledTimes(1);
        const [pin, scannedAt, verify, status, serial] =
            attendanceLogService.handleCloudLogEntry.mock.calls[0];
        expect(pin).toBe('7');
        expect(verify).toBe(1);
        expect(status).toBe(0);
        expect(serial).toBe('M2LR001');
        // 09:15 Asia/Dhaka === 03:15 UTC
        expect((scannedAt as Date).toISOString()).toBe('2026-07-30T03:15:00.000Z');
        // The punch must not be mistaken for an enrollment and pop the modal.
        expect(deviceUserService.upsertFromCloud).toHaveBeenCalledWith('7', null, {
            emitModal: false,
            deviceSerial: 'M2LR001',
        });
    });

    it('does not read a punch out of a BIODATA row (PIN but no time)', async () => {
        const { service, attendanceLogService } = createService();

        await service.processPush(
            'M2LR001',
            `Pin=7\tNo=0\tIndex=0\tValid=1\tType=1\tTmp=${TEMPLATE}`,
            'BIODATA',
        );

        expect(attendanceLogService.handleCloudLogEntry).not.toHaveBeenCalled();
    });

    it('keeps the legacy F18 FP path working', async () => {
        const { service, deviceUserService } = createService();

        await service.processPush('BAY5253500544', 'FP PIN=4 FID=0 Size=512 Valid=1 TMP=abc');

        expect(deviceUserService.upsertFromCloud).toHaveBeenCalledWith('4', null, {
            emitModal: true,
            deviceSerial: 'BAY5253500544',
        });
    });

    it('treats separator lines as known fragments instead of unknown pushes', () => {
        const { service } = createService();

        const result = (service as unknown as {
            isKnownTableFragment: (body: string, tableContext: null, hasRecentRegistrationPin: boolean) => boolean;
        }).isKnownTableFragment('          --                              ', null, false);

        expect(result).toBe(true);
    });
});