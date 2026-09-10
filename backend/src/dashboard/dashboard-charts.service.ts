import { SCOPED_CACHE_MANAGER } from '../tenancy/tenancy.module.js';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { Invoice, InvoiceStatus } from '../invoice/entities/invoice.entity.js';
import {
  FinanceEntry,
  FinanceEntryType,
} from '../finance/entities/finance-entry.entity.js';
import { Payroll, PayrollStatus } from '../payroll/entities/payroll.entity.js';
import {
  DashboardChartGranularity,
  DashboardChartMetric,
  DashboardChartRange,
  DashboardChartSeriesResponse,
  DashboardTopServicesResponse,
} from './dashboard-chart.types.js';
import {
  BUSINESS_TIME_ZONE,
  businessDayBounds,
  businessMonthShort,
  businessWeekdayShort,
  monthBounds,
  pad2,
  shiftBusinessDateStr,
  toBusinessDateStr,
} from './dashboard-date.util.js';

const CHART_CACHE_PREFIX = 'dashboard:charts';
const CHART_CACHE_TTL = 60 * 5 * 1000;
const TOP_SERVICES_LIMIT = 5;

type TimeBucket = {
  label: string;
  date: string;
  fromStr: string;
  toStr: string;
  start: Date;
  end: Date;
};

