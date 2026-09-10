import { cursorRequest } from '../common/pagination/cursor.js';
import { SCOPED_CACHE_MANAGER } from '../tenancy/tenancy.module.js';
import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, MoreThanOrEqual, In } from 'typeorm';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client } from './entities/client.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @Inject(SCOPED_CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  async create(createClientDto: CreateClientDto) {
    const client = this.clientRepository.create(createClientDto);
    const saved = await this.clientRepository.save(client);
    await this.cacheManager.del('dashboard:stats');
    return saved;
  }

  async findAll(filters?: { time?: string; phone?: string }, page: number = 1, limit: number = 10) {
    const where: any = {};
    if (filters?.phone) {
      where.phone = ILike(`%${filters.phone}%`);
    }
    if (filters?.time) {
      const parsedTime = new Date(filters.time);
      if (!isNaN(parsedTime.getTime())) {
        where.createdAt = MoreThanOrEqual(parsedTime);
      }
    }

    const [clients, total] = await this.clientRepository.findAndCount({
      where,
      relations: { appointments: true, invoices: { appointment: true } },
    });

    const data = clients.map((client) => {
      const invoices = client.invoices ?? [];
      const appointments = client.appointments ?? [];
      const totalSpent = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
      const totalPaid = invoices.reduce(
        (sum, inv) => sum + Math.max(0, Number(inv.paidAmount) || 0),
        0,
      );
      const dueAmount = invoices.reduce((sum, inv) => {
        const total = Number(inv.total) || 0;
        const paid = Number(inv.paidAmount) || 0;
        return sum + Math.max(0, total - paid);
      }, 0);
      // Bookings column = invoice count (completed bills)
      const bookings = invoices.length;

      let onlineBookings = 0;
      let offlineBookings = 0;
      for (const inv of invoices) {
        const hasAppointment = Boolean(
          (inv as any).appointmentId || (inv as any).appointment?.id,
        );
        const sourceRaw = String((inv as any).source || '').toLowerCase();
        const isOnline = hasAppointment || sourceRaw.includes('online');
        if (isOnline) onlineBookings += 1;
        else offlineBookings += 1;
      }

      // Last visit = latest invoice; fall back to latest appointment date
      const invoiceTimes = invoices
        .map((inv) => {
          const raw = (inv as any).confirmedAt ?? inv.createdAt;
          const t = raw ? new Date(raw).getTime() : NaN;
          return Number.isFinite(t) ? t : NaN;
        })
        .filter((t) => Number.isFinite(t));
      const appointmentTimes = appointments
        .map((a) => {
          const raw = a.date;
          if (!raw) return NaN;
          const t = /^\d{4}-\d{2}-\d{2}$/.test(String(raw))
            ? new Date(`${raw}T00:00:00`).getTime()
            : new Date(raw).getTime();
          return Number.isFinite(t) ? t : NaN;
        })
        .filter((t) => Number.isFinite(t));

      const allTimes = [...invoiceTimes, ...appointmentTimes];
      const firstMs = allTimes.length ? Math.min(...allTimes) : null;
      const lastMs = invoiceTimes.length
        ? Math.max(...invoiceTimes)
        : appointmentTimes.length
          ? Math.max(...appointmentTimes)
          : null;

      const firstVisit = firstMs != null ? new Date(firstMs).toISOString() : null;
      const lastVisit = lastMs != null ? new Date(lastMs).toISOString() : null;

      return {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        address: client.address,
        preferredStylist: client.preferredStylist,
        notes: client.notes,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        totalSpent,
        totalPaid,
        dueAmount,
        bookings,
        /** @deprecated use bookings — kept for older clients */
        visits: bookings,
        onlineBookings,
        offlineBookings,
        firstVisit,
        lastVisit,
        appointments: client.appointments,
        invoices: client.invoices,
      };
    });

    data.sort((a, b) => {
      const aLast = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
      const bLast = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
      if (bLast !== aLast) return bLast - aLast;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const skip = (page - 1) * limit;
    const paginatedData = cursorRequest() ? data : data.slice(skip, skip + limit);

    return { data: paginatedData, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findOne(param: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
    if (isUuid) {
      return this.findById(param);
    }
    return this.clientRepository.findOne({ where: { phone: param }, relations: { appointments: true, invoices: true } });
  }

  async findById(id: string) {
    const client = await this.clientRepository.findOne({
      where: { id },
      relations: { appointments: true, invoices: true },
    });

    if (!client) return null;

    const relationAppointments = await this.appointmentRepository.find({
      where: { client: { id } },
      relations: { client: true },
    });

    const phoneAppointments = await this.appointmentRepository.find({
      where: { phoneNumber: client.phone },
      relations: { client: true },
    });

    const appointmentMap = new Map<string, Appointment>();
    for (const appointment of relationAppointments) {
      appointmentMap.set(appointment.id, appointment);
    }
    for (const appointment of phoneAppointments) {
      if (!appointment.client || appointment.client.id !== id) {
        appointment.client = { id } as Client;
      }
      appointmentMap.set(appointment.id, appointment);
    }

    const mergedAppointments = Array.from(appointmentMap.values());

    const appointmentIds = mergedAppointments.map((apt) => apt.id);

    // Include both relation-linked invoices and invoices linked by appointment relation.
    const invoiceWhere: any[] = [{ client: { id } }];
    if (appointmentIds.length > 0) {
      invoiceWhere.push({ appointment: { id: In(appointmentIds) } });
    }

    const invoices = await this.invoiceRepository.find({
      where: invoiceWhere,
      relations: { appointment: true },
    });

    const uniqueInvoices = Array.from(
      new Map(invoices.map((invoice) => [invoice.id, invoice])).values(),
    );

    // Attach invoices to their respective appointment
    const appointmentsWithInvoices = mergedAppointments.map((apt) => ({
      ...apt,
      invoices: uniqueInvoices.filter((inv) =>
        inv.appointment?.id === apt.id,
      ),
    }));

    return { ...client, appointments: appointmentsWithInvoices, invoices: uniqueInvoices };
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    const existingClient = await this.clientRepository.findOne({ where: { id } });
    if (!existingClient) return null;

    const previousName = existingClient.name;
    const previousPhone = existingClient.phone;

    await this.clientRepository.update({ id }, updateClientDto);

    const nextName = updateClientDto.name ?? previousName;
    const nextPhone = updateClientDto.phone ?? previousPhone;

    const appointmentUpdates: Record<string, string> = {}
    if (nextName !== previousName) {
      appointmentUpdates.clientName = nextName;
    }
    if (nextPhone !== previousPhone) {
      appointmentUpdates.phoneNumber = nextPhone;
    }

    if (Object.keys(appointmentUpdates).length > 0) {
      // Keep both relation-linked and legacy phone-only appointments in sync.
      const relationLinkedAppointments = await this.appointmentRepository.find({
        where: { client: { id } },
        relations: { client: true },
      });

      const phoneLinkedAppointments = await this.appointmentRepository.find({
        where: [
          { phoneNumber: previousPhone },
          { phoneNumber: nextPhone },
        ],
        relations: { client: true },
      });

      const appointmentMap = new Map<string, Appointment>();
      for (const appointment of relationLinkedAppointments) {
        appointmentMap.set(appointment.id, appointment);
      }
      for (const appointment of phoneLinkedAppointments) {
        appointmentMap.set(appointment.id, appointment);
      }

      const mergedAppointments = Array.from(appointmentMap.values());
      if (mergedAppointments.length > 0) {
        for (const appointment of mergedAppointments) {
          Object.assign(appointment, appointmentUpdates);
          // Backfill missing relation so future updates always follow client ID.
          if (!appointment.client || appointment.client.id !== id) {
            appointment.client = { id } as Client;
          }
        }
        await this.appointmentRepository.save(mergedAppointments);
      }
    }

    await this.cacheManager.del('dashboard:stats');
    return this.clientRepository.findOne({ where: { id }, relations: { appointments: true, invoices: true } });
  }

  async remove(id: string) {
    const client = await this.clientRepository.findOne({ where: { id } });
    if (!client) return;
    const removed = await this.clientRepository.remove(client);
    await this.cacheManager.del('dashboard:stats');
    return removed;
  }
}
