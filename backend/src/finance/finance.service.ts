import { cursorRequest } from '../common/pagination/cursor.js';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import {
  FinanceEntry,
  FinanceEntryType,
  PayrollExpenseComponent,
} from './entities/finance-entry.entity.js';
import {
  FinanceCategory,
  FinanceCategoryStatus,
  FinanceCategoryType,
} from './entities/finance-category.entity.js';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto.js';
import { UpdateFinanceEntryDto } from './dto/update-finance-entry.dto.js';
import { Invoice, InvoiceStatus } from '../invoice/entities/invoice.entity.js';
import { Payroll, PayrollStatus } from '../payroll/entities/payroll.entity.js';
import {
  FALLBACK_EXPENSE_CODE,
  MONTH_TABLE_LABELS,
  SYSTEM_FINANCE_CATEGORIES,
  categorizeIncomeEntryCode,
  categorizeExpenseEntryCode,
  findSystemSeedByName,
  isPayrollOwnedExpenseCode,
  isPayrollOwnedExpenseName,
  normalizeCategoryName,
  type FinanceCategoryCode,
} from './finance-categories.js';

export type FinanceTrendRange =
  | 'this_year'
  | 'last_6_months'
  | 'last_3_months'
  | 'this_month';

const BUSINESS_TIME_ZONE = 'Asia/Dhaka';
const BUSINESS_TIME_OFFSET_HOURS = 6;

const MONTH_SHORT = MONTH_TABLE_LABELS;