@Injectable()
export class DashboardChartsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(FinanceEntry)
    private readonly financeRepo: Repository<FinanceEntry>,
    @InjectRepository(Payroll)
    private readonly payrollRepo: Repository<Payroll>,
    @Inject(SCOPED_CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  static chartCacheKey(metric: DashboardChartMetric, range: DashboardChartRange): string {
    return `${CHART_CACHE_PREFIX}:${metric}:${range}`;
  }

  async getRevenueTrend(range: DashboardChartRange): Promise<DashboardChartSeriesResponse> {
    return this.getCachedSeries(DashboardChartMetric.REVENUE, range, async (buckets, granularity) => {
      const { start } = buckets[0];
      const { end } = buckets[buckets.length - 1];

      const invoices = await this.invoiceRepo
        .createQueryBuilder('invoice')
        .where('invoice.updatedAt >= :start AND invoice.updatedAt <= :end', { start, end })
        .andWhere('invoice.status IN (:...statuses)', {
          statuses: [InvoiceStatus.PAID, InvoiceStatus.PARTIAL],
        })
        .getMany();

      const points = buckets.map((bucket) => ({
        label: bucket.label,
        date: bucket.date,
        revenue: this.calculateRevenue(
          invoices.filter((inv) => {
            const t = new Date(inv.updatedAt);
            return t >= bucket.start && t <= bucket.end;
          }),
        ),
      }));

      return { granularity, points };
    });
  }

  async getAppointmentTrend(range: DashboardChartRange): Promise<DashboardChartSeriesResponse> {
    return this.getCachedSeries(DashboardChartMetric.APPOINTMENTS, range, async (buckets) => {
      const fromStr = buckets[0].fromStr;
      const toStr = buckets[buckets.length - 1].toStr;

      const appointments = await this.appointmentRepo
        .createQueryBuilder('appointment')
        .where('appointment.date >= :fromStr AND appointment.date <= :toStr', {
          fromStr,
          toStr,
        })
        .getMany();

      const granularity = this.granularityForRange(range);
      const points = buckets.map((bucket) => ({
        label: bucket.label,
        date: bucket.date,
        appointments: appointments.filter((appt) => {
          if (granularity === 'day') return appt.date === bucket.fromStr;
          return appt.date >= bucket.fromStr && appt.date <= bucket.toStr;
        }).length,
      }));

      return { granularity, points };
    });
  }

  async getTopServices(range: DashboardChartRange): Promise<DashboardTopServicesResponse> {
    const cacheKey = DashboardChartsService.chartCacheKey(
      DashboardChartMetric.TOP_SERVICES,
      range,
    );
    const cached = await this.cacheManager.get<DashboardTopServicesResponse>(cacheKey);
    if (cached) return cached;

    const buckets = this.buildBuckets(range);
    const fromStr = buckets[0].fromStr;
    const toStr = buckets[buckets.length - 1].toStr;

    const appointments = await this.appointmentRepo
      .createQueryBuilder('appointment')
      .where('appointment.date >= :fromStr AND appointment.date <= :toStr', {
        fromStr,
        toStr,
      })
      .getMany();

    const serviceCount: Record<string, number> = {};
    for (const appt of appointments) {
      for (const svc of appt.services || []) {
        const name = svc?.trim();
        if (!name) continue;
        serviceCount[name] = (serviceCount[name] || 0) + 1;
      }
    }

    const result: DashboardTopServicesResponse = {
      metric: DashboardChartMetric.TOP_SERVICES,
      range,
      timezone: BUSINESS_TIME_ZONE,
      limit: TOP_SERVICES_LIMIT,
      items: Object.entries(serviceCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_SERVICES_LIMIT),
    };

    await this.cacheManager.set(cacheKey, result, CHART_CACHE_TTL);
    return result;
  }

  /**
   * Income vs expense (ledger + invoices + payroll) and invoice paid vs due.
   * Manual finance rows exclude payroll-mirrored ledger entries to avoid double counting.
   */
  async getFinanceTrend(range: DashboardChartRange): Promise<DashboardChartSeriesResponse> {
    return this.getCachedSeries(DashboardChartMetric.FINANCE, range, async (buckets, granularity) => {
      const fromStr = buckets[0].fromStr;
      const toStr = buckets[buckets.length - 1].toStr;
      const fromDate = buckets[0].start;
      const toDate = buckets[buckets.length - 1].end;

      const [financeEntries, invoices, payrollRows] = await Promise.all([
        this.financeRepo
          .createQueryBuilder('entry')
          .where('entry.date >= :fromStr AND entry.date <= :toStr', { fromStr, toStr })
          .getMany(),
        this.invoiceRepo
          .createQueryBuilder('invoice')
          .where(
            '(invoice.confirmedAt BETWEEN :fromDate AND :toDate) OR (invoice.confirmedAt IS NULL AND invoice.createdAt BETWEEN :fromDate AND :toDate)',
            { fromDate, toDate },
          )
          .getMany(),
        this.paidPayrollExpenses(fromStr, toStr),
      ]);

      const manualEntries = financeEntries.filter((entry) => !entry.sourcePayrollId);

      const points = buckets.map((bucket) => {
        let income = 0;
        let expense = 0;
        let paid = 0;
        let due = 0;

        for (const entry of manualEntries) {
          const d = String(entry.date).slice(0, 10);
          if (!this.dateInBucket(d, bucket, granularity)) continue;
          const amount = Number(entry.amount) || 0;
          if (entry.type === FinanceEntryType.INCOME) income += amount;
          else expense += amount;
        }

        for (const payroll of payrollRows) {
          if (!this.dateInBucket(payroll.date, bucket, granularity)) continue;
          expense += payroll.amount;
        }

        for (const inv of invoices) {
          const d = this.invoiceBusinessDate(inv);
          if (!this.dateInBucket(d, bucket, granularity)) continue;
          income += this.invoiceCollected(inv);
          paid += this.invoiceCollected(inv);
          due += this.invoiceOutstanding(inv);
        }

        return {
          label: bucket.label,
          date: bucket.date,
          income: Math.round(income),
          expense: Math.round(expense),
          paid: Math.round(paid),
          due: Math.round(due),
        };
      });

      return { granularity, points };
    });
  }

  async invalidateChartCache(): Promise<void> {
    for (const metric of Object.values(DashboardChartMetric)) {
      for (const range of Object.values(DashboardChartRange)) {
        await this.cacheManager.del(DashboardChartsService.chartCacheKey(metric, range));
      }
    }
  }

  private async getCachedSeries(
    metric: DashboardChartMetric,
    range: DashboardChartRange,
    build: (
      buckets: TimeBucket[],
      granularity: DashboardChartGranularity,
    ) => Promise<{
      granularity: DashboardChartGranularity;
      points: DashboardChartSeriesResponse['points'];
    }>,
  ): Promise<DashboardChartSeriesResponse> {
    const cacheKey = DashboardChartsService.chartCacheKey(metric, range);
    const cached = await this.cacheManager.get<DashboardChartSeriesResponse>(cacheKey);
    if (cached) return cached;

    const buckets = this.buildBuckets(range);
    const granularity = this.granularityForRange(range);
    const { points } = await build(buckets, granularity);

    const result: DashboardChartSeriesResponse = {
      metric,
      range,
      granularity,
      timezone: BUSINESS_TIME_ZONE,
      points,
    };

    await this.cacheManager.set(cacheKey, result, CHART_CACHE_TTL);
    return result;
  }

  private buildBuckets(range: DashboardChartRange): TimeBucket[] {
    const todayStr = toBusinessDateStr(new Date());
    const [ty, tm] = todayStr.split('-').map(Number);

    if (range === DashboardChartRange.WEEK) {
      return Array.from({ length: 7 }, (_, idx) => {
        const offset = 6 - idx;
        const dateStr = shiftBusinessDateStr(todayStr, -offset);
        const { start, end } = businessDayBounds(dateStr);
        return {
          label: businessWeekdayShort(dateStr),
          date: dateStr,
          fromStr: dateStr,
          toStr: dateStr,
          start,
          end,
        };
      });
    }

    if (range === DashboardChartRange.MONTH) {
      return Array.from({ length: 30 }, (_, idx) => {
        const offset = 29 - idx;
        const dateStr = shiftBusinessDateStr(todayStr, -offset);
        const { start, end } = businessDayBounds(dateStr);
        const [, m, d] = dateStr.split('-');
        return {
          label: `${d}-${m}`,
          date: dateStr,
          fromStr: dateStr,
          toStr: dateStr,
          start,
          end,
        };
      });
    }

    if (range === DashboardChartRange.SIX_MONTHS) {
      return Array.from({ length: 6 }, (_, idx) => {
        const monthsBack = 5 - idx;
        let year = ty;
        let month = tm - monthsBack;
        while (month <= 0) {
          month += 12;
          year -= 1;
        }
        const { startStr, endStr, start, end } = monthBounds(year, month);
        return {
          label: businessMonthShort(startStr),
          date: startStr,
          fromStr: startStr,
          toStr: endStr,
          start,
          end,
        };
      });
    }

    return Array.from({ length: 12 }, (_, monthIdx) => {
      const month = monthIdx + 1;
      const { startStr, endStr, start, end } = monthBounds(ty, month);
      return {
        label: businessMonthShort(startStr),
        date: startStr,
        fromStr: startStr,
        toStr: endStr,
        start,
        end,
      };
    });
  }

  private granularityForRange(range: DashboardChartRange): DashboardChartGranularity {
    return range === DashboardChartRange.WEEK || range === DashboardChartRange.MONTH
      ? 'day'
      : 'month';
  }

  private dateInBucket(
    dateStr: string,
    bucket: TimeBucket,
    granularity: DashboardChartGranularity,
  ): boolean {
    if (granularity === 'day') return dateStr === bucket.fromStr;
    return dateStr >= bucket.fromStr && dateStr <= bucket.toStr;
  }

  private calculateRevenue(invoices: Invoice[]): number {
    return invoices.reduce((sum, inv) => sum + this.invoiceCollected(inv), 0);
  }

  private invoiceCollected(inv: Invoice): number {
    if (inv.status === InvoiceStatus.PAID) return Number(inv.total || 0);
    if (inv.status === InvoiceStatus.PARTIAL) return Number(inv.paidAmount || 0);
    return 0;
  }

  private invoiceOutstanding(inv: Invoice): number {
    const total = Number(inv.total || 0);
    if (inv.status === InvoiceStatus.DUE) return total;
    if (inv.status === InvoiceStatus.PARTIAL) {
      return Math.max(0, total - Number(inv.paidAmount || 0));
    }
    return 0;
  }

  private invoiceBusinessDate(inv: Invoice): string {
    const source = inv.confirmedAt || inv.createdAt;
    return toBusinessDateStr(new Date(source));
  }

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

  private payrollExpenseDate(payroll: Payroll): string {
    const payDate = String(payroll.payDate ?? '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(payDate)) return payDate;
    const month = Math.min(12, Math.max(1, Number(payroll.month) || 1));
    return `${payroll.year}-${pad2(month)}-01`;
  }
}
