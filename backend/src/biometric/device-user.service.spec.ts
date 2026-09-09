import { DeviceUserService } from './device-user.service';
import { DeviceUserStatus } from './entities/device-user.entity';

/**
 * UID allocation regression suite.
 *
 * The contract: the next enrollment PIN is the lowest integer ≥ 1 that is not
 * occupied on the terminal, in the DB mirror, or by a *live* reservation.
 * A reservation that never completes (employee walks away, device offline,
 * employee deleted) must give its UID back — otherwise allocation drifts past
 * the device's real occupancy (e.g. device holds 1..10 but next enroll gets 18).
 */

type Row = Record<string, any>;

/** Minimal in-memory stand-in for a TypeORM repository. */
class FakeRepo {
  rows: Row[] = [];
  private seq = 0;

  constructor(private readonly nowFn: () => number) {}

  private static matches(row: Row, where?: Row): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, cond]) => {
      // Unwrap TypeORM FindOperator (In([...]) etc.)
      if (cond && typeof cond === 'object' && typeof (cond as any).type === 'string') {
        const op = cond as any;
        if (op.type === 'in') return (op.value as unknown[]).includes(row[key]);
        throw new Error(`FakeRepo: unsupported operator '${op.type}'`);
      }
      return row[key] === cond;
    });
  }

  private applyOrder(rows: Row[], order?: Row): Row[] {
    if (!order) return rows;
    const [key, dir] = Object.entries(order)[0];
    return [...rows].sort((a, b) => {
      const av = a[key] instanceof Date ? a[key].getTime() : a[key];
      const bv = b[key] instanceof Date ? b[key].getTime() : b[key];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return String(dir).toUpperCase() === 'DESC' ? -cmp : cmp;
    });
  }

  find(options?: { where?: Row; order?: Row; select?: string[] }): Promise<Row[]> {
    const hit = this.rows.filter((r) => FakeRepo.matches(r, options?.where));
    return Promise.resolve(this.applyOrder(hit, options?.order));
  }

  findOne(options: { where?: Row; order?: Row }): Promise<Row | null> {
    const hit = this.rows.filter((r) => FakeRepo.matches(r, options.where));
    return Promise.resolve(this.applyOrder(hit, options.order)[0] ?? null);
  }

  create(obj: Row): Row {
    return { id: `row-${++this.seq}`, createdAt: new Date(this.nowFn()), ...obj };
  }

  save(obj: Row): Promise<Row> {
    if (!this.rows.includes(obj)) {
      if (!obj.id) obj.id = `row-${++this.seq}`;
      if (!obj.createdAt) obj.createdAt = new Date(this.nowFn());
      this.rows.push(obj);
    }
    return Promise.resolve(obj);
  }

  /** Only the `fingerprintCode IS NOT NULL` query used by the allocator. */
  createQueryBuilder(_alias: string) {
    const self = this;
    const qb = {
      select: () => qb,
      where: () => qb,
      getMany: () =>
        Promise.resolve(self.rows.filter((r) => r.fingerprintCode != null)),
    };
    return qb;
  }
}

