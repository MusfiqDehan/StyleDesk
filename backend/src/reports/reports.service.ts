import { SCOPED_CACHE_MANAGER } from '../tenancy/tenancy.module.js';
import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Client } from '../clients/entities/client.entity';
import { Employee } from '../employee/entities/employee.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @Inject(SCOPED_CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  async getReports(from: string, to: string) {
    const cacheKey = `reports:${from}:${to}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const [fY, fM, fD] = from.split('-').map(Number);
    const fromDate = new Date(fY, fM - 1, fD, 0, 0, 0, 0);

    const [tY, tM, tD] = to.split('-').map(Number);
    const toDate = new Date(tY, tM - 1, tD, 23, 59, 59, 999);


    const invoices = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .where('invoice.createdAt >= :fromDate AND invoice.createdAt <= :toDate', { fromDate, toDate })
      .getMany();

    const appointments = await this.appointmentRepo
      .createQueryBuilder('appointment')
      .where('appointment.date >= :from AND appointment.date <= :to', { from, to })
      .getMany();

    const newClients = await this.clientRepo
      .createQueryBuilder('client')
      .where('client.createdAt >= :fromDate AND client.createdAt <= :toDate', { fromDate, toDate })
      .getCount();

    // Revenue — "paid" is money actually received (paidAmount), not "sum of fully-Paid
    // invoice totals". Partial invoices contribute their paidAmount to paid and the
    // remainder to unpaid; Due invoices contribute 0 to paid.
    // Exclude dueCollected — that money was already counted on the original unpaid invoices
    const invoiceSales = (inv: { total?: unknown; dueCollected?: unknown }) =>
      Math.max(0, Number(inv.total || 0) - Math.max(0, Number(inv.dueCollected || 0)));

    const totalRevenue = invoices.reduce((sum, inv) => sum + invoiceSales(inv), 0);
    const paidRevenue = invoices.reduce(
      (sum, inv) => sum + Math.max(0, Number(inv.paidAmount || 0)),
      0,
    );
    const unpaidRevenue = invoices.reduce((sum, inv) => {
      const total = Math.max(0, Number(inv.total || 0));
      const paid = Math.max(0, Number(inv.paidAmount || 0));
      return sum + Math.max(0, total - paid);
    }, 0);

    const revenueByPaymentMethod: Record<string, number> = {};
    for (const inv of invoices) {
      const method = inv.paymentMethod || 'Other';
      revenueByPaymentMethod[method] =
        (revenueByPaymentMethod[method] || 0) + invoiceSales(inv);
    }

    // Appointments breakdown
    const appointmentsByStatus: Record<string, number> = {
      'Pending': 0,
      'Confirmed': 0,
      'Completed': 0,
      'Checked In': 0,
      'In Service': 0,
    };
    const appointmentsBySource: Record<string, number> = {};
    for (const appt of appointments) {
      if (appointmentsByStatus.hasOwnProperty(appt.status)) {
        appointmentsByStatus[appt.status]++;
      }
      appointmentsBySource[appt.source] = (appointmentsBySource[appt.source] || 0) + 1;
    }

    // Top services
    const serviceCount: Record<string, number> = {};
    for (const appt of appointments) {
      for (const svc of appt.services || []) {
        serviceCount[svc] = (serviceCount[svc] || 0) + 1;
      }
    }
    const topServices = Object.entries(serviceCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top staff by revenue
    const staffRevenue: Record<string, number> = {};
    for (const inv of invoices) {
      if (inv.staff) {
        staffRevenue[inv.staff] = (staffRevenue[inv.staff] || 0) + Number(inv.total);
      }
    }
    const topStaff = Object.entries(staffRevenue)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const trends = await this.calculateTrends(fromDate, toDate, totalRevenue, appointments.length, newClients);

    const result = {
      totalRevenue,
      paidRevenue,
      unpaidRevenue,
      revenueByPaymentMethod,
      totalInvoices: invoices.length,
      totalAppointments: appointments.length,
      appointmentsByStatus,
      appointmentsBySource,
      newClients,
      topServices,
      topStaff,
      onlineGrowth: await this.calculateOnlineGrowth(from, to, appointments),
      ...trends,
    };

    await this.cacheManager.set(cacheKey, result, 60 * 5 * 1000);
    return result;
  }

  private async calculateTrends(fromDate: Date, toDate: Date, currentRevenue: number, currentAppointments: number, currentClients: number) {
    const diffMs = toDate.getTime() - fromDate.getTime() + 1;
    const prevFromDate = new Date(fromDate.getTime() - diffMs);
    const prevToDate = new Date(toDate.getTime() - diffMs);

    const [prevInvoices, prevAppointmentsCount, prevClientsCount] = await Promise.all([
      this.invoiceRepo
        .createQueryBuilder('invoice')
        .where('invoice.createdAt >= :prevFromDate AND invoice.createdAt <= :prevToDate', { prevFromDate, prevToDate })
        .getMany(),
      this.appointmentRepo
        .createQueryBuilder('appointment')
        .where('appointment.date >= :pFrom AND appointment.date <= :pTo', {
          pFrom: prevFromDate.toISOString().split('T')[0],
          pTo: prevToDate.toISOString().split('T')[0]
        })
        .getCount(),
      this.clientRepo
        .createQueryBuilder('client')
        .where('client.createdAt >= :prevFromDate AND client.createdAt <= :prevToDate', { prevFromDate, prevToDate })
        .getCount(),
    ]);

    const prevRevenue = prevInvoices.reduce(
      (sum, inv) =>
        sum +
        Math.max(0, Number(inv.total || 0) - Math.max(0, Number((inv as any).dueCollected || 0))),
      0,
    );

    const getLabel = (ms: number) => {
      const days = Math.round(ms / (24 * 60 * 60 * 1000));
      if (days <= 1) return 'yesterday';
      if (days <= 7) return 'last week';
      if (days <= 31) return 'last month';
      return 'prev. period';
    };

    const label = getLabel(diffMs);

    const formatTrend = (curr: number, prev: number) => {
      if (prev === 0) return { value: curr > 0 ? '100%' : '0%', up: curr > 0, label: `from ${label}` };
      const diff = curr - prev;
      const percent = Math.abs(Math.round((diff / prev) * 100 * 10) / 10);
      return {
        value: `${percent}%`,
        up: diff >= 0,
        label: diff >= 0 ? `from ${label}` : `than ${label}`
      };
    };

    return {
      revenueTrend: formatTrend(currentRevenue, prevRevenue),
      appointmentsTrend: formatTrend(currentAppointments, prevAppointmentsCount),
      clientsTrend: formatTrend(currentClients, prevClientsCount),
      previousRevenue: prevRevenue,
      previousAppointments: prevAppointmentsCount,
      previousClients: prevClientsCount,
    };
  }

  private async calculateOnlineGrowth(from: string, to: string, currentAppointments: Appointment[]) {
    try {
      const [fY, fM, fD] = from.split('-').map(Number);
      const fromDate = new Date(fY, fM - 1, fD);
      const [tY, tM, tD] = to.split('-').map(Number);
      const toDate = new Date(tY, tM - 1, tD);

      const diffMs = toDate.getTime() - fromDate.getTime() + (24 * 60 * 60 * 1000);
      const prevFromDate = new Date(fromDate.getTime() - diffMs);
      const prevToDate = new Date(toDate.getTime() - diffMs);

      const pFrom = prevFromDate.toISOString().split('T')[0];
      const pTo = prevToDate.toISOString().split('T')[0];

      const prevAppointments = await this.appointmentRepo
        .createQueryBuilder('appointment')
        .where('appointment.date >= :pFrom AND appointment.date <= :pTo', { pFrom, pTo })
        .getMany();

      const currentOnline = currentAppointments.filter(a => a.source === 'Online').length;
      const prevOnline = prevAppointments.filter(a => a.source === 'Online').length;

      if (prevOnline === 0) return currentOnline > 0 ? 100 : 0;
      return Math.round(((currentOnline - prevOnline) / prevOnline) * 100);
    } catch (e) {
      return 0;
    }
  }

  async getStaffReports(from: string, to: string) {
    const cacheKey = `staff-reports:v2:${from}:${to}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const [fY, fM, fD] = from.split('-').map(Number);
    const fromDate = new Date(fY, fM - 1, fD, 0, 0, 0, 0);

    const [tY, tM, tD] = to.split('-').map(Number);
    const toDate = new Date(tY, tM - 1, tD, 23, 59, 59, 999);

    const [employees, appointments, invoices] = await Promise.all([
      this.employeeRepo.find({ select: { id: true, name: true, role: true, status: true, branchId: true } }),
      this.appointmentRepo
        .createQueryBuilder('appointment')
        .leftJoinAndSelect('appointment.invoices', 'invoice')
        .where('appointment.date >= :from AND appointment.date <= :to', { from, to })
        .getMany(),
      this.invoiceRepo
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.appointment', 'appointment')
        // Billed activity in the selected period (confirm/create), not only appointment.date
        .where(
          'COALESCE(invoice.confirmedAt, invoice.createdAt) >= :fromDate AND COALESCE(invoice.confirmedAt, invoice.createdAt) <= :toDate',
          { fromDate, toDate },
        )
        .getMany(),
    ]);

    const normalizeStaff = (name?: string | null) => {
      const n = String(name || '').trim();
      if (!n || n.toLowerCase() === 'any' || n === '?' || n === 'N/A') return '';
      return n;
    };

    const staffKey = (branchId: string, name: string) => `${branchId}:${name}`;
    const apptCountByStaff: Record<string, number> = {};
    const revenueByStaff: Record<string, number> = {};
    const countedApptIds = new Set<string>();

    // 1) Invoices in period → revenue + one served appointment each (keeps both columns consistent)
    for (const inv of invoices) {
      const name = normalizeStaff(inv.staff);
      if (!name) continue;
      const staff = staffKey(inv.branchId, name);
      revenueByStaff[staff] =
        (revenueByStaff[staff] || 0) +
        Math.max(0, Number(inv.total || 0) - Math.max(0, Number((inv as any).dueCollected || 0)));
      apptCountByStaff[staff] = (apptCountByStaff[staff] || 0) + 1;
      const apptId = (inv as any).appointment?.id || (inv as any).appointment_id;
      if (apptId) countedApptIds.add(String(apptId));
    }

    // 2) Appointments scheduled in period that are not already counted via an invoice above
    for (const appt of appointments) {
      if (countedApptIds.has(appt.id)) continue;
      const name = normalizeStaff(appt.staff);
      if (!name) continue;
      const staff = staffKey(appt.branchId, name);
      // Skip if this appointment already has any invoice (billed in another period)
      const hasInvoice = Array.isArray((appt as any).invoices) && (appt as any).invoices.length > 0;
      if (hasInvoice) continue;
      apptCountByStaff[staff] = (apptCountByStaff[staff] || 0) + 1;
    }

    const maxAppointments = Math.max(
      ...employees.map((e) => apptCountByStaff[staffKey(e.branchId, e.name)] || 0),
      1,
    );

    const staff = employees
      .map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        branchId: e.branchId,
        status: e.status,
        appointments: apptCountByStaff[staffKey(e.branchId, e.name)] || 0,
        revenue: revenueByStaff[staffKey(e.branchId, e.name)] || 0,
        efficiency: Math.round(((apptCountByStaff[staffKey(e.branchId, e.name)] || 0) / maxAppointments) * 100),
      }))
      .sort((a, b) => b.revenue - a.revenue || b.appointments - a.appointments);

    const result = {
      staff,
      totalStaff: staff.length,
      totalAppointments: staff.reduce((s, e) => s + e.appointments, 0),
      totalRevenue: staff.reduce((s, e) => s + e.revenue, 0),
    };

    await this.cacheManager.set(cacheKey, result, 60 * 5 * 1000);
    return result;
  }
}
