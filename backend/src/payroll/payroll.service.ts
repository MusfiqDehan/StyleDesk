import { cursorRequest } from '../common/pagination/cursor.js';
import { Optional } from '@nestjs/common';
import { TenantCron, TenantJobs } from '../tenancy/tenant-jobs.js';
import { SCOPED_CACHE_MANAGER } from '../tenancy/tenancy.module.js';
import { Injectable, NotFoundException, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import type { FindOperator } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Cron } from '@nestjs/schedule';
import { Payroll, PayrollStatus } from './entities/payroll.entity.js';
import { CreatePayrollDto } from './dto/create-payroll.dto.js';
import { UpdatePayrollDto } from './dto/update-payroll.dto.js';
import { Employee, EmployeeStatus } from '../employee/entities/employee.entity.js';
import { FinanceService } from '../finance/finance.service.js';

const CACHE_TTL = 5 * 60 * 1000;

// SEED_DATA removed due to UUID incompatibility with 'EMP001' style IDs.

@Injectable()
export class PayrollService implements OnModuleInit {
  private readonly logger = new Logger(PayrollService.name);
  private readonly activeKeys = new Set<string>();

  constructor(
    @InjectRepository(Payroll)
    private readonly repo: Repository<Payroll>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @Inject(SCOPED_CACHE_MANAGER) private cacheManager: Cache,
    private readonly financeService: FinanceService,
    @Optional() private readonly tenantJobs?: TenantJobs,
  ) { }

  async onModuleInit() {
    // Tenant defaults are created explicitly by provisioning.
  }

  /**
   * Realigns the Employee Salary & Bonus ledger with Manage Payroll: one expense per Paid
   * payroll, none for anything else. Safe to call after any out-of-band payroll change
   * (startup, employee deletion cascading payroll rows away).
   */
  async reconcileFinanceExpenses() {
    try {
      const { synced, removed } = await this.financeService.reconcilePayrollExpenses();
      if (synced > 0 || removed > 0) {
        this.logger.log(
          `Payroll expense reconcile: ${synced} paid payroll expense(s) in sync, ${removed} stale expense(s) removed.`,
        );
      }
    } catch (err) {
      this.logger.error('Failed to reconcile payroll finance expenses:', err);
    }
  }

  private cacheKey(month?: number, year?: number, page = 1, limit = 10, search?: string, status?: string) {
    return `payroll:${year ?? 'all'}:${month ?? 'all'}:${page}:${limit}:${search ?? 'none'}:${status ?? 'all'}`;
  }

  private businessDateParts() {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const [year, month, day] = today.split('-').map(Number);
    return { year, month, day };
  }

  private businessMonthYear() {
    const { year, month } = this.businessDateParts();
    return { year, month };
  }

