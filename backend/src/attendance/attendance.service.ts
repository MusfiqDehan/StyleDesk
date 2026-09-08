import { scopedManager } from '../tenancy/tenant-context.js';
import { DeviceUser } from '../biometric/entities/device-user.entity.js';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { AttendanceLog } from './entities/attendance-log.entity';
import { Employee } from '../employee/entities/employee.entity';
import { FilterAttendanceDto } from './dto/filter-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { AttendanceLogService } from './attendance-log.service';

const BUSINESS_TIME_ZONE = 'Asia/Dhaka';
const BUSINESS_TIME_OFFSET_HOURS = 6;

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,

    @InjectRepository(AttendanceLog)
    private readonly logRepo: Repository<AttendanceLog>,

    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,

    private readonly logService: AttendanceLogService,
  ) { }

  // ─── Webhook punch (legacy / external integrations) ──────────────────────

  async punchByFingerprint(
    fingerprintCode: string,
    machineId: string,
    timestamp: string,
  ): Promise<Attendance> {
    const punchedAt = this.parseTimestamp(timestamp);
    const attendanceDate = this.toDateString(punchedAt);

    const linked = await scopedManager().getRepository(DeviceUser).findOne({ where: { deviceUid: fingerprintCode } });
    const employee = linked?.linkedEmployeeId ? await this.employeeRepo.findOne({ where: { id: linked.linkedEmployeeId } }) : null;
    if (!employee) {
      throw new NotFoundException(`No employee found with fingerprint code: ${fingerprintCode}`);
    }

    const existing = await this.attendanceRepo.findOne({
      where: { employeeId: employee.id, attendanceDate },
    });

    if (!existing) {
      const record = this.attendanceRepo.create({
        employeeId: employee.id,
        employee,
        employeeName: employee.name,
        machineId,
        attendanceDate,
        checkInTime: punchedAt,
        status: null,
      });
      return this.attendanceRepo.save(record);
    }

    if (!existing.checkOutTime) {
      existing.checkOutTime = punchedAt;
      existing.workingMinutes = Math.round(
        (punchedAt.getTime() - existing.checkInTime!.getTime()) / 60_000,
      );
      existing.status = this.logService.calculateStatus(
        existing.checkInTime!,
        existing.checkOutTime,
        existing.workingMinutes,
      );
      return this.attendanceRepo.save(existing);
    }

    throw new BadRequestException(
      `Employee ${employee.name} already has a complete record for ${attendanceDate}`,
    );
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  findAll(): Promise<Attendance[]> {
    return this.attendanceRepo.find({ order: { attendanceDate: 'DESC' } });
  }

  async findFiltered(filter: FilterAttendanceDto): Promise<Attendance[]> {
    const qb = this.attendanceRepo
      .createQueryBuilder('a')
      .select([
        'a.id',
        'a.employeeId',
        'a.employeeName',
        'a.machineId',
        'a.deviceSerial',
        'a.attendanceDate',
        'a.checkInTime',
        'a.checkOutTime',
        'a.workingMinutes',
        'a.status',
        'a.createdAt',
      ])
      .orderBy('a.attendanceDate', 'DESC')
      .addOrderBy('a.checkInTime', 'ASC');

    if (filter.date) {
      qb.andWhere('a.attendanceDate = :date', { date: filter.date });
    } else if (filter.month || filter.year) {
      const year = Number(filter.year ?? new Date().getFullYear());
      const month = Number(filter.month ?? new Date().getMonth() + 1);
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      qb.andWhere('a.attendanceDate BETWEEN :from AND :to', { from, to });
    }

    if (filter.employeeId) {
      qb.andWhere('a.employeeId = :empId', { empId: filter.employeeId });
    }

    if (filter.deviceSerial) {
      qb.andWhere('a.deviceSerial = :sn', { sn: filter.deviceSerial });
    }

    return qb.getMany();
  }

  /** Distinct device serial numbers seen in attendance records (for filter dropdowns). */
  async getDeviceSerials(): Promise<string[]> {
    const rows = await this.attendanceRepo
      .createQueryBuilder('a')
      .select('DISTINCT a.deviceSerial', 'deviceSerial')
      .where('a.deviceSerial IS NOT NULL')
      .orderBy('a.deviceSerial', 'ASC')
      .getRawMany<{ deviceSerial: string }>();

    return rows.map((r) => r.deviceSerial).filter(Boolean);
  }

  async findToday(): Promise<Attendance[]> {
    const today = this.toDateString(new Date());
    return this.attendanceRepo
      .createQueryBuilder('a')
      .select([
        'a.id',
        'a.employeeId',
        'a.employeeName',
        'a.machineId',
        'a.deviceSerial',
        'a.attendanceDate',
        'a.checkInTime',
        'a.checkOutTime',
        'a.workingMinutes',
        'a.status',
        'a.createdAt',
      ])
      .where('a.attendanceDate = :today', { today })
      .orderBy('a.checkInTime', 'ASC')
      .getMany();
  }

  async findByDateRange(from: string, to: string): Promise<Attendance[]> {
    return this.attendanceRepo.find({
      where: { attendanceDate: Between(from, to) as any },
      order: { attendanceDate: 'ASC', checkInTime: 'ASC' },
    });
  }

  async getMonthSummary(year: number, month: number) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const records = await this.attendanceRepo
      .createQueryBuilder('a')
      .select(['a.status'])
      .where('a.attendanceDate BETWEEN :from AND :to', { from, to })
      .getMany();

    const counts = {
      present: 0,
      late: 0,
      half_day: 0,
      absent: 0,
      no_exit: 0,
    };

    for (const r of records) {
      if (!r.status) { counts.no_exit++; continue; }
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }

    return { from, to, total: records.length, ...counts };
  }

  async syncFromDevice(): Promise<{ synced: true }> {
    await this.logService.syncFromDevice();
    return { synced: true };
  }

  async update(id: string, dto: UpdateAttendanceDto): Promise<Attendance> {
    const record = await this.attendanceRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Attendance record '${id}' not found`);

    if (dto.checkInTime !== undefined) {
      record.checkInTime = new Date(dto.checkInTime);
    }
    if (dto.checkOutTime !== undefined) {
      record.checkOutTime = dto.checkOutTime ? new Date(dto.checkOutTime) : null;
    }

    if (record.checkInTime && record.checkOutTime) {
      record.workingMinutes = Math.round(
        (record.checkOutTime.getTime() - record.checkInTime.getTime()) / 60_000,
      );
      record.status = dto.status !== undefined
        ? dto.status
        : this.logService.calculateStatus(record.checkInTime, record.checkOutTime, record.workingMinutes);
    } else {
      if (dto.status !== undefined) record.status = dto.status;
      if (!record.checkOutTime) record.workingMinutes = null;
    }

    return this.attendanceRepo.save(record);
  }

  async remove(id: string): Promise<{ success: true; id: string }> {
    const record = await this.attendanceRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Attendance record '${id}' not found`);
    }

    // Suppress (not delete) the raw scan logs for this device+date.
    // Deleting them would cause syncFromDevice to re-import them from the device
    // on the next cron tick and recreate the attendance row. Suppression keeps
    // the rows present (so the dedup check in syncFromDevice skips re-import)
    // but hides them from processGroup so the next real scan starts a fresh cycle.
    const [year, month, day] = record.attendanceDate.split('-').map(Number);
    const dayStartUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - BUSINESS_TIME_OFFSET_HOURS * 60 * 60 * 1000;
    const dayStart = new Date(dayStartUtc);
    const dayEnd = new Date(dayStartUtc + 24 * 60 * 60 * 1000 - 1);

    await this.logRepo
      .createQueryBuilder()
      .update(AttendanceLog)
      .set({ suppressed: true })
      .where('deviceUserId = :deviceUserId', { deviceUserId: record.machineId })
      .andWhere('scannedAt BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
      .execute();

    await this.attendanceRepo.remove(record);
    return { success: true, id };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private parseTimestamp(raw: string): Date {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      const millis = trimmed.length <= 10 ? numeric * 1000 : numeric;
      return new Date(millis);
    }
    const iso = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    return new Date(iso);
  }

  private toDateString(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  private getBusinessDayBounds(date: Date): { start: Date; end: Date } {
    const dateString = this.toDateString(date);
    const [year, month, day] = dateString.split('-').map(Number);
    const startUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - BUSINESS_TIME_OFFSET_HOURS * 60 * 60 * 1000;
    const endUtc = startUtc + 24 * 60 * 60 * 1000 - 1;
    return {
      start: new Date(startUtc),
      end: new Date(endUtc),
    };
  }
}
