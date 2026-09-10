import { SCOPED_CACHE_MANAGER } from '../tenancy/tenancy.module.js';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { Invoice } from '../invoice/entities/invoice.entity.js';
import { Client } from '../clients/entities/client.entity.js';
import { Service, ServiceStatus } from '../service/entities/service.entity.js';
import { Employee, EmployeeStatus } from '../employee/entities/employee.entity.js';
import { Inventory } from '../inventory/entities/inventory.entity.js';
import { Attendance } from '../attendance/entities/attendance.entity.js';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { DashboardChartsService } from './dashboard-charts.service.js';

const CACHE_KEY = 'dashboard:stats'
const CACHE_TTL = 60 * 5 * 1000
/** Business calendar for Elegant StyleDesk (Bangladesh). */
const BUSINESS_TIME_ZONE = 'Asia/Dhaka'
const BUSINESS_TIME_OFFSET_HOURS = 6

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @Inject(SCOPED_CACHE_MANAGER) private cacheManager: Cache,
    private readonly dashboardChartsService: DashboardChartsService,
  ) {}

  private calculateRevenue(invoices: any[]): number {
    return invoices.reduce((sum, inv) => {
      if (inv.status === 'Paid') return sum + Number(inv.total || 0);
      if (inv.status === 'Partial') return sum + Number(inv.paidAmount || 0);
      return sum;
    }, 0);
  }

  /** YYYY-MM-DD in Asia/Dhaka (not server local/UTC). */
  private toBusinessDateStr(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
    return `${map.year}-${map.month}-${map.day}`
  }

  private businessDayBounds(dateStr: string): { start: Date; end: Date } {
    const [year, month, day] = dateStr.split('-').map(Number)
    const startUtc =
      Date.UTC(year, month - 1, day, 0, 0, 0, 0) -
      BUSINESS_TIME_OFFSET_HOURS * 60 * 60 * 1000
    const endUtc = startUtc + 24 * 60 * 60 * 1000 - 1
    return { start: new Date(startUtc), end: new Date(endUtc) }
  }

  private shiftBusinessDateStr(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split('-').map(Number)
    const noonUtc =
      Date.UTC(year, month - 1, day, 12, 0, 0, 0) -
      BUSINESS_TIME_OFFSET_HOURS * 60 * 60 * 1000
    return this.toBusinessDateStr(new Date(noonUtc + days * 86400000))
  }

  private businessWeekdayShort(dateStr: string): string {
    const { start } = this.businessDayBounds(dateStr)
    return start.toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: BUSINESS_TIME_ZONE,
    })
  }

  async getStats() {
    const cached = await this.cacheManager.get(CACHE_KEY)
    if (cached)
      return cached
    const now = new Date();
    const todayStr = this.toBusinessDateStr(now);
    const yesterdayStr = this.shiftBusinessDateStr(todayStr, -1);

    // Calendar month / ranges in Asia/Dhaka
    const [ty, tm] = todayStr.split('-').map(Number);
    const monthStartStr = `${ty}-${String(tm).padStart(2, '0')}-01`;
    const { start: monthStart } = this.businessDayBounds(monthStartStr);
    const lastDayOfMonth = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
    const monthEndStr = `${ty}-${String(tm).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
    const { end: monthEnd } = this.businessDayBounds(monthEndStr);

    const sevenDaysAgoStr = this.shiftBusinessDateStr(todayStr, -6);
    const { start: sevenDaysAgo } = this.businessDayBounds(sevenDaysAgoStr);

    const thirtyDaysAgoStr = this.shiftBusinessDateStr(todayStr, -29);
    const { start: thirtyDaysAgo } = this.businessDayBounds(thirtyDaysAgoStr);

    const sixMonthsAnchor = this.shiftBusinessDateStr(todayStr, -180);
    const { start: sixMonthsAgo } = this.businessDayBounds(sixMonthsAnchor);

    const yearStartStr = `${ty}-01-01`;
    const { start: yearStart } = this.businessDayBounds(yearStartStr);

    // Week = Sun–Sat in Asia/Dhaka
    const todayDow = new Date(`${todayStr}T12:00:00+06:00`).getUTCDay(); // 0=Sun
    const weekStartStr = this.shiftBusinessDateStr(todayStr, -todayDow);
    const { start: weekStart } = this.businessDayBounds(weekStartStr);
    const lastWeekStartStr = this.shiftBusinessDateStr(weekStartStr, -7);
    const lastWeekEndStr = this.shiftBusinessDateStr(weekStartStr, -1);
    const { start: lastWeekStart } = this.businessDayBounds(lastWeekStartStr);
    const { end: lastWeekEnd } = this.businessDayBounds(lastWeekEndStr);

    const prevSevenDaysStartStr = this.shiftBusinessDateStr(sevenDaysAgoStr, -7);
    const prevSevenDaysEndStr = this.shiftBusinessDateStr(sevenDaysAgoStr, -1);
    const { start: prevSevenDaysStart } = this.businessDayBounds(prevSevenDaysStartStr);
    const { end: prevSevenDaysEnd } = this.businessDayBounds(prevSevenDaysEndStr);

    // ── Today's schedule from All Orders (invoices), not requested bookings ──
    const { start: todayStart, end: todayEnd } = this.businessDayBounds(todayStr);
    const todaysOrders = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .leftJoinAndSelect('invoice.appointment', 'appointment')
      .where(
        '(invoice.confirmedAt BETWEEN :todayStart AND :todayEnd) OR (invoice.confirmedAt IS NULL AND invoice.createdAt BETWEEN :todayStart AND :todayEnd)',
        { todayStart, todayEnd },
      )
      .orderBy('COALESCE(invoice.confirmedAt, invoice.createdAt)', 'ASC')
      .getMany();

    const onlineBookingsToday = todaysOrders.filter((inv) => {
      const hasAppt = Boolean(inv.appointment?.id);
      const src = (inv.source || '').toLowerCase();
      return hasAppt || src.includes('online');
    }).length;
    const walkInsToday = todaysOrders.filter((inv) => {
      const hasAppt = Boolean(inv.appointment?.id);
      const src = (inv.source || '').toLowerCase();
      return !hasAppt && (src.includes('walk') || src.includes('offline') || !src);
    }).length;
    const callBookingsToday = todaysOrders.filter((inv) =>
      (inv.source || '').toLowerCase() === 'call',
    ).length;

    const { start: yesterdayStart, end: yesterdayEnd } = this.businessDayBounds(yesterdayStr);
    const yesterdaysAppointmentsCount = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where(
        '(invoice.confirmedAt BETWEEN :yesterdayStart AND :yesterdayEnd) OR (invoice.confirmedAt IS NULL AND invoice.createdAt BETWEEN :yesterdayStart AND :yesterdayEnd)',
        { yesterdayStart, yesterdayEnd },
      )
      .getCount();

    // ── Last 7 days invoices (used for weekly revenue + revenue trend) ──
    const weeklyInvoices = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.updatedAt >= :sevenDaysAgo', { sevenDaysAgo })
      .andWhere('invoice.status IN (:...statuses)', { statuses: ['Paid', 'Partial'] })
      .getMany();

    const weeklyRevenue = this.calculateRevenue(weeklyInvoices);

    const lastSevenDaysInvoices = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.updatedAt >= :prevSevenDaysStart AND invoice.updatedAt <= :prevSevenDaysEnd', { prevSevenDaysStart, prevSevenDaysEnd })
      .andWhere('invoice.status IN (:...statuses)', { statuses: ['Paid', 'Partial'] })
      .getMany();
    const lastWeekRevenue = this.calculateRevenue(lastSevenDaysInvoices);

    // ── Extended revenue (monthly + 6-month) ──
    const sixMonthInvoices = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.updatedAt >= :sixMonthsAgo', { sixMonthsAgo })
      .andWhere('invoice.status IN (:...statuses)', { statuses: ['Paid', 'Partial'] })
      .getMany();

    const monthlyInvoicesThisMonth = sixMonthInvoices.filter(inv => new Date(inv.updatedAt) >= thirtyDaysAgo);
    const monthlyRevenue = this.calculateRevenue(monthlyInvoicesThisMonth);

    const sixMonthRevenue = this.calculateRevenue(sixMonthInvoices);

    const totalClients = await this.clientRepo.count();

    const totalClientsThisMonth = await this.clientRepo
      .createQueryBuilder('client')
      .where('client.createdAt >= :monthStart AND client.createdAt <= :monthEnd', { monthStart, monthEnd })
      .getCount();

    const totalClientsThisWeek = await this.clientRepo
      .createQueryBuilder('client')
      .where('client.createdAt >= :weekStart', { weekStart })
      .getCount();

    const totalClientsLastWeek = await this.clientRepo
      .createQueryBuilder('client')
      .where('client.createdAt >= :lastWeekStart AND client.createdAt <= :lastWeekEnd', { lastWeekStart, lastWeekEnd })
      .getCount();

    // ── Active services count ──
    const activeServicesCount = await this.serviceRepo.count({
      where: { status: ServiceStatus.ACTIVE },
    });

    // ── Monthly appointments (online/walk-in + top services) ──
    const monthlyAppointments = await this.appointmentRepo
      .createQueryBuilder('appointment')
      .where('appointment.createdAt >= :monthStart AND appointment.createdAt <= :monthEnd', { monthStart, monthEnd })
      .getMany();

    const onlineBookingsThisMonth = monthlyAppointments.filter(
      (a) => a.source.toLowerCase() === 'online',
    ).length;

    const walkInsThisMonth = monthlyAppointments.filter(
      (a) => a.source.toLowerCase() === 'walk-in',
    ).length;

    // ── Extended clients + appointments (6-month and yearly) ──
    const yearlyClients = await this.clientRepo
      .createQueryBuilder('client')
      .where('client.createdAt >= :yearStart', { yearStart })
      .getMany();

    const totalClientsSixMonths = yearlyClients
      .filter(c => new Date(c.createdAt) >= sixMonthsAgo).length;

    const totalClientsThisYear = yearlyClients.length;

    const yearlyAppointments = await this.appointmentRepo
      .createQueryBuilder('appointment')
      .where('appointment.createdAt >= :yearStart', { yearStart })
      .getMany();

    const onlineBookingsSixMonths = yearlyAppointments
      .filter(a => new Date(a.createdAt) >= sixMonthsAgo && a.source.toLowerCase() === 'online').length;

    const onlineBookingsThisYear = yearlyAppointments
      .filter(a => a.source.toLowerCase() === 'online').length;

    const walkInsSixMonths = yearlyAppointments
      .filter(a => new Date(a.createdAt) >= sixMonthsAgo && a.source.toLowerCase() === 'walk-in').length;

    const walkInsThisYear = yearlyAppointments
      .filter(a => a.source.toLowerCase() === 'walk-in').length;

    // ── Active employees count ──
    const activeEmployeesCount = await this.employeeRepo.count({
      where: { status: EmployeeStatus.ACTIVE },
    });

    // ── Today's attendance ──
    const todaysAttendanceRecords = await this.attendanceRepo.find({
      where: { attendanceDate: todayStr as any },
      order: { checkInTime: 'ASC' },
    });
    const todaysAttendanceCount = todaysAttendanceRecords.length;

    // ── Low stock items ──
    const lowInventory = await this.inventoryRepo
      .createQueryBuilder('item')
      .select(['item.id', 'item.name', 'item.category', 'item.stockQty', 'item.minStockLevel'])
      .where('item.stockQty <= item.minStockLevel')
      .getMany();
    const lowStockItems = lowInventory
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        stockQty: item.stockQty,
        minStockLevel: item.minStockLevel,
      }));

    const pad = (n: number) => String(n).padStart(2, '0');

    // ── Revenue trend (weekly/monthly/day-wise, 6-month/yearly month-wise) ──
    const revenueTrendWeekly: { label: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = this.shiftBusinessDateStr(todayStr, -i);
      const { start: dayStart, end: dayEnd } = this.businessDayBounds(dateStr);

      const dayInvoices = weeklyInvoices.filter((inv) => {
        const t = new Date(inv.updatedAt);
        return t >= dayStart && t <= dayEnd;
      });
      const dayRevenue = this.calculateRevenue(dayInvoices);

      revenueTrendWeekly.push({
        label: this.businessWeekdayShort(dateStr),
        revenue: dayRevenue,
      });
    }

    const revenueTrendMonthly: { label: string; revenue: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dateStr = this.shiftBusinessDateStr(todayStr, -i);
      const { start: dayStart, end: dayEnd } = this.businessDayBounds(dateStr);

      const dayInvoices = sixMonthInvoices.filter((inv) => {
        const t = new Date(inv.updatedAt);
        return t >= dayStart && t <= dayEnd;
      });
      const dayRevenue = this.calculateRevenue(dayInvoices);
      const [, m, d] = dateStr.split('-');

      revenueTrendMonthly.push({
        label: `${d}-${m}`,
        revenue: dayRevenue,
      });
    }

    const revenueTrendSixMonths: { label: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      let y = ty;
      let m = tm - 1 - i; // 0-based month
      while (m < 0) {
        m += 12;
        y -= 1;
      }
      const mStartStr = `${y}-${pad(m + 1)}-01`;
      const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const mEndStr = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
      const { start: monthStartBound } = this.businessDayBounds(mStartStr);
      const { end: monthEndBound } = this.businessDayBounds(mEndStr);

      const monthInvoices = sixMonthInvoices.filter((inv) => {
        const t = new Date(inv.updatedAt);
        return t >= monthStartBound && t <= monthEndBound;
      });
      const monthRevenue = this.calculateRevenue(monthInvoices);

      revenueTrendSixMonths.push({
        label: monthStartBound.toLocaleDateString('en-US', {
          month: 'short',
          timeZone: BUSINESS_TIME_ZONE,
        }),
        revenue: monthRevenue,
      });
    }

    const yearlyInvoices = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.updatedAt >= :yearStart', { yearStart })
      .andWhere('invoice.status IN (:...statuses)', { statuses: ['Paid', 'Partial'] })
      .getMany();

    const revenueTrendYearly: { label: string; revenue: number }[] = [];
    for (let month = 0; month < 12; month++) {
      const mStartStr = `${ty}-${pad(month + 1)}-01`;
      const lastDay = new Date(Date.UTC(ty, month + 1, 0)).getUTCDate();
      const mEndStr = `${ty}-${pad(month + 1)}-${pad(lastDay)}`;
      const { start: monthStartBound } = this.businessDayBounds(mStartStr);
      const { end: monthEndBound } = this.businessDayBounds(mEndStr);

      const monthInvoices = yearlyInvoices.filter((inv) => {
        const t = new Date(inv.updatedAt);
        return t >= monthStartBound && t <= monthEndBound;
      });
      const monthRevenue = this.calculateRevenue(monthInvoices);

      revenueTrendYearly.push({
        label: monthStartBound.toLocaleDateString('en-US', {
          month: 'short',
          timeZone: BUSINESS_TIME_ZONE,
        }),
        revenue: monthRevenue,
      });
    }

    // ── Appointment trends (weekly = last 7 days/day, monthly = last 30 days/day) ──
    const recentAppointments = await this.appointmentRepo
      .createQueryBuilder('appointment')
      .where('appointment.date >= :thirtyDaysAgoStr', { thirtyDaysAgoStr })
      .getMany();

    const appointmentTrendWeekly: { label: string; appointments: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = this.shiftBusinessDateStr(todayStr, -i);
      appointmentTrendWeekly.push({
        label: this.businessWeekdayShort(dateStr),
        appointments: recentAppointments.filter((a) => a.date === dateStr).length,
      });
    }

    const appointmentTrendMonthly: { label: string; appointments: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dateStr = this.shiftBusinessDateStr(todayStr, -i);
      const [, m, d] = dateStr.split('-');
      appointmentTrendMonthly.push({
        label: `${d}-${m}`,
        appointments: recentAppointments.filter((a) => a.date === dateStr).length,
      });
    }

    // ── Top services this month ──
    const serviceCount: Record<string, number> = {};
    for (const appt of monthlyAppointments) {
      for (const svc of appt.services || []) {
        serviceCount[svc] = (serviceCount[svc] || 0) + 1;
      }
    }
    const topServices = Object.entries(serviceCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const result = {
      todaysAppointmentsCount: todaysOrders.length,
      todaysAppointments: todaysOrders.map((inv) => {
        const stamp = inv.confirmedAt || inv.createdAt;
        const timeFromStamp = stamp
          ? new Intl.DateTimeFormat('en-US', {
              timeZone: BUSINESS_TIME_ZONE,
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }).format(new Date(stamp))
          : '';
        const services = [
          ...(Array.isArray(inv.services) ? inv.services : []),
          ...(Array.isArray(inv.packageNames) ? inv.packageNames : []),
        ].filter(Boolean);
        return {
          id: inv.id,
          clientName: inv.client?.name || 'Walk-in',
          time: inv.appointment?.time || timeFromStamp || '—',
          services: services.length > 0 ? services : (inv.appointment?.services ?? []),
          status: inv.status,
          staff: inv.staff || inv.appointment?.staff || null,
          source: inv.source,
        };
      }),
      onlineBookingsToday,
      walkInsToday,
      callBookingsToday,
      yesterdaysAppointmentsCount,
      weeklyRevenue,
      lastWeekRevenue,
      totalClients,
      totalClientsThisWeek,
      totalClientsLastWeek,
      monthlyRevenue,
      sixMonthRevenue,
      totalClientsThisMonth,
      totalClientsSixMonths,
      totalClientsThisYear,
      activeServicesCount,
      onlineBookingsThisMonth,
      onlineBookingsSixMonths,
      onlineBookingsThisYear,
      walkInsThisMonth,
      walkInsSixMonths,
      walkInsThisYear,
      activeEmployeesCount,
      todaysAttendanceCount,
      todaysAttendance: todaysAttendanceRecords.map((r) => ({
        employeeName: r.employeeName,
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        status: r.status,
      })),
      lowStockItemsCount: lowStockItems.length,
      lowStockItems,
      revenueTrendWeekly,
      revenueTrendMonthly,
      revenueTrendSixMonths,
      revenueTrendYearly,
      appointmentTrendWeekly,
      appointmentTrendMonthly,
      topServices,
    };

    await this.cacheManager.set(CACHE_KEY, result, CACHE_TTL)
    return result
  }

  async invalidCache() {
    await this.cacheManager.del(CACHE_KEY);
    await this.dashboardChartsService.invalidateChartCache();
  }
}
