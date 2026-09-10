import type { Repository } from 'typeorm';
import type { Cache } from 'cache-manager';
import { DashboardChartsService } from './dashboard-charts.service.js';
import { DashboardChartRange } from './dashboard-chart.types.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { Invoice, InvoiceStatus } from '../invoice/entities/invoice.entity.js';
import { FinanceEntry, FinanceEntryType } from '../finance/entities/finance-entry.entity.js';
import { Payroll, PayrollStatus } from '../payroll/entities/payroll.entity.js';

function qb<T>(rows: () => T[]) {
  const builder: any = {
    where: () => builder,
    andWhere: () => builder,
    getMany: async () => rows(),
    getCount: async () => rows().length,
  };
  return builder;
}

function buildService(state: {
  appointments?: Appointment[];
  invoices?: Invoice[];
  financeEntries?: FinanceEntry[];
  payrolls?: Payroll[];
}) {
  const cache = {
    get: async <T>() => undefined as T,
    set: async <T>(_key: string, value: T) => value,
    del: async () => true,
    reset: async <T>(_key: string, value: T) => value,
    wrap: async (_key: string, fn: () => Promise<unknown>) => fn(),
    store: {} as any,
  } as unknown as Cache;

  const appointmentRepo = {
    createQueryBuilder: () => qb(() => state.appointments ?? []),
  } as unknown as Repository<Appointment>;

  const invoiceRepo = {
    createQueryBuilder: () => qb(() => state.invoices ?? []),
  } as unknown as Repository<Invoice>;

  const financeRepo = {
    createQueryBuilder: () => qb(() => state.financeEntries ?? []),
  } as unknown as Repository<FinanceEntry>;

  const payrollRepo = {
    find: async () => state.payrolls ?? [],
  } as unknown as Repository<Payroll>;

  const service = new DashboardChartsService(
    appointmentRepo,
    invoiceRepo,
    financeRepo,
    payrollRepo,
    cache,
  );

  return service;
}

describe('DashboardChartsService', () => {
  it('returns 7 daily revenue points for week range', async () => {
    const service = buildService({
      invoices: [
        {
          status: InvoiceStatus.PAID,
          total: 100,
          updatedAt: new Date(),
        } as Invoice,
      ],
    });

    const result = await service.getRevenueTrend(DashboardChartRange.WEEK);
    expect(result.range).toBe('week');
    expect(result.granularity).toBe('day');
    expect(result.points).toHaveLength(7);
    expect(result.points[0]).toMatchObject({
      label: expect.any(String),
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      revenue: expect.any(Number),
    });
  });

  it('counts appointments by scheduled date for month range', async () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const service = buildService({
      appointments: [
        { date: today, services: ['Haircut'] } as Appointment,
        { date: today, services: ['Color'] } as Appointment,
      ],
    });

    const result = await service.getAppointmentTrend(DashboardChartRange.MONTH);
    expect(result.points).toHaveLength(30);
    const todayPoint = result.points.find((p) => p.date === today);
    expect(todayPoint?.appointments).toBe(2);
  });

  it('ranks top services within the requested range', async () => {
    const service = buildService({
      appointments: [
        { date: '2026-03-01', services: ['Haircut', 'Wash'] } as Appointment,
        { date: '2026-03-02', services: ['Haircut'] } as Appointment,
        { date: '2026-03-03', services: ['Color'] } as Appointment,
      ],
    });

    const result = await service.getTopServices(DashboardChartRange.MONTH);
    expect(result.items[0]).toEqual({ name: 'Haircut', count: 2 });
    expect(result.items).toHaveLength(3);
  });

  it('builds finance series with income, expense, paid, and due', async () => {
    const service = buildService({
      financeEntries: [
        {
          type: FinanceEntryType.EXPENSE,
          amount: 50,
          date: '2026-03-10',
          sourcePayrollId: null,
        } as FinanceEntry,
      ],
      invoices: [
        {
          status: InvoiceStatus.PAID,
          total: 200,
          confirmedAt: new Date('2026-03-10T06:00:00.000Z'),
          createdAt: new Date('2026-03-10T06:00:00.000Z'),
        } as Invoice,
        {
          status: InvoiceStatus.DUE,
          total: 80,
          confirmedAt: new Date('2026-03-10T07:00:00.000Z'),
          createdAt: new Date('2026-03-10T07:00:00.000Z'),
        } as Invoice,
      ],
      payrolls: [
        {
          status: PayrollStatus.PAID,
          netSalary: 100,
          payDate: '2026-03-10',
          month: 3,
          year: 2026,
        } as Payroll,
      ],
    });

    const result = await service.getFinanceTrend(DashboardChartRange.YEAR);
    expect(result.granularity).toBe('month');
    expect(result.points).toHaveLength(12);
    const march = result.points.find((p) => p.date.startsWith('2026-03'));
    expect(march).toMatchObject({
      income: 200,
      expense: 150,
      paid: 200,
      due: 80,
    });
  });
});