describe('DeviceUserService — enrollment UID allocation', () => {
  const SN = 'SN-TEST-1';
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  let now: number;
  let deviceUserRepo: FakeRepo;
  let employeeRepo: FakeRepo;
  let zkTeco: any;
  let adms: any;
  let gateway: any;
  let service: DeviceUserService;
  /** PINs the physical terminal currently holds. */
  let livePins: string[];

  const addEmployee = (id: string, name: string, fingerprintCode: string | null = null) => {
    const emp = { id, name, fingerprintCode };
    employeeRepo.rows.push(emp);
    return emp;
  };

  /** Delete an employee the way EmployeeService.remove() does. */
  const deleteEmployee = async (id: string) => {
    await service.purgeEmployeeFromDevice(id);
    employeeRepo.rows = employeeRepo.rows.filter((e) => e.id !== id);
  };

  beforeEach(() => {
    now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    livePins = [];
    deviceUserRepo = new FakeRepo(() => now);
    employeeRepo = new FakeRepo(() => now);

    zkTeco = {
      isEnabled: jest.fn(() => true),
      isConnected: jest.fn(() => true),
      isCloudConnected: jest.fn(() => true),
      getCloudCommandSn: jest.fn(() => SN),
      getCloudDeviceSn: jest.fn(() => SN),
      getUsers: jest.fn(() => Promise.resolve(livePins.map((p) => ({ userId: p })))),
      deleteUser: jest.fn(() => Promise.resolve()),
      deleteUserFingerprints: jest.fn(() => Promise.resolve()),
      subscribeToFingerprintEvents: jest.fn(),
    };
    adms = {
      enqueueEnrollmentPriority: jest.fn(),
      enqueueAndAwait: jest.fn(() => Promise.resolve()),
    };
    gateway = {
      emitEnrollmentStatus: jest.fn(),
      emitEnrollmentCompleted: jest.fn(),
      emitNewDeviceUser: jest.fn(),
    };

    service = new DeviceUserService(
      deviceUserRepo as any,
      employeeRepo as any,
      zkTeco,
      gateway,
      adms,
    );
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('assigns UID 1 on a blank device', async () => {
    addEmployee('e1', 'Asha');
    const res = await service.startEnrollmentForEmployee('e1');
    expect(res.deviceUid).toBe('1');
  });

  it('fills the gap first — device holds 1,2,3,5 → next is 4', async () => {
    livePins = ['1', '2', '3', '5'];
    addEmployee('e1', 'Asha');
    const res = await service.startEnrollmentForEmployee('e1');
    expect(res.deviceUid).toBe('4');
  });

  it('appends when 1..N are contiguous — device holds 1..10 → next is 11', async () => {
    livePins = Array.from({ length: 10 }, (_, i) => String(i + 1));
    addEmployee('e1', 'Asha');
    const res = await service.startEnrollmentForEmployee('e1');
    expect(res.deviceUid).toBe('11');
  });

  it('never reuses a UID held by a linked employee', async () => {
    livePins = ['1', '2'];
    addEmployee('e1', 'Asha', '3'); // linked in DB, not yet in the live dump
    addEmployee('e2', 'Bina');
    const res = await service.startEnrollmentForEmployee('e2');
    expect(res.deviceUid).toBe('4');
  });

  // ---- the reported bug -------------------------------------------------

  it('reuses the UID after an abandoned enrollment whose employee was deleted', async () => {
    livePins = Array.from({ length: 10 }, (_, i) => String(i + 1));

    addEmployee('e1', 'Abandoned');
    const first = await service.startEnrollmentForEmployee('e1');
    expect(first.deviceUid).toBe('11');

    // Employee never scanned; admin deletes them. UID 11 must return to the pool.
    await deleteEmployee('e1');

    addEmployee('e2', 'Next Hire');
    const second = await service.startEnrollmentForEmployee('e2');
    expect(second.deviceUid).toBe('11');
  });

  it('does not drift after several abandoned + deleted enrollments (device stays at 1..10)', async () => {
    livePins = Array.from({ length: 10 }, (_, i) => String(i + 1));

    for (let i = 0; i < 7; i++) {
      const id = `ghost-${i}`;
      addEmployee(id, `Ghost ${i}`);
      const res = await service.startEnrollmentForEmployee(id);
      expect(res.deviceUid).toBe('11'); // every attempt takes the same free slot
      await deleteEmployee(id);
    }

    addEmployee('real', 'Real Hire');
    const res = await service.startEnrollmentForEmployee('real');
    expect(res.deviceUid).toBe('11'); // was 18 before the fix
  });

  it('releases a reservation that times out without any delete', async () => {
    livePins = Array.from({ length: 10 }, (_, i) => String(i + 1));

    addEmployee('e1', 'Walked Away');
    expect((await service.startEnrollmentForEmployee('e1')).deviceUid).toBe('11');

    // Same employee's row still mirrors UID 11, so use a different employee to
    // prove the *reservation* — not the DB row — was what expired.
    (deviceUserRepo.rows as Row[]).length = 0;
    employeeRepo.rows = employeeRepo.rows.filter((e) => e.id !== 'e1');

    now += TEN_MINUTES_MS + 1_000; // reservation TTL elapses (also expires the live-pin cache)

    addEmployee('e2', 'Next Hire');
    expect((await service.startEnrollmentForEmployee('e2')).deviceUid).toBe('11');
  });

  it('holds the UID while the reservation is still live', async () => {
    livePins = Array.from({ length: 10 }, (_, i) => String(i + 1));

    addEmployee('e1', 'Scanning Now');
    addEmployee('e2', 'Second');
    expect((await service.startEnrollmentForEmployee('e1')).deviceUid).toBe('11');

    now += 60_000; // enough to expire the live-pin cache, not the 10-min reservation
    expect((await service.startEnrollmentForEmployee('e2')).deviceUid).toBe('12');
  });

  it('gives the UID back when the enrollment fails to reach the terminal', async () => {
    livePins = Array.from({ length: 10 }, (_, i) => String(i + 1));
    adms.enqueueEnrollmentPriority.mockImplementationOnce(() => {
      throw new Error('ADMS queue offline');
    });

    addEmployee('e1', 'Failed Dispatch');
    await expect(service.startEnrollmentForEmployee('e1')).rejects.toThrow('ADMS queue offline');

    addEmployee('e2', 'Next Hire');
    expect((await service.startEnrollmentForEmployee('e2')).deviceUid).toBe('11');
  });

  it('frees the UID when the device user is deleted from the Unlinked Users page', async () => {
    livePins = Array.from({ length: 10 }, (_, i) => String(i + 1));

    addEmployee('e1', 'Abandoned');
    expect((await service.startEnrollmentForEmployee('e1')).deviceUid).toBe('11');

    // Admin deletes the stray device user directly instead of deleting the employee.
    await service.deleteDeviceUser('11', { requireDeviceDeletion: false });

    addEmployee('e2', 'Next Hire');
    expect((await service.startEnrollmentForEmployee('e2')).deviceUid).toBe('11');
  });

  it('frees UIDs cleared by "delete all unlinked device users"', async () => {
    livePins = Array.from({ length: 10 }, (_, i) => String(i + 1));

    addEmployee('e1', 'Abandoned');
    expect((await service.startEnrollmentForEmployee('e1')).deviceUid).toBe('11');

    // The enrollment row must look genuinely unlinked for the bulk delete to touch it.
    const row = deviceUserRepo.rows.find((r) => r.deviceUid === '11')!;
    row.linkedEmployeeId = null;
    row.status = DeviceUserStatus.UNLINKED;
    employeeRepo.rows = employeeRepo.rows.filter((e) => e.id !== 'e1');

    await service.deleteAllUnlinkedDeviceUsers();

    addEmployee('e2', 'Next Hire');
    expect((await service.startEnrollmentForEmployee('e2')).deviceUid).toBe('11');
  });

  it('gives distinct UIDs to concurrent enrollments', async () => {
    livePins = Array.from({ length: 10 }, (_, i) => String(i + 1));
    addEmployee('e1', 'A');
    addEmployee('e2', 'B');
    addEmployee('e3', 'C');

    const results = await Promise.all([
      service.startEnrollmentForEmployee('e1'),
      service.startEnrollmentForEmployee('e2'),
      service.startEnrollmentForEmployee('e3'),
    ]);

    const uids = results.map((r) => r.deviceUid).sort();
    expect(uids).toEqual(['11', '12', '13']);
  });

  it('re-enrolls an already-linked employee on their existing UID', async () => {
    livePins = ['1', '2', '3'];
    addEmployee('e1', 'Asha', '2');
    const res = await service.startEnrollmentForEmployee('e1');
    expect(res.deviceUid).toBe('2');
  });

  it('reuses the employee’s own UID when only the fingerprint was removed', async () => {
    livePins = Array.from({ length: 10 }, (_, i) => String(i + 1));
    addEmployee('e1', 'Asha');
    expect((await service.startEnrollmentForEmployee('e1')).deviceUid).toBe('11');

    // Link completes, then the admin removes just the template.
    const emp = employeeRepo.rows.find((e) => e.id === 'e1')!;
    emp.fingerprintCode = '11';
    livePins.push('11');
    await service.removeFingerprintForEmployee('e1');

    expect((await service.startEnrollmentForEmployee('e1')).deviceUid).toBe('11');
  });

  it('does not hand out UID 1 when the live dump is unavailable', async () => {
    // Device offline: TCP returns nothing and ADMS query fails — occupancy is unknown,
    // so the allocator must fall back to the DB mirror instead of assuming a blank device.
    deviceUserRepo.rows.push(
      { id: 'a', deviceUid: '1', status: DeviceUserStatus.LINKED, linkedEmployeeId: null, createdAt: new Date(now) },
      { id: 'b', deviceUid: '2', status: DeviceUserStatus.UNLINKED, linkedEmployeeId: null, createdAt: new Date(now) },
    );
    zkTeco.getUsers.mockResolvedValue([]);
    adms.enqueueAndAwait.mockRejectedValue(new Error('device offline'));

    addEmployee('e1', 'Asha');
    expect((await service.startEnrollmentForEmployee('e1')).deviceUid).toBe('3');
  });
});