export type FinanceTransactionType = 'all' | 'income' | 'expense';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @InjectRepository(FinanceEntry)
    private readonly financeRepo: Repository<FinanceEntry>,
    @InjectRepository(FinanceCategory)
    private readonly categoryRepo: Repository<FinanceCategory>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Payroll)
    private readonly payrollRepo: Repository<Payroll>,
  ) {}

  private toBusinessDateStr(date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private businessDayStart(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const startUtc =
      Date.UTC(year, month - 1, day, 0, 0, 0, 0) -
      BUSINESS_TIME_OFFSET_HOURS * 60 * 60 * 1000;
    return new Date(startUtc);
  }

  private businessDayEnd(dateStr: string): Date {
    const start = this.businessDayStart(dateStr);
    return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  private invoiceCollected(inv: Invoice): number {
    if (inv.status === InvoiceStatus.PAID) return Number(inv.total || 0);
    if (inv.status === InvoiceStatus.PARTIAL) return Number(inv.paidAmount || 0);
    return 0;
  }

  private dateKeyFromInvoice(inv: Invoice): string {
    const source = inv.confirmedAt || inv.createdAt;
    return this.toBusinessDateStr(new Date(source));
  }

  private buildMonthBuckets(
    range: FinanceTrendRange,
    year?: number,
  ): {
    key: string;
    label: string;
    from: string;
    to: string;
  }[] {
    const today = this.toBusinessDateStr();
    const [currentY, currentM] = today.split('-').map(Number);
    const y = year && year > 2000 ? year : currentY;
    const isCurrentYear = y === currentY;
    const anchorMonth = isCurrentYear ? currentM : 12;
    const months: { year: number; month: number }[] = [];

    switch (range) {
      case 'this_month':
        months.push({ year: y, month: anchorMonth });
        break;
      case 'last_3_months':
        for (let i = 2; i >= 0; i--) {
          const month = anchorMonth - i;
          if (month >= 1) months.push({ year: y, month });
        }
        break;
      case 'last_6_months':
        for (let i = 5; i >= 0; i--) {
          const month = anchorMonth - i;
          if (month >= 1) months.push({ year: y, month });
        }
        break;
      case 'this_year':
      default:
        for (let month = 1; month <= anchorMonth; month++) {
          months.push({ year: y, month });
        }
        break;
    }

    return months.map(({ year: yy, month }) => {
      const from = `${yy}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(yy, month, 0)).getUTCDate();
      let to = `${yy}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      if (yy === currentY && to > today) to = today;
      return {
        key: `${yy}-${String(month).padStart(2, '0')}`,
        label: MONTH_SHORT[month - 1],
        from,
        to,
      };
    });
  }

  /**
   * Paid payroll → one Finance expense under Employee Salary using netSalary
   * (base + bonus − deductions). Any previous separate bonus row is removed.
   */
  async createExpenseFromPayroll(payroll: Payroll): Promise<FinanceEntry | null> {
    if (payroll.status !== PayrollStatus.PAID) return null;
    return this.syncSalaryExpenseAmount(payroll);
  }

  /**
   * Keeps a single Employee Salary finance expense in sync with a Paid payroll's netSalary.
   */
  async syncSalaryExpenseAmount(payroll: Payroll): Promise<FinanceEntry | null> {
    if (payroll.status !== PayrollStatus.PAID) return null;

    const amount = Math.max(0, Number(payroll.netSalary) || 0);
    const monthLabel =
      MONTH_SHORT[Math.max(0, Math.min(11, (payroll.month || 1) - 1))] ?? 'Unknown';
    const payDate = (payroll.payDate || this.toBusinessDateStr()).slice(0, 10);
    const salaryCategory =
      (await this.displayNameForCode('employee_salary')) ?? 'Employee Salary & Bonus';

    // Drop any separate bonus rows — salary + bonus are merged into one expense.
    const bonusRows = await this.financeRepo.find({
      where: {
        sourcePayrollId: payroll.id,
        sourcePayrollComponent: PayrollExpenseComponent.BONUS,
      },
    });
    if (bonusRows.length > 0) {
      await this.financeRepo.remove(bonusRows);
    }

    // Normalize legacy / salary component rows into a single salary entry.
    const related = await this.financeRepo.find({
      where: { sourcePayrollId: payroll.id },
    });
    let salaryEntry =
      related.find((e) => e.sourcePayrollComponent === PayrollExpenseComponent.SALARY) ??
      related.find((e) => !e.sourcePayrollComponent) ??
      null;

    // If multiple leftover rows somehow exist, keep one and remove the rest.
    const extras = related.filter((e) => e.id !== salaryEntry?.id);
    if (extras.length > 0) {
      await this.financeRepo.remove(extras);
    }

    if (amount <= 0) {
      if (salaryEntry) await this.financeRepo.remove(salaryEntry);
      return null;
    }

    if (!salaryEntry) {
      return this.savePayrollExpense({
        payroll,
        component: PayrollExpenseComponent.SALARY,
        category: salaryCategory,
        title: `Employee Salary & Bonus — ${payroll.employeeName}`,
        description: `Payroll disbursement for ${monthLabel} ${payroll.year} (${payroll.role})`,
        amount,
        date: payDate,
      });
    }

    let dirty = false;
    if (salaryEntry.sourcePayrollComponent !== PayrollExpenseComponent.SALARY) {
      salaryEntry.sourcePayrollComponent = PayrollExpenseComponent.SALARY;
      dirty = true;
    }
    if (Math.abs(Number(salaryEntry.amount) - amount) > 0.009) {
      salaryEntry.amount = amount;
      dirty = true;
    }
    if (salaryEntry.category !== salaryCategory) {
      salaryEntry.category = salaryCategory;
      dirty = true;
    }
    if (salaryEntry.title !== `Employee Salary & Bonus — ${payroll.employeeName}`) {
      salaryEntry.title = `Employee Salary & Bonus — ${payroll.employeeName}`;
      dirty = true;
    }
    const nextDescription = `Payroll disbursement for ${monthLabel} ${payroll.year} (${payroll.role})`;
    if (salaryEntry.description !== nextDescription) {
      salaryEntry.description = nextDescription;
      dirty = true;
    }
    if (salaryEntry.date !== payDate) {
      salaryEntry.date = payDate;
      dirty = true;
    }
    return dirty ? this.financeRepo.save(salaryEntry) : salaryEntry;
  }

  private async savePayrollExpense(args: {
    payroll: Payroll;
    component: PayrollExpenseComponent;
    category: string;
    title: string;
    description: string;
    amount: number;
    date: string;
  }): Promise<FinanceEntry> {
    const entry = this.financeRepo.create({
      type: FinanceEntryType.EXPENSE,
      title: args.title,
      description: args.description,
      category: args.category,
      amount: args.amount,
      date: args.date,
      sourcePayrollId: args.payroll.id,
      sourcePayrollComponent: args.component,
    });

    try {
      return await this.financeRepo.save(entry);
    } catch (err: any) {
      if (err?.code === '23505') {
        const raced = await this.financeRepo.findOne({
          where: {
            sourcePayrollId: args.payroll.id,
            sourcePayrollComponent: args.component,
          },
        });
        if (raced) {
          raced.amount = args.amount;
          raced.category = args.category;
          raced.title = args.title;
          raced.description = args.description;
          raced.date = args.date;
          return this.financeRepo.save(raced);
        }
      }
      throw err;
    }
  }

  /**
   * Removes auto-created salary + bonus expenses when a payroll is no longer Paid.
   * Returns true if any entry was deleted.
   */
  async removeSalaryExpenseForPayroll(payrollId: string): Promise<boolean> {
    const existing = await this.financeRepo.find({
      where: { sourcePayrollId: payrollId },
    });
    if (existing.length === 0) return false;
    await this.financeRepo.remove(existing);
    return true;
  }

  /**
   * Makes the ledger match Manage Payroll exactly: every Paid payroll owns one salary
   * expense at its current netSalary, and every payroll-sourced expense whose payroll is
   * gone (employee deleted → `ON DELETE CASCADE` drops payroll rows without ever reaching
   * PayrollService.remove) or no longer Paid is deleted. Without this, those orphans keep
   * inflating Employee Salary & Bonus even when nothing is marked Paid.
   */
  async reconcilePayrollExpenses(): Promise<{
    synced: number;
    removed: number;
  }> {
    const [payrollEntries, paidPayrolls] = await Promise.all([
      this.financeRepo.find({ where: { sourcePayrollId: Not(IsNull()) } }),
      this.payrollRepo.find({ where: { status: PayrollStatus.PAID } }),
    ]);

    const paidIds = new Set(paidPayrolls.map((p) => p.id));
    const stale = payrollEntries.filter(
      (entry) => !entry.sourcePayrollId || !paidIds.has(entry.sourcePayrollId),
    );
    if (stale.length > 0) {
      await this.financeRepo.remove(stale);
      this.logger.warn(
        `Removed ${stale.length} salary expense(s) with no matching Paid payroll.`,
      );
    }

    let synced = 0;
    for (const payroll of paidPayrolls) {
      const entry = await this.syncSalaryExpenseAmount(payroll);
      if (entry) synced += 1;
    }

    return { synced, removed: stale.length };
  }

  /**
   * The business date a Paid payroll hits the books on — its pay date, or the first of
   * the payroll month when it was marked Paid without one.
   */
  private payrollExpenseDate(payroll: Payroll): string {
    const payDate = String(payroll.payDate ?? '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(payDate)) return payDate;
    const month = Math.min(12, Math.max(1, Number(payroll.month) || 1));
    return `${payroll.year}-${String(month).padStart(2, '0')}-01`;
  }

  /**
   * Employee Salary & Bonus, straight from Manage Payroll: `SUM(netSalary)` over payrolls
   * marked Paid, dated by pay date. Unpaid/Pending/Processing rows contribute nothing, so
   * the total is 0 whenever nothing is marked Paid.
   */
  private async paidPayrollExpenses(
    from: string,
    to: string,
  ): Promise<{ date: string; amount: number }[]> {
    const paid = await this.payrollRepo.find({
      where: { status: PayrollStatus.PAID },
    });
    return paid
      .map((payroll) => ({
        date: this.payrollExpenseDate(payroll),
        amount: Math.max(0, Number(payroll.netSalary) || 0),
      }))
      .filter((row) => row.amount > 0 && row.date >= from && row.date <= to);
  }

  /**
   * Manual ledger rows only. Salary is counted from Manage Payroll via
   * `paidPayrollExpenses`, so the auto-created payroll rows must be dropped here or the
   * same money would be counted twice.
   */
  private manualEntries(entries: FinanceEntry[]): FinanceEntry[] {
    return entries.filter((entry) => !entry.sourcePayrollId);
  }

  /** Keeps payroll-sourced rows only while their payroll still exists and is Paid. */
  private async withLivePayrollEntries(
    entries: FinanceEntry[],
  ): Promise<FinanceEntry[]> {
    const payrollIds = [
      ...new Set(
        entries
          .map((entry) => entry.sourcePayrollId)
          .filter((id): id is string => !!id),
      ),
    ];
    if (payrollIds.length === 0) return entries;

    const paid = await this.payrollRepo.find({
      where: { id: In(payrollIds), status: PayrollStatus.PAID },
      select: { id: true },
    });
    const paidIds = new Set(paid.map((p) => p.id));
    return entries.filter(
      (entry) => !entry.sourcePayrollId || paidIds.has(entry.sourcePayrollId),
    );
  }

  async getOverview(year?: number) {
    const today = this.toBusinessDateStr();
    const currentYear = Number(today.slice(0, 4));
    const y = year && year > 2000 ? year : currentYear;
    const from = `${y}-01-01`;
    const to = y === currentYear ? today : `${y}-12-31`;

    // Same window previous year (YTD ↔ YTD when viewing the current year)
    const prevYear = y - 1;
    const prevFrom = `${prevYear}-01-01`;
    const prevTo =
      y === currentYear
        ? `${prevYear}-${today.slice(5)}`
        : `${prevYear}-12-31`;

    const [currentTotals, previousTotals] = await Promise.all([
      this.computePeriodTotals(from, to, y),
      this.computePeriodTotals(prevFrom, prevTo, prevYear),
    ]);

    const netBalance = currentTotals.totalIncome - currentTotals.totalExpense;
    const previousNet =
      previousTotals.totalIncome - previousTotals.totalExpense;
    const yoy = this.netBalanceYoY(netBalance, previousNet);

    return {
      year: y,
      totalIncome: Math.round(currentTotals.totalIncome),
      totalExpense: Math.round(currentTotals.totalExpense),
      netBalance: Math.round(netBalance),
      entriesLogged: currentTotals.entriesLogged,
      profitable: netBalance >= 0,
      periodLabel: String(y),
      previousYear: prevYear,
      previousNetBalance: Math.round(previousNet),
      netYoYPercent: yoy.percent,
      netYoYDirection: yoy.direction,
      netYoYLabel: yoy.label,
    };
  }

  private async computePeriodTotals(
    from: string,
    to: string,
    yearHint: number,
  ): Promise<{
    totalIncome: number;
    totalExpense: number;
    entriesLogged: number;
  }> {
    const fromDate = this.businessDayStart(from);
    const toDate = this.businessDayEnd(to);

    const [allEntries, invoices, payrollExpenses] = await Promise.all([
      this.financeRepo
        .createQueryBuilder('e')
        .where('e.date >= :from AND e.date <= :to', { from, to })
        .getMany(),
      this.invoiceRepo
        .createQueryBuilder('i')
        .where(
          '(i.confirmedAt BETWEEN :fromDate AND :toDate) OR (i.confirmedAt IS NULL AND i.createdAt BETWEEN :fromDate AND :toDate)',
          { fromDate, toDate },
        )
        .getMany(),
      this.paidPayrollExpenses(from, to),
    ]);

    // Salary comes from Paid payrolls below, never from the ledger's payroll rows.
    const entries = this.manualEntries(allEntries);

    let totalIncome = 0;
    let totalExpense = 0;
    let invoiceIncomeCount = 0;

    for (const entry of entries) {
      const amount = Number(entry.amount) || 0;
      if (entry.type === FinanceEntryType.INCOME) totalIncome += amount;
      else totalExpense += amount;
    }

    for (const payroll of payrollExpenses) {
      totalExpense += payroll.amount;
    }

    for (const inv of invoices) {
      const dateKey = this.dateKeyFromInvoice(inv);
      if (!dateKey.startsWith(String(yearHint))) continue;
      const collected = this.invoiceCollected(inv);
      if (collected <= 0) continue;
      totalIncome += collected;
      invoiceIncomeCount += 1;
    }

    return {
      totalIncome,
      totalExpense,
      entriesLogged: entries.length + payrollExpenses.length + invoiceIncomeCount,
    };
  }

  private netBalanceYoY(
    currentNet: number,
    previousNet: number,
  ): {
    percent: number | null;
    direction: 'higher' | 'lower' | 'same' | null;
    label: string;
  } {
    const curr = Math.round(currentNet);
    const prev = Math.round(previousNet);

    if (prev === 0 && curr === 0) {
      return {
        percent: 0,
        direction: 'same',
        label: 'Same as previous year',
      };
    }

    if (prev === 0) {
      return {
        percent: null,
        direction: curr > 0 ? 'higher' : 'lower',
        label:
          curr > 0
            ? 'Higher than previous year'
            : 'Lower than previous year',
      };
    }

    const raw = ((curr - prev) / Math.abs(prev)) * 100;
    const percent = Math.round(Math.abs(raw));

    if (Math.abs(raw) < 0.5) {
      return {
        percent: 0,
        direction: 'same',
        label: 'Same as previous year',
      };
    }

    if (raw > 0) {
      return {
        percent,
        direction: 'higher',
        label: `${percent}% higher than previous year`,
      };
    }

    return {
      percent,
      direction: 'lower',
      label: `${percent}% lower than previous year`,
    };
  }

  async getTrend(range: FinanceTrendRange = 'this_year', year?: number) {
    const buckets = this.buildMonthBuckets(range, year);
    if (buckets.length === 0) {
      return { range, year: year ?? null, points: [], maxValue: 0 };
    }

    const from = buckets[0].from;
    const to = buckets[buckets.length - 1].to;
    const fromDate = this.businessDayStart(from);
    const toDate = this.businessDayEnd(to);

    const [allEntries, invoices, payrollExpenses] = await Promise.all([
      this.financeRepo
        .createQueryBuilder('e')
        .where('e.date >= :from AND e.date <= :to', { from, to })
        .getMany(),
      this.invoiceRepo
        .createQueryBuilder('i')
        .where(
          '(i.confirmedAt BETWEEN :fromDate AND :toDate) OR (i.confirmedAt IS NULL AND i.createdAt BETWEEN :fromDate AND :toDate)',
          { fromDate, toDate },
        )
        .getMany(),
      this.paidPayrollExpenses(from, to),
    ]);

    const entries = this.manualEntries(allEntries);

    const points = buckets.map((bucket) => {
      let income = 0;
      let expense = 0;

      for (const entry of entries) {
        const d = String(entry.date).slice(0, 10);
        if (d < bucket.from || d > bucket.to) continue;
        const amount = Number(entry.amount) || 0;
        if (entry.type === FinanceEntryType.INCOME) income += amount;
        else expense += amount;
      }

      for (const payroll of payrollExpenses) {
        if (payroll.date < bucket.from || payroll.date > bucket.to) continue;
        expense += payroll.amount;
      }

      for (const inv of invoices) {
        const d = this.dateKeyFromInvoice(inv);
        if (d < bucket.from || d > bucket.to) continue;
        income += this.invoiceCollected(inv);
      }

      return {
        key: bucket.key,
        label: bucket.label,
        income: Math.round(income),
        expense: Math.round(expense),
      };
    });

    const maxValue = Math.max(
      0,
      ...points.flatMap((p) => [p.income, p.expense]),
    );

    return {
      range,
      year: Number(buckets[0].key.slice(0, 4)),
      points,
      maxValue,
    };
  }

  async findAll(page = 1, limit = 50) {
    const [data, total] = await this.financeRepo.findAndCount({
      order: { date: 'DESC', createdAt: 'DESC' },
      skip: cursorRequest() ? undefined : (page - 1) * limit,
      take: cursorRequest() ? undefined : limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async create(dto: CreateFinanceEntryDto) {
    await this.assertCategoryIsManual(dto.category);
    const entry = this.financeRepo.create({
      type: dto.type,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      category: dto.category?.trim() || null,
      amount: dto.amount,
      date: dto.date.slice(0, 10),
    });
    return this.financeRepo.save(entry);
  }

  /**
   * Employee Salary & Bonus is written only by Manage Payroll — a manual entry there would
   * put salary expense on the books that no payroll ever paid.
   */
  private async assertCategoryIsManual(category?: string | null) {
    const name = category?.trim();
    if (!name) return;

    const expenseCategories = await this.loadCategories(
      FinanceCategoryType.EXPENSE,
    );
    if (!this.isPayrollOwnedCategory(name, expenseCategories)) return;

    throw new BadRequestException(
      `"${name}" is managed automatically from Manage Payroll — mark the payroll as Paid instead of adding a manual entry.`,
    );
  }

  async update(id: string, dto: UpdateFinanceEntryDto) {
    const entry = await this.financeRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Finance entry not found');
    if (dto.category !== undefined) await this.assertCategoryIsManual(dto.category);
    if (dto.type !== undefined) entry.type = dto.type;
    if (dto.title !== undefined) entry.title = dto.title.trim();
    if (dto.description !== undefined)
      entry.description = dto.description?.trim() || null;
    if (dto.category !== undefined) entry.category = dto.category?.trim() || null;
    if (dto.amount !== undefined) entry.amount = dto.amount;
    if (dto.date !== undefined) entry.date = dto.date.slice(0, 10);
    return this.financeRepo.save(entry);
  }

  async remove(id: string) {
    const entry = await this.financeRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Finance entry not found');
    await this.financeRepo.remove(entry);
    return { success: true };
  }

  private yearMonthKey(year: number, month: number) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private monthIndexFromDate(dateStr: string) {
    return Number(dateStr.slice(5, 7)) - 1;
  }

  private emptyMonthArray() {
    return Array.from({ length: 12 }, () => 0);
  }

  private async loadCategories(type: FinanceCategoryType): Promise<FinanceCategory[]> {
    return this.categoryRepo.find({
      where: { type },
      order: { name: 'ASC' },
    });
  }

  private async displayNameForCode(code: FinanceCategoryCode): Promise<string | null> {
    const row = await this.categoryRepo.findOne({ where: { code } });
    return row?.name ?? null;
  }

  private resolveCategoryByStoredOrCode(
    stored: string | null | undefined,
    categories: FinanceCategory[],
    guessedCode: FinanceCategoryCode,
  ): string {
    const names = categories.map((c) => c.name);

    if (stored?.trim()) {
      const exact = categories.find((c) => c.name === stored.trim());
      if (exact) return exact.name;

      // Historical name / alias → current system display name
      const seed = findSystemSeedByName(stored);
      if (seed) {
        const byCode = categories.find((c) => c.code === seed.code);
        if (byCode) return byCode.name;
      }

      const needle = normalizeCategoryName(stored);
      const fuzzy = categories.find(
        (c) => normalizeCategoryName(c.name) === needle,
      );
      if (fuzzy) return fuzzy.name;

      return stored.trim();
    }

    const byCode = categories.find((c) => c.code === guessedCode);
    if (byCode) return byCode.name;

    return names[0] ?? guessedCode;
  }

  private resolveIncomeCategory(
    entry: FinanceEntry,
    incomeCategories: FinanceCategory[],
  ): string {
    return this.resolveCategoryByStoredOrCode(
      entry.category,
      incomeCategories,
      categorizeIncomeEntryCode(entry.title, entry.description),
    );
  }

  private resolveExpenseCategory(
    entry: FinanceEntry,
    expenseCategories: FinanceCategory[],
  ): string {
    const resolved = this.resolveCategoryByStoredOrCode(
      entry.category,
      expenseCategories,
      categorizeExpenseEntryCode(entry.title, entry.description),
    );

    // Employee Salary & Bonus is reported straight from Manage Payroll. A manual entry
    // filed under it (older data, or a category renamed after the fact) is shown as a
    // plain expense instead — its money still counts, just not as payroll spend.
    if (!entry.sourcePayrollId && this.isPayrollOwnedCategory(resolved, expenseCategories)) {
      return this.fallbackExpenseCategoryName(expenseCategories);
    }
    return resolved;
  }

  /** True when `name` is the current or historical name of a payroll-owned category. */
  private isPayrollOwnedCategory(
    name: string,
    expenseCategories: FinanceCategory[],
  ): boolean {
    const match = expenseCategories.find(
      (c) => normalizeCategoryName(c.name) === normalizeCategoryName(name),
    );
    if (match?.code) return isPayrollOwnedExpenseCode(match.code);
    return isPayrollOwnedExpenseName(name);
  }

  private fallbackExpenseCategoryName(
    expenseCategories: FinanceCategory[],
  ): string {
    const byCode = expenseCategories.find(
      (c) => c.code === FALLBACK_EXPENSE_CODE,
    );
    if (byCode) return byCode.name;
    const seed = SYSTEM_FINANCE_CATEGORIES.find(
      (s) => s.code === FALLBACK_EXPENSE_CODE,
    );
    return seed?.name ?? 'Other Expense';
  }

  /** Paid invoices → service_revenue; partial → due_collection (by code, not name). */
  private pickInvoiceIncomeCategory(
    inv: Invoice,
    incomeCategories: FinanceCategory[],
  ): string {
    const code: FinanceCategoryCode =
      inv.status === InvoiceStatus.PARTIAL ? 'due_collection' : 'service_revenue';
    const match = incomeCategories.find((c) => c.code === code);
    if (match) return match.name;

    const seed = SYSTEM_FINANCE_CATEGORIES.find((s) => s.code === code);
    const aliases = seed ? [seed.name, ...seed.aliases] : [];
    const byAlias = incomeCategories.find((c) =>
      aliases.some(
        (a) => normalizeCategoryName(a) === normalizeCategoryName(c.name),
      ),
    );
    if (byAlias) return byAlias.name;

    return incomeCategories[0]?.name ?? (seed?.name ?? code);
  }

  async getMonthlySummary(year?: number) {
    const today = this.toBusinessDateStr();
    const currentYear = Number(today.slice(0, 4));
    const y = year && year > 2000 ? year : currentYear;
    const from = `${y}-01-01`;
    const to = `${y}-12-31`;
    const fromDate = this.businessDayStart(from);
    const toDate = this.businessDayEnd(to > today ? today : to);

    const categories = await this.categoryRepo.find({
      order: { type: 'ASC', name: 'ASC' },
    });
    const incomeCategories = categories.filter(
      (c) => c.type === FinanceCategoryType.INCOME,
    );
    const expenseCategories = categories.filter(
      (c) => c.type === FinanceCategoryType.EXPENSE,
    );
    const activeIncome = incomeCategories
      .filter((c) => c.status === FinanceCategoryStatus.ACTIVE)
      .map((c) => c.name);
    const activeExpense = expenseCategories
      .filter((c) => c.status === FinanceCategoryStatus.ACTIVE)
      .map((c) => c.name);
    const allIncomeNames = incomeCategories.map((c) => c.name);
    const allExpenseNames = expenseCategories.map((c) => c.name);

    const incomeRows: Record<string, number[]> = Object.fromEntries(
      allIncomeNames.map((label) => [label, this.emptyMonthArray()]),
    );
    const expenseRows: Record<string, number[]> = Object.fromEntries(
      allExpenseNames.map((label) => [label, this.emptyMonthArray()]),
    );

    const [allEntries, invoices, payrollExpenses] = await Promise.all([
      this.financeRepo
        .createQueryBuilder('e')
        .where('e.date >= :from AND e.date <= :to', { from, to: to > today ? today : to })
        .getMany(),
      this.invoiceRepo
        .createQueryBuilder('i')
        .where(
          '(i.confirmedAt BETWEEN :fromDate AND :toDate) OR (i.confirmedAt IS NULL AND i.createdAt BETWEEN :fromDate AND :toDate)',
          { fromDate, toDate },
        )
        .getMany(),
      this.paidPayrollExpenses(from, to > today ? today : to),
    ]);

    // Salary rows come from Manage Payroll (below), so skip their ledger mirrors here.
    const entries = this.manualEntries(allEntries);

    for (const entry of entries) {
      const monthIdx = this.monthIndexFromDate(String(entry.date).slice(0, 10));
      if (monthIdx < 0 || monthIdx > 11) continue;
      const amount = Number(entry.amount) || 0;
      if (entry.type === FinanceEntryType.INCOME) {
        const cat = this.resolveIncomeCategory(entry, incomeCategories);
        if (!incomeRows[cat]) incomeRows[cat] = this.emptyMonthArray();
        incomeRows[cat][monthIdx] += amount;
      } else {
        const cat = this.resolveExpenseCategory(entry, expenseCategories);
        if (!expenseRows[cat]) expenseRows[cat] = this.emptyMonthArray();
        expenseRows[cat][monthIdx] += amount;
      }
    }

    for (const inv of invoices) {
      const dateKey = this.dateKeyFromInvoice(inv);
      if (!dateKey.startsWith(String(y))) continue;
      const monthIdx = this.monthIndexFromDate(dateKey);
      const collected = this.invoiceCollected(inv);
      if (collected <= 0) continue;
      const cat = this.pickInvoiceIncomeCategory(inv, incomeCategories);
      if (!incomeRows[cat]) incomeRows[cat] = this.emptyMonthArray();
      incomeRows[cat][monthIdx] += collected;
    }

    const roundRow = (row: number[]) => row.map((v) => Math.round(v));
    for (const label of Object.keys(incomeRows)) {
      incomeRows[label] = roundRow(incomeRows[label]);
    }
    for (const label of Object.keys(expenseRows)) {
      expenseRows[label] = roundRow(expenseRows[label]);
    }

    const salaryCat = expenseCategories.find((c) => c.code === 'employee_salary');
    const bonusCat = expenseCategories.find((c) => c.code === 'employee_bonus');
    const salaryLabel = salaryCat?.name ?? 'Employee Salary & Bonus';
    const bonusLabel = bonusCat?.name ?? 'Employee Bonus';

    // Employee Salary & Bonus = SUM(netSalary) of payrolls marked Paid in Manage Payroll.
    // Assigned, not accumulated, so nothing else can leak into this row: all Unpaid → 0.
    const salaryMonths = this.emptyMonthArray();
    for (const payroll of payrollExpenses) {
      const monthIdx = this.monthIndexFromDate(payroll.date);
      if (monthIdx < 0 || monthIdx > 11) continue;
      salaryMonths[monthIdx] += payroll.amount;
    }
    expenseRows[salaryLabel] = roundRow(salaryMonths);
    delete expenseRows[bonusLabel];

    // Show active categories always; inactive only if they have yearly activity.
    // Never show Employee Bonus as its own row — it is merged into Employee Salary.
    const incomeLabels = [
      ...activeIncome,
      ...Object.keys(incomeRows).filter(
        (label) =>
          !activeIncome.includes(label) &&
          incomeRows[label].some((v) => v !== 0),
      ),
    ];
    const expenseLabels = [
      ...activeExpense.filter(
        (label) =>
          normalizeCategoryName(label) !== normalizeCategoryName(bonusLabel),
      ),
      ...Object.keys(expenseRows).filter(
        (label) =>
          !activeExpense.includes(label) &&
          normalizeCategoryName(label) !== normalizeCategoryName(bonusLabel) &&
          expenseRows[label].some((v) => v !== 0),
      ),
    ];

    const incomeTotals = this.emptyMonthArray();
    const expenseTotals = this.emptyMonthArray();
    for (let i = 0; i < 12; i++) {
      incomeTotals[i] = incomeLabels.reduce(
        (sum, label) => sum + (incomeRows[label]?.[i] ?? 0),
        0,
      );
      expenseTotals[i] = expenseLabels.reduce(
        (sum, label) => sum + (expenseRows[label]?.[i] ?? 0),
        0,
      );
    }

    const netMonths = incomeTotals.map((inc, i) => inc - expenseTotals[i]);

    return {
      year: y,
      months: MONTH_TABLE_LABELS.map((label, index) => ({
        index,
        label,
        key: this.yearMonthKey(y, index + 1),
      })),
      income: {
        categories: incomeLabels.map((label) => ({
          label,
          months: incomeRows[label] ?? this.emptyMonthArray(),
          total: (incomeRows[label] ?? this.emptyMonthArray()).reduce((s, v) => s + v, 0),
        })),
        totals: incomeTotals,
        grandTotal: incomeTotals.reduce((s, v) => s + v, 0),
      },
      expense: {
        categories: expenseLabels.map((label) => ({
          label,
          months: expenseRows[label] ?? this.emptyMonthArray(),
          total: (expenseRows[label] ?? this.emptyMonthArray()).reduce((s, v) => s + v, 0),
        })),
        totals: expenseTotals,
        grandTotal: expenseTotals.reduce((s, v) => s + v, 0),
      },
      netBalance: {
        label: 'Income - Expense',
        months: netMonths,
        total: netMonths.reduce((s, v) => s + v, 0),
      },
    };
  }

  async getTransactions(filters: {
    search?: string;
    type?: FinanceTransactionType;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const type = filters.type ?? 'all';
    const q = (filters.search ?? '').trim().toLowerCase();

    const from = filters.from?.slice(0, 10);
    const to = filters.to?.slice(0, 10) ?? this.toBusinessDateStr();
    const fromDate = this.businessDayStart(from ?? `${to.slice(0, 4)}-01-01`);
    const toDate = this.businessDayEnd(to);

    const [allEntries, invoices, incomeCategories, expenseCategories] = await Promise.all([
      this.financeRepo
        .createQueryBuilder('e')
        .where('e.date >= :from AND e.date <= :to', {
          from: from ?? `${to.slice(0, 4)}-01-01`,
          to,
        })
        .orderBy('e.date', 'DESC')
        .addOrderBy('e.createdAt', 'DESC')
        .getMany(),
      this.invoiceRepo
        .createQueryBuilder('i')
        .where(
          '(i.confirmedAt BETWEEN :fromDate AND :toDate) OR (i.confirmedAt IS NULL AND i.createdAt BETWEEN :fromDate AND :toDate)',
          { fromDate, toDate },
        )
        .orderBy('i.createdAt', 'DESC')
        .getMany(),
      this.loadCategories(FinanceCategoryType.INCOME),
      this.loadCategories(FinanceCategoryType.EXPENSE),
    ]);

    // A salary row is a real transaction only while its payroll is still marked Paid.
    const entries = await this.withLivePayrollEntries(allEntries);

    type Tx = {
      id: string;
      date: string;
      title: string;
      description: string;
      category: string;
      type: 'income' | 'expense';
      amount: number;
      source: 'ledger' | 'invoice';
    };

    const rows: Tx[] = [];

    for (const entry of entries) {
      const txType = entry.type === FinanceEntryType.INCOME ? 'income' : 'expense';
      if (type !== 'all' && type !== txType) continue;
      const category =
        txType === 'income'
          ? this.resolveIncomeCategory(entry, incomeCategories)
          : this.resolveExpenseCategory(entry, expenseCategories);
      const title = entry.title;
      const description = entry.description ?? '';
      const haystack = `${title} ${description} ${category} ${entry.amount}`.toLowerCase();
      if (q && !haystack.includes(q)) continue;
      rows.push({
        id: entry.id,
        date: String(entry.date).slice(0, 10),
        title,
        description,
        category,
        type: txType,
        amount: Number(entry.amount) || 0,
        source: 'ledger',
      });
    }

    for (const inv of invoices) {
      const collected = this.invoiceCollected(inv);
      if (collected <= 0) continue;
      if (type !== 'all' && type !== 'income') continue;
      const category = this.pickInvoiceIncomeCategory(inv, incomeCategories);
      const title = `Invoice ${inv.invoiceNumber}`;
      const description = (inv.services ?? []).join(', ') || 'Salon services';
      const haystack = `${title} ${description} ${category} ${collected}`.toLowerCase();
      if (q && !haystack.includes(q)) continue;
      rows.push({
        id: `invoice-${inv.id}`,
        date: this.dateKeyFromInvoice(inv),
        title,
        description,
        category,
        type: 'income',
        amount: collected,
        source: 'invoice',
      });
    }

    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const total = rows.length;
    const data = cursorRequest() ? rows : rows.slice((page - 1) * limit, page * limit);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }
}
