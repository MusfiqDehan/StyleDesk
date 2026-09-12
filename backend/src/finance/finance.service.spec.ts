import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { FinanceService } from './finance.service.js';
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
import { Invoice } from '../invoice/entities/invoice.entity.js';
import { Payroll, PayrollStatus } from '../payroll/entities/payroll.entity.js';
import { SYSTEM_FINANCE_CATEGORIES } from './finance-categories.js';

const YEAR = 2026;
const SALARY_LABEL = 'Employee Salary & Bonus';

let seq = 0;
const uid = () => `id-${++seq}`;

function makeCategories(): FinanceCategory[] {
  return SYSTEM_FINANCE_CATEGORIES.map((seed) => ({
    id: uid(),
    name: seed.name,
    code: seed.code,
    isSystem: true,
    type:
      seed.type === 'income'
        ? FinanceCategoryType.INCOME
        : FinanceCategoryType.EXPENSE,
    status:
      seed.code === 'employee_bonus'
        ? FinanceCategoryStatus.INACTIVE
        : FinanceCategoryStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as FinanceCategory[];
}

function payroll(over: Partial<Payroll>): Payroll {
  return {
    id: uid(),
    employeeName: 'Employee',
    role: 'Stylist',
    baseSalary: 0,
    bonus: 0,
    deductions: 0,
    netSalary: 0,
    status: PayrollStatus.PENDING,
    payDate: null,
    month: 3,
    year: YEAR,
    ...over,
  } as Payroll;
}

function entry(over: Partial<FinanceEntry>): FinanceEntry {
  return {
    id: uid(),
    type: FinanceEntryType.EXPENSE,
    title: 'Entry',
    description: null,
    category: null,
    amount: 0,
    date: `${YEAR}-03-10`,
    sourcePayrollId: null,
    sourcePayrollComponent: null,
    ...over,
  } as FinanceEntry;
}

/** Minimal stand-ins for the TypeORM repositories FinanceService reads through. */
function buildService(state: { entries: FinanceEntry[]; payrolls: Payroll[] }) {
  const queryBuilder = <T>(rows: () => T[]) => {
    const qb: any = {
      where: () => qb,
      andWhere: () => qb,
      orderBy: () => qb,
      addOrderBy: () => qb,
      select: () => qb,
      getMany: async () => rows(),
    };
    return qb;
  };

  const matchesPayroll = (where: any, row: Payroll) => {
    if (!where) return true;
    if (where.status && row.status !== where.status) return false;
    const id = where.id;
    if (id) {
      const wanted = typeof id === 'object' && 'value' in id ? id.value : [id];
      if (!([] as string[]).concat(wanted).includes(row.id)) return false;
    }
    return true;
  };

  const financeRepo = {
    find: async (options?: any) => {
      const where = options?.where;
      return state.entries.filter((e) => {
        if (!where) return true;
        if ('sourcePayrollId' in where) {
          const want = where.sourcePayrollId;
          // Not(IsNull()) is used to load every payroll-sourced row.
          if (typeof want === 'object' && want !== null) {
            if (!e.sourcePayrollId) return false;
          } else if (e.sourcePayrollId !== want) {
            return false;
          }
        }
        if (
          'sourcePayrollComponent' in where &&
          e.sourcePayrollComponent !== where.sourcePayrollComponent
        ) {
          return false;
        }
        return true;
      });
    },
    findOne: async (options?: any) =>
      (await financeRepo.find(options))[0] ?? null,
    count: async (options?: any) => (await financeRepo.find(options)).length,
    createQueryBuilder: () => queryBuilder(() => state.entries),
    create: (data: Partial<FinanceEntry>) => entry(data),
    save: async (row: FinanceEntry) => {
      if (!state.entries.includes(row)) state.entries.push(row);
      return row;
    },
    remove: async (rows: FinanceEntry | FinanceEntry[]) => {
      const list = Array.isArray(rows) ? rows : [rows];
      state.entries = state.entries.filter((e) => !list.includes(e));
      return rows;
    },
  } as unknown as Repository<FinanceEntry>;

  const categories = makeCategories();
  const categoryRepo = {
    find: async (options?: any) =>
      options?.where?.type
        ? categories.filter((c) => c.type === options.where.type)
        : categories,
    findOne: async (options?: any) =>
      categories.find((c) => c.code === options?.where?.code) ?? null,
  } as unknown as Repository<FinanceCategory>;

  const invoiceRepo = {
    createQueryBuilder: () => queryBuilder<Invoice>(() => []),
  } as unknown as Repository<Invoice>;

  const payrollRepo = {
    find: async (options?: any) =>
      state.payrolls.filter((p) => matchesPayroll(options?.where, p)),
  } as unknown as Repository<Payroll>;

  return {
    service: new FinanceService(
      financeRepo,
      categoryRepo,
      invoiceRepo,
      payrollRepo,
    ),
    state,
  };
}

const salaryRow = (summary: any) =>
  summary.expense.categories.find((c: any) => c.label === SALARY_LABEL);

describe('FinanceService — Employee Salary & Bonus', () => {
  it('reports 0 when every payroll is unpaid, even with a leftover salary expense on the books', async () => {
    const unpaid = [
      payroll({ employeeName: 'A', netSalary: 30000 }),
      payroll({ employeeName: 'B', netSalary: 25000 }),
      payroll({ employeeName: 'C', netSalary: 20000 }),
    ];
    const { service } = buildService({
      payrolls: unpaid,
      // Orphan: its payroll is gone (employee deleted → payroll cascade-deleted).
      entries: [
        entry({
          title: 'Employee Salary & Bonus — Ghost',
          category: SALARY_LABEL,
          amount: 114534,
          sourcePayrollId: 'deleted-payroll',
          sourcePayrollComponent: PayrollExpenseComponent.SALARY,
        }),
      ],
    });

    const summary = await service.getMonthlySummary(YEAR);
    expect(salaryRow(summary)?.total).toBe(0);
    expect(summary.expense.grandTotal).toBe(0);

    const overview = await service.getOverview(YEAR);
    expect(overview.totalExpense).toBe(0);
  });

  it('sums only the payrolls marked Paid', async () => {
    const { service } = buildService({
      payrolls: [
        payroll({
          employeeName: 'A',
          netSalary: 30000,
          status: PayrollStatus.PAID,
          payDate: `${YEAR}-03-05`,
        }),
        payroll({
          employeeName: 'B',
          netSalary: 25000,
          status: PayrollStatus.PAID,
          payDate: `${YEAR}-03-06`,
        }),
        payroll({ employeeName: 'C', netSalary: 20000 }),
      ],
      entries: [],
    });

    const summary = await service.getMonthlySummary(YEAR);
    const row = salaryRow(summary);
    expect(row?.total).toBe(55000);
    expect(row?.months[2]).toBe(55000);

    const overview = await service.getOverview(YEAR);
    expect(overview.totalExpense).toBe(55000);
  });

  it('counts a Paid payroll once, not twice, when its ledger expense also exists', async () => {
    const paid = payroll({
      employeeName: 'A',
      netSalary: 30000,
      status: PayrollStatus.PAID,
      payDate: `${YEAR}-04-01`,
    });
    const { service } = buildService({
      payrolls: [paid],
      entries: [
        entry({
          title: 'Employee Salary & Bonus — A',
          category: SALARY_LABEL,
          amount: 30000,
          date: `${YEAR}-04-01`,
          sourcePayrollId: paid.id,
          sourcePayrollComponent: PayrollExpenseComponent.SALARY,
        }),
      ],
    });

    const summary = await service.getMonthlySummary(YEAR);
    expect(salaryRow(summary)?.total).toBe(30000);
    expect(summary.expense.grandTotal).toBe(30000);
  });

  it('keeps a manual "salary" note out of the payroll row without losing the money', async () => {
    const { service } = buildService({
      payrolls: [payroll({ netSalary: 30000 })],
      entries: [
        entry({ title: 'Staff salary advance', amount: 5000 }),
        entry({ title: 'Cash paid', category: SALARY_LABEL, amount: 7000 }),
      ],
    });

    const summary = await service.getMonthlySummary(YEAR);
    expect(salaryRow(summary)?.total).toBe(0);
    // Still on the books, just not as payroll spend.
    expect(summary.expense.grandTotal).toBe(12000);
    const other = summary.expense.categories.find(
      (c: any) => c.label === 'Other Expense',
    );
    expect(other?.total).toBe(12000);
  });

  it('follows a status flip from Paid to Unpaid on the next read', async () => {
    const record = payroll({
      employeeName: 'A',
      netSalary: 30000,
      status: PayrollStatus.PAID,
      payDate: `${YEAR}-03-05`,
    });
    const { service, state } = buildService({ payrolls: [record], entries: [] });

    await service.syncSalaryExpenseAmount(record);
    expect(salaryRow(await service.getMonthlySummary(YEAR))?.total).toBe(30000);

    record.status = PayrollStatus.PENDING;
    record.payDate = null;
    await service.removeSalaryExpenseForPayroll(record.id);

    expect(salaryRow(await service.getMonthlySummary(YEAR))?.total).toBe(0);
    expect(state.entries).toHaveLength(0);
  });

  it('rejects manual entries filed under the payroll-owned category', async () => {
    const { service } = buildService({ payrolls: [], entries: [] });
    await expect(
      service.create({
        type: FinanceEntryType.EXPENSE,
        title: 'Salary paid in cash',
        category: SALARY_LABEL,
        amount: 5000,
        date: `${YEAR}-03-01`,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reconcile drops expenses whose payroll is gone or no longer Paid', async () => {
    const stillPaid = payroll({
      employeeName: 'A',
      netSalary: 30000,
      status: PayrollStatus.PAID,
      payDate: `${YEAR}-03-05`,
    });
    const revertedToPending = payroll({ employeeName: 'B', netSalary: 25000 });
    const state = {
      payrolls: [stillPaid, revertedToPending],
      entries: [
        entry({
          title: 'Employee Salary & Bonus — B',
          category: SALARY_LABEL,
          amount: 25000,
          sourcePayrollId: revertedToPending.id,
          sourcePayrollComponent: PayrollExpenseComponent.SALARY,
        }),
        entry({
          title: 'Employee Salary & Bonus — Ghost',
          category: SALARY_LABEL,
          amount: 114534,
          sourcePayrollId: 'deleted-payroll',
          sourcePayrollComponent: PayrollExpenseComponent.SALARY,
        }),
        entry({ title: 'Rent — March', amount: 40000 }),
      ],
    };
    const { service } = buildService(state);

    const result = await service.reconcilePayrollExpenses();
    expect(result.removed).toBe(2);
    expect(result.synced).toBe(1);

    const remaining = state.entries;
    expect(remaining.filter((e) => e.sourcePayrollId)).toHaveLength(1);
    expect(remaining.find((e) => e.sourcePayrollId)?.sourcePayrollId).toBe(
      stillPaid.id,
    );
    expect(remaining.find((e) => e.title === 'Rent — March')).toBeDefined();
  });
});
