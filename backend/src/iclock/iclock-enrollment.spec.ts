import { IclockController } from './iclock.controller';
import { IclockService } from './iclock.service';
import { DeviceUserService } from '../biometric/device-user.service';
import { DeviceUserStatus } from '../biometric/entities/device-user.entity';

/**
 * Full enrollment chain for a push-protocol-2.4 terminal (M2-LR):
 *
 *   admin clicks Register  →  ENROLL_FP queued
 *   device saves template  →  POST /iclock/cdata?SN=…&table=BIODATA
 *   controller → IclockService → DeviceUserService → gateway
 *   →  modal closes (enrollment-completed) and the UID is linked to the employee
 *
 * Only the repositories, the socket gateway and the ADMS queue are faked; the
 * controller, both services and every parser in between are the real code.
 */

type Row = Record<string, any>;

class FakeRepo {
  rows: Row[] = [];
  private seq = 0;

  private static matches(row: Row, where?: Row): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, cond]) => {
      if (cond && typeof cond === 'object' && typeof (cond as any).type === 'string') {
        const op = cond as any;
        if (op.type === 'in') return (op.value as unknown[]).includes(row[key]);
        throw new Error(`FakeRepo: unsupported operator '${op.type}'`);
      }
      return row[key] === cond;
    });
  }

  find(options?: { where?: Row }): Promise<Row[]> {
    return Promise.resolve(this.rows.filter((r) => FakeRepo.matches(r, options?.where)));
  }

  findOne(options: { where?: Row }): Promise<Row | null> {
    return Promise.resolve(this.rows.find((r) => FakeRepo.matches(r, options.where)) ?? null);
  }

  create(obj: Row): Row {
    return { id: `row-${++this.seq}`, createdAt: new Date(), ...obj };
  }

  save(obj: Row): Promise<Row> {
    if (!this.rows.includes(obj)) {
      if (!obj.id) obj.id = `row-${++this.seq}`;
      this.rows.push(obj);
    }
    return Promise.resolve(obj);
  }

  createQueryBuilder(_alias: string) {
    const self = this;
    const qb = {
      select: () => qb,
      where: () => qb,
      getMany: () => Promise.resolve(self.rows.filter((r) => r.fingerprintCode != null)),
    };
    return qb;
  }
}

/** Fingerprint template as the device sends it — long base64 blob. */
const TEMPLATE = `TICkgAERBUEEAQEBAAAAAAAA${'AP8A'.repeat(60)}==`;

