import { AttendanceLogService } from './attendance-log.service';
import { AttendanceStatus } from './entities/attendance.entity';

describe('AttendanceLogService', () => {
  it('imports device logs that expose recordTime and creates an open attendance row', async () => {
    const scannedAt = new Date('2026-04-27T03:30:00.000Z');
    const employee = { id: 'emp-1', name: 'Ayesha', fingerprintCode: '17' };

    const logRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((value) => value),
      find: jest.fn().mockResolvedValue([
        {
          deviceUserId: '17',
          scannedAt,
        },
      ]),
    };

    const attendanceRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((value) => value),
    };

    const employeeRepo = {
      findOne: jest.fn().mockResolvedValue(employee),
    };

    const zkTecoService = {
      connect: jest.fn().mockResolvedValue(undefined),
      isEnabled: jest.fn().mockReturnValue(true),
      isConnected: jest.fn().mockReturnValue(true),
      getAttendances: jest.fn().mockResolvedValue([
        {
          deviceUserId: '17',
          recordTime: scannedAt,
          verifyMethod: 1,
          inOutStatus: 0,
        },
      ]),
      subscribeToFingerprintEvents: jest.fn(),
    };

    const biometricGateway = {
      emitAttendanceUpdated: jest.fn(),
    };

    const deviceUserRepo = { findOne: jest.fn().mockResolvedValue({ linkedEmployeeId: employee.id }) };

    const service = new AttendanceLogService(
      logRepo as any,
      attendanceRepo as any,
      employeeRepo as any,
      deviceUserRepo as any,
      zkTecoService as any,
      biometricGateway as any,
    );

    await service.syncFromDevice();

    expect(logRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        deviceUserId: '17',
        scannedAt,
        verifyMethod: 1,
        inOutStatus: 0,
      }),
    ]);
    expect(attendanceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-1',
        employeeName: 'Ayesha',
        machineId: '17',
        attendanceDate: '2026-04-27',
        checkInTime: scannedAt,
        checkOutTime: null,
        workingMinutes: null,
        status: null,
      }),
    );
    expect(biometricGateway.emitAttendanceUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        attendanceDates: ['2026-04-27'],
        deviceUserIds: ['17'],
      }),
    );
  });

  it('treats the first scan as entry and the second scan as exit', async () => {
    const entryTime = new Date('2026-04-27T03:30:00.000Z');
    const exitTime = new Date('2026-04-27T12:00:00.000Z');
    const employee = { id: 'emp-1', name: 'Ayesha', fingerprintCode: '17' };

    const logRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((value) => value),
      find: jest.fn().mockResolvedValue([
        {
          deviceUserId: '17',
          scannedAt: entryTime,
        },
        {
          deviceUserId: '17',
          scannedAt: exitTime,
        },
      ]),
    };

    const attendanceRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((value) => value),
    };

    const employeeRepo = {
      findOne: jest.fn().mockResolvedValue(employee),
    };

    const zkTecoService = {
      connect: jest.fn().mockResolvedValue(undefined),
      isEnabled: jest.fn().mockReturnValue(true),
      isConnected: jest.fn().mockReturnValue(true),
      getAttendances: jest.fn().mockResolvedValue([
        {
          deviceUserId: '17',
          recordTime: entryTime,
          verifyMethod: 1,
          inOutStatus: 0,
        },
        {
          deviceUserId: '17',
          recordTime: exitTime,
          verifyMethod: 1,
          inOutStatus: 0,
        },
      ]),
      subscribeToFingerprintEvents: jest.fn(),
    };

    const biometricGateway = {
      emitAttendanceUpdated: jest.fn(),
    };

    const deviceUserRepo = { findOne: jest.fn().mockResolvedValue({ linkedEmployeeId: employee.id }) };

    const service = new AttendanceLogService(
      logRepo as any,
      attendanceRepo as any,
      employeeRepo as any,
      deviceUserRepo as any,
      zkTecoService as any,
      biometricGateway as any,
    );

    await service.syncFromDevice();

    expect(attendanceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-1',
        attendanceDate: '2026-04-27',
        checkInTime: entryTime,
        checkOutTime: exitTime,
        workingMinutes: 510,
        status: AttendanceStatus.PRESENT,
      }),
    );
  });
});