  private daysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }

  private nextPeriod(year: number, month: number) {
    if (month === 12) return { year: year + 1, month: 1 };
    return { year, month: month + 1 };
  }

  /** True on the last calendar day of the month (Asia/Dhaka). */
  private isLastBusinessDayOfMonth() {
    const { year, month, day } = this.businessDateParts();
    return day === this.daysInMonth(year, month);
  }

  /**
   * Ensure every active/probation employee has an unpaid payroll row for the
   * given period, using their latest salary. Existing unpaid rows get salary refreshed.
   */
  async ensurePayrollsForPeriod(month: number, year: number): Promise<number> {
    const employees = await this.employeeRepo.find({
      where: [
        { status: EmployeeStatus.ACTIVE },
        { status: EmployeeStatus.PROBATION },
      ],
    });

    let touched = 0;
    for (const emp of employees) {
      const baseSalary = Number(emp.salary) || 0;
      const role =
        emp.role === 'Other' ? emp.customRole || emp.role : emp.role;

      let existing = await this.repo.findOne({
        where: { employeeId: emp.id, month, year },
      });
      if (!existing) {
        existing = await this.repo
          .createQueryBuilder('p')
          .leftJoin('p.employee', 'employee')
          .where('employee.id = :id AND p.month = :month AND p.year = :year', {
            id: emp.id,
            month,
            year,
          })
          .getOne();
      }

      if (!existing) {
        await this.repo.save(
          this.repo.create({
            employeeId: emp.id,
            employeeName: emp.name,
            role,
            baseSalary,
            bonus: 0,
            deductions: 0,
            netSalary: baseSalary,
            status: PayrollStatus.PENDING,
            month,
            year,
          }),
        );
        touched++;
        continue;
      }

      if (existing.status === PayrollStatus.PAID) continue;

      const needsUpdate =
        Number(existing.baseSalary) !== baseSalary ||
        existing.employeeName !== emp.name ||
        existing.role !== role ||
        !existing.employeeId;

      if (needsUpdate) {
        existing.employeeId = emp.id;
        existing.employeeName = emp.name;
        existing.role = role;
        existing.baseSalary = baseSalary;
        await this.repo.save(existing);
        touched++;
      }
    }

    if (touched > 0) {
      await this.invalidateCache();
      this.logger.log(
        `Ensured payrolls for ${month}/${year}: ${touched} row(s) created/updated`,
      );
    }
    return touched;
  }

  /**
   * On the last day of the current month, make next-month payrolls available
   * with each employee's latest salary.
   */
  async ensureNextMonthPayrollsIfLastDay(force = false): Promise<number> {
    if (!force && !this.isLastBusinessDayOfMonth()) return 0;
    const { year, month } = this.businessMonthYear();
    const next = this.nextPeriod(year, month);
    return this.ensurePayrollsForPeriod(next.month, next.year);
  }

  async findAll(month?: number, year?: number, page = 1, limit = 10, search?: string, status?: string) {
    // Last day of month → next month payrolls must exist with live salaries
    try {
      await this.ensureNextMonthPayrollsIfLastDay();
    } catch (err) {
      this.logger.error('Failed to ensure next-month payrolls:', err);
    }

    const key = this.cacheKey(month, year, page, limit, search, status);
    const cached = cursorRequest() ? undefined : await this.cacheManager.get<{ data: Payroll[]; total: number; page: number; limit: number; totalPages: number }>(key);
    if (cached) return cached;

    const where: { month?: number; year?: number; status?: PayrollStatus; employeeName?: FindOperator<string> } = {};
    if (month !== undefined && month !== null) where.month = month;
    if (year !== undefined && year !== null) where.year = year;
    if (status) where.status = status as PayrollStatus;
    if (search) where.employeeName = ILike(`%${search}%`);

    const skip = (page - 1) * limit;
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { year: 'DESC', month: 'DESC', employeeName: 'ASC' },
      skip: cursorRequest() ? undefined : skip,
      take: cursorRequest() ? undefined : limit,
      relations: { employee: true },
    });

    const { month: curMonth, year: curYear } = this.businessMonthYear();

    // Unpaid current/future rows always show live employee.salary
    const enriched = data.map((p) => {
      const empSalary = Number((p as any).employee?.salary);
      if (!Number.isFinite(empSalary) || empSalary < 0) return p;

      const isCurrentOrFuture =
        p.year > curYear || (p.year === curYear && p.month >= curMonth);
      if (!isCurrentOrFuture || p.status === PayrollStatus.PAID) return p;

      const bonus = Number(p.bonus) || 0;
      const deductions = Number(p.deductions) || 0;
      return {
        ...p,
        baseSalary: empSalary,
        netSalary: empSalary + bonus - deductions,
      };
    });

    const result = { data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
    if (!cursorRequest()) {
      await this.cacheManager.set(key, result, CACHE_TTL);
      this.activeKeys.add(key);
    }
    return result;
  }

  async findOne(id: string) {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Payroll record #${id} not found`);
    return record;
  }

  async create(dto: CreatePayrollDto) {
    const record = this.repo.create({
      ...dto,
      payDate: dto.status === PayrollStatus.PAID ? dto.payDate || undefined : undefined,
    });
    const saved = await this.repo.save(record);
    await this.syncPayrollFinance(saved, undefined);
    await this.invalidateCache();
    return saved;
  }

  async update(id: string, dto: UpdatePayrollDto) {
    const record = await this.findOne(id);
    const previousStatus = record.status;
    Object.assign(record, dto);
    if (dto.status === PayrollStatus.PENDING || dto.payDate === '') {
      record.payDate = null;
    }
    if (dto.status === PayrollStatus.PAID && !record.payDate) {
      record.payDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    }
    const saved = await this.repo.save(record);
    await this.syncPayrollFinance(saved, previousStatus);
    await this.invalidateCache();
    return saved;
  }

  /**
   * Paid → creates/updates Finance expense. Pending (or any non-Paid) after Paid → removes it.
   */
  private async syncPayrollFinance(
    payroll: Payroll,
    previousStatus: PayrollStatus | undefined,
  ) {
    const wasPaid = previousStatus === PayrollStatus.PAID;
    const isPaid = payroll.status === PayrollStatus.PAID;

    if (isPaid) {
      try {
        const entry = await this.financeService.syncSalaryExpenseAmount(payroll);
        if (entry && !wasPaid) {
          this.logger.log(
            `Created Employee Salary expense ${entry.id} for payroll ${payroll.id} (${payroll.employeeName})`,
          );
        }
      } catch (err) {
        this.logger.error(`Failed to sync salary expense for payroll ${payroll.id}:`, err);
        throw err;
      }
      return;
    }

    if (wasPaid) {
      try {
        const removed = await this.financeService.removeSalaryExpenseForPayroll(payroll.id);
        if (removed) {
          this.logger.log(
            `Removed Employee Salary expense for payroll ${payroll.id} (${payroll.employeeName}) — reverted to ${payroll.status}`,
          );
        }
      } catch (err) {
        this.logger.error(`Failed to remove salary expense for payroll ${payroll.id}:`, err);
        throw err;
      }
    }
  }

  async remove(id: string) {
    const record = await this.findOne(id);
    // Unconditional: a non-Paid row can still own a leftover expense from an earlier Paid state.
    await this.financeService.removeSalaryExpenseForPayroll(record.id);
    await this.repo.remove(record);
    await this.invalidateCache();
  }

  async addServiceCommission(
    employeeId: string,
    employeeName: string,
    role: string,
    baseSalary: number,
    commissionAmount: number,
    month: number,
    year: number,
  ) {
    if (commissionAmount <= 0) return;

    const existing = await this.repo.findOne({ where: { employeeId, month, year } });
    this.logger.log(`[Payroll] addServiceCommission: employee=${employeeId} (${employeeName}), amount=${commissionAmount}, ${month}/${year}, existingRecord=${existing?.id ?? 'none'}`);

    if (existing) {
      const newBonus = Number(existing.bonus) + commissionAmount;
      const newNetSalary = Number(existing.baseSalary) + newBonus - Number(existing.deductions);
      // Use update() instead of save() to avoid TypeORM treating the unloaded
      // `employee` relation as null and triggering a NOT NULL FK constraint error.
      await this.repo.update({ id: existing.id }, { bonus: newBonus, netSalary: newNetSalary });
      this.logger.log(`[Payroll] updated existing record ${existing.id}: bonus=${newBonus}, netSalary=${newNetSalary}`);

      // If this payroll was already Paid, its Finance expense was recorded at the old
      // (lower) netSalary — sync it so the commission doesn't vanish from the books.
      if (existing.status === PayrollStatus.PAID) {
        try {
          await this.financeService.syncSalaryExpenseAmount({
            ...existing,
            netSalary: newNetSalary,
          } as Payroll);
          this.logger.log(`[Payroll] synced Finance expense for already-Paid payroll ${existing.id} to ${newNetSalary}`);
        } catch (err) {
          this.logger.error(`[Payroll] failed to sync Finance expense for already-Paid payroll ${existing.id}:`, err);
        }
      }
    } else {
      const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
      if (!employee) {
        this.logger.warn(`[Payroll] employee ${employeeId} not found, skipping payroll create`);
        return;
      }
      await this.repo.save(this.repo.create({
        employee,
        employeeId,
        employeeName,
        role,
        baseSalary,
        bonus: commissionAmount,
        deductions: 0,
        netSalary: baseSalary + commissionAmount,
        status: PayrollStatus.PENDING,
        month,
        year,
      }));
      this.logger.log(`[Payroll] created new payroll record for ${employeeName} (${month}/${year})`);
    }

    // Ensure common cache keys for this period are always cleared, even if
    // findAll was never called in this server session.
    for (let p = 1; p <= 5; p++) {
      this.activeKeys.add(this.cacheKey(month, year, p, 10));
    }
    this.activeKeys.add(this.cacheKey(undefined, undefined, 1, 10));
    await this.invalidateCache();
    this.logger.log(`[Payroll] cache invalidated after commission write`);
  }

  private async invalidateCache() {
    try {
      await Promise.all([...this.activeKeys].map(k => this.cacheManager.del(k)));
      this.activeKeys.clear();
    } catch (err) {
      this.logger.error('Failed to invalidate payroll cache:', err);
    }
  }

  /**
   * Automated task: on the last day of each month (Asia/Dhaka), create/refresh
   * next-month payrolls with each employee's latest salary.
   */
  @TenantCron('5 0 * * *', { timeZone: 'Asia/Dhaka' })
  async handleAutoPayrollGenerationMorning() {
    await this.handleAutoPayrollGeneration(false);
  }

  @TenantCron('0 12 * * *', { timeZone: 'Asia/Dhaka' })
  async handleAutoPayrollGenerationNoon() {
    await this.handleAutoPayrollGeneration(false);
  }

  async handleAutoPayrollGeneration(force = false) {
    this.logger.log('Checking next-month payroll availability (last-day rule)...');
    const touched = await this.ensureNextMonthPayrollsIfLastDay(force);
    if (touched > 0) {
      this.logger.log(`Next-month payroll ensure complete (${touched} rows).`);
    } else {
      this.logger.log('No next-month payroll changes needed (not last day, or already up to date).');
    }
  }

  /**
   * Syncs employee data (name, role, salary) to unpaid payrolls for the
   * current month and all upcoming months. Past months and Paid rows stay as-is.
   */
  async syncEmployeeDataInPayrolls(employee: Employee) {
    this.logger.log(`Syncing employee data for ${employee.name} in current/future payrolls...`);
    const { month: currentMonth, year: currentYear } = this.businessMonthYear();
    const newBase = Number(employee.salary) || 0;

    const payrolls = await this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.employee', 'employee')
      .where('p.employeeId = :id OR employee.id = :id', { id: employee.id })
      .getMany();

    const toUpdate = payrolls.filter((p) => {
      const isCurrentOrFuture =
        p.year > currentYear || (p.year === currentYear && p.month >= currentMonth);
      if (!isCurrentOrFuture) return false;
      if (p.status === PayrollStatus.PAID) return false;
      return true;
    });

    if (toUpdate.length > 0) {
      for (const p of toUpdate) {
        p.employeeName = employee.name;
        p.role = employee.role === 'Other' ? (employee.customRole || employee.role) : employee.role;
        p.baseSalary = newBase;
        if (!p.employeeId) p.employeeId = employee.id;
        // netSalary recalculated by @BeforeUpdate
      }
      await this.repo.save(toUpdate);
      this.logger.log(`Synced ${toUpdate.length} payroll records for ${employee.name}.`);
    }
    // Always bust cache — even if no rows updated, findAll live-overlay must not stay stale
    await this.invalidateCache();
  }
}