describe('M2-LR enrollment → attendance, end to end', () => {
  const SN = 'M2LR-9911';

  let deviceUserRepo: FakeRepo;
  let employeeRepo: FakeRepo;
  let gateway: any;
  let adms: any;
  let attendanceLogService: any;
  let zkTeco: any;
  let deviceUserService: DeviceUserService;
  let iclockService: IclockService;
  let controller: IclockController;

  /** Deliver a device push through the real HTTP handler. */
  const push = async (body: string, table?: string) => {
    const req: any = { body: Buffer.from(body, 'utf-8'), ip: '103.178.191.173' };
    const res: any
      = { setHeader: jest.fn(), status: jest.fn(() => res), send: jest.fn(() => res) };
    controller.data(SN, table as string, req, res);
    // The controller answers the device immediately and processes in the background.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    return res;
  };

  beforeEach(() => {
    deviceUserRepo = new FakeRepo();
    employeeRepo = new FakeRepo();

    gateway = {
      emitEnrollmentStatus: jest.fn(),
      emitEnrollmentCompleted: jest.fn(),
      emitNewDeviceUser: jest.fn(),
    };
    adms = {
      enqueueEnrollmentPriority: jest.fn(),
      enqueueAndAwait: jest.fn(() => Promise.resolve()),
      dequeueForDevice: jest.fn(() => null),
      applyDeviceAck: jest.fn(),
    };
    attendanceLogService = { handleCloudLogEntry: jest.fn().mockResolvedValue(undefined) };
    zkTeco = {
      isEnabled: jest.fn(() => false),
      isConnected: jest.fn(() => false),
      isCloudConnected: jest.fn(() => true),
      getCloudCommandSn: jest.fn(() => SN),
      getCloudDeviceSn: jest.fn(() => SN),
      getUsers: jest.fn(() => Promise.resolve([])),
      recordCloudContact: jest.fn(),
      subscribeToFingerprintEvents: jest.fn(),
    };

    deviceUserService = new DeviceUserService(
      deviceUserRepo as any,
      employeeRepo as any,
      zkTeco,
      gateway,
      adms,
    );
    iclockService = new IclockService(
      deviceUserService,
      attendanceLogService,
      zkTeco,
    );
    controller = new IclockController(iclockService, adms);

    for (const target of [deviceUserService, iclockService, controller]) {
      jest.spyOn((target as any).logger, 'log').mockImplementation(() => undefined);
      jest.spyOn((target as any).logger, 'warn').mockImplementation(() => undefined);
      jest.spyOn((target as any).logger, 'debug').mockImplementation(() => undefined);
    }
  });

  afterEach(() => jest.restoreAllMocks());

  it('closes the waiting modal and links the UID when the M2-LR pushes BIODATA', async () => {
    employeeRepo.rows.push({ id: 'emp-1', name: 'Rahim', fingerprintCode: null });

    // 1. Admin clicks "Register fingerprint".
    const { deviceUid } = await deviceUserService.startEnrollmentForEmployee('emp-1');
    expect(deviceUid).toBe('1');
    expect(adms.enqueueEnrollmentPriority).toHaveBeenCalledWith(
      SN,
      expect.arrayContaining([expect.stringContaining('ENROLL_FP PIN=1')]),
    );
    expect(gateway.emitEnrollmentCompleted).not.toHaveBeenCalled();

    // 2. The device saves the template and pushes it — table named in the query only.
    await push(
      `Pin=1\tNo=0\tIndex=0\tValid=1\tDuress=0\tType=1\tMajorVer=53\tMinorVer=1\tFormat=0\tTmp=${TEMPLATE}`,
      'BIODATA',
    );

    // 3. Modal closes, UI gets the employee + UID.
    expect(gateway.emitEnrollmentCompleted).toHaveBeenCalledWith({
      employeeId: 'emp-1',
      deviceUid: '1',
      name: 'Rahim',
    });
    expect(gateway.emitEnrollmentStatus).toHaveBeenCalledWith({
      employeeId: 'emp-1',
      deviceUid: '1',
      status: 'completed',
    });
    // Never the "unknown fingerprint" modal — that would ask the admin to link it by hand.
    expect(gateway.emitNewDeviceUser).not.toHaveBeenCalled();

    // 4. The link is persisted both ways, which is what attendance matching relies on.
    const employee = await employeeRepo.findOne({ where: { id: 'emp-1' } });
    expect(employee?.fingerprintCode).toBe('1');
    const deviceUser = await deviceUserRepo.findOne({ where: { deviceUid: '1' } });
    expect(deviceUser?.status).toBe(DeviceUserStatus.LINKED);
    expect(deviceUser?.linkedEmployeeId).toBe('emp-1');
    expect(deviceUser?.deviceSerial).toBe(SN);
  });

  it('records the punch of an already-registered employee for the attendance page', async () => {
    employeeRepo.rows.push({ id: 'emp-1', name: 'Rahim', fingerprintCode: null });
    await deviceUserService.startEnrollmentForEmployee('emp-1');
    await push(`BIODATA Pin=1\tNo=0\tValid=1\tType=1\tTmp=${TEMPLATE}`);
    gateway.emitEnrollmentCompleted.mockClear();

    // Positional ATTLOG (F18 style) and key/value RTLOG (2.4+ style) both count.
    await push('1\t2026-07-30 09:15:00\t0\t1\t0\t0', 'ATTLOG');
    await push(
      'time=2026-07-30 18:05:00\tpin=1\tcardno=0\tevent=0\tinoutstatus=1\tverifytype=1\tindex=2',
      'RTLOG',
    );

    expect(attendanceLogService.handleCloudLogEntry).toHaveBeenCalledTimes(2);

    const [checkIn, checkOut] = attendanceLogService.handleCloudLogEntry.mock.calls;
    expect(checkIn[0]).toBe('1');
    expect((checkIn[1] as Date).toISOString()).toBe('2026-07-30T03:15:00.000Z'); // 09:15 Dhaka
    expect(checkIn[3]).toBe(0);
    expect(checkIn[4]).toBe(SN);

    expect(checkOut[0]).toBe('1');
    expect((checkOut[1] as Date).toISOString()).toBe('2026-07-30T12:05:00.000Z'); // 18:05 Dhaka
    expect(checkOut[3]).toBe(1);

    // A punch must never re-open the registration modal for a linked user.
    expect(gateway.emitNewDeviceUser).not.toHaveBeenCalled();
    expect(gateway.emitEnrollmentCompleted).not.toHaveBeenCalled();
  });

  it('leaves the modal open when the device only reports a deleted template', async () => {
    employeeRepo.rows.push({ id: 'emp-1', name: 'Rahim', fingerprintCode: null });
    await deviceUserService.startEnrollmentForEmployee('emp-1');

    await push('Pin=1\tNo=0\tIndex=0\tValid=0\tType=1\tTmp=', 'BIODATA');

    expect(gateway.emitEnrollmentCompleted).not.toHaveBeenCalled();
    const employee = await employeeRepo.findOne({ where: { id: 'emp-1' } });
    expect(employee?.fingerprintCode).toBeNull();
  });

  // These two depend on the `table=` query param surviving the controller: the body
  // alone is ambiguous, so dropping the param silently breaks (or falsely triggers)
  // enrollment. Both fail if IclockController stops forwarding it.

  it('completes enrollment from a template row the body alone cannot classify', async () => {
    employeeRepo.rows.push({ id: 'emp-1', name: 'Rahim', fingerprintCode: null });
    await deviceUserService.startEnrollmentForEmployee('emp-1');

    // No BIODATA prefix, no Tmp= blob — only the query table says what this is.
    await push('Pin=1\tNo=0\tIndex=0\tValid=1\tDuress=0\tType=1\tMajorVer=53', 'BIODATA');

    expect(gateway.emitEnrollmentCompleted).toHaveBeenCalledWith({
      employeeId: 'emp-1',
      deviceUid: '1',
      name: 'Rahim',
    });
  });

  it('never completes enrollment from an enrollment photo push', async () => {
    employeeRepo.rows.push({ id: 'emp-1', name: 'Rahim', fingerprintCode: null });
    await deviceUserService.startEnrollmentForEmployee('emp-1');

    // BIOPHOTO rows carry PIN= and Size= — template-shaped to the body heuristics.
    await push(`PIN=1\tFileName=1.jpg\tSize=2048\tContent=${TEMPLATE}`, 'BIOPHOTO');

    expect(gateway.emitEnrollmentCompleted).not.toHaveBeenCalled();
    const employee = await employeeRepo.findOne({ where: { id: 'emp-1' } });
    expect(employee?.fingerprintCode).toBeNull();
  });

  // ─── Terminals that never push a template (the real M2-LR behaviour) ───────
  //
  // Observed on SN=FQQ2251600114: ENROLL_FP is ACKed, the finger is enrolled on the
  // terminal, and the only push that follows is `table=OPERLOG`. No FP, no BIODATA.

  it('completes enrollment from OPERLOG when no template is ever pushed', async () => {
    employeeRepo.rows.push({ id: 'emp-1', name: 'Siam Hossain', fingerprintCode: null });
    await deviceUserService.startEnrollmentForEmployee('emp-1');

    // Fake timers only from here — the enrollment call itself awaits real ones.
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      // OPLOG: [OPLOG, AdminPin, OpType, Date, Time, Pin, …]
      await push('OPLOG\t0\t12\t2026-07-30\t15:35:35\t1\t0\t0\t0', 'OPERLOG');

      // Still waiting — the F18 sends OPERLOG before the template is stored, so an
      // immediate completion here would close the modal too early on that device.
      expect(gateway.emitEnrollmentCompleted).not.toHaveBeenCalled();

      // No template arrives within the grace period → complete from the operation log.
      await jest.advanceTimersByTimeAsync(13_000);

      expect(gateway.emitEnrollmentCompleted).toHaveBeenCalledWith({
        employeeId: 'emp-1',
        deviceUid: '1',
        name: 'Siam Hossain',
      });
      const employee = await employeeRepo.findOne({ where: { id: 'emp-1' } });
      expect(employee?.fingerprintCode).toBe('1');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not double-complete when a template arrives during the grace period', async () => {
    employeeRepo.rows.push({ id: 'emp-1', name: 'Siam Hossain', fingerprintCode: null });
    await deviceUserService.startEnrollmentForEmployee('emp-1');

    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      await push('OPLOG\t0\t12\t2026-07-30\t15:35:35\t1\t0\t0\t0', 'OPERLOG');
      await push(`Pin=1\tNo=0\tValid=1\tType=1\tTmp=${TEMPLATE}`, 'BIODATA');

      expect(gateway.emitEnrollmentCompleted).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(13_000);

      // The fallback timer must find nothing pending and stay silent.
      expect(gateway.emitEnrollmentCompleted).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores OPERLOG for a UID with no pending enrollment', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      await push('OPLOG\t0\t12\t2026-07-30\t15:35:35\t9\t0\t0\t0', 'OPERLOG');
      await jest.advanceTimersByTimeAsync(13_000);

      expect(gateway.emitEnrollmentCompleted).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('answers push-2.4 firmware with the option block that enables template upload', () => {
    const res: any
      = { setHeader: jest.fn(), status: jest.fn(() => res), send: jest.fn(() => res) };
    controller.handshake(SN, '2.4.1', 'all', { ip: '1.2.3.4' } as any, res);

    const body: string = res.send.mock.calls[0][0];
    expect(body.startsWith(`GET OPTION FROM: ${SN}`)).toBe(true);
    expect(body).toContain('MultiBioDataSupport=1:1:1:1:1:1:1:1:1:1');
    expect(body).toContain('PushProtVer=2.4.1');
    expect(body).toContain('TransFlag=TransData AttLog');
    expect(body).toContain('BioData');
    expect(body).toContain('TimeZone=6');
  });

  it('leaves the pre-2.4 (F18) handshake reply exactly as it was', () => {
    const res: any
      = { setHeader: jest.fn(), status: jest.fn(() => res), send: jest.fn(() => res) };
    controller.handshake('BAY5253500544', '2.2.14', 'all', { ip: '1.2.3.4' } as any, res);

    const body: string = res.send.mock.calls[0][0];
    expect(body.startsWith('OK\r\n')).toBe(true);
    expect(body).not.toContain('GET OPTION FROM');
    expect(body).not.toContain('MultiBioDataSupport');
  });

  it('falls back to the legacy reply when the device sends no pushver', () => {
    const res: any
      = { setHeader: jest.fn(), status: jest.fn(() => res), send: jest.fn(() => res) };
    controller.handshake(SN, undefined as any, undefined as any, { ip: '1.2.3.4' } as any, res);

    expect((res.send.mock.calls[0][0] as string).startsWith('OK\r\n')).toBe(true);
  });

  it('still answers the device with 200 OK on every push', async () => {
    const res = await push(`BIODATA Pin=1\tValid=1\tType=1\tTmp=${TEMPLATE}`, 'BIODATA');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('OK\n');
  });
});
