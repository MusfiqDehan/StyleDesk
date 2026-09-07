import { cursorRequest } from '../common/pagination/cursor.js';
import { SCOPED_CACHE_MANAGER } from '../tenancy/tenancy.module.js';
import { ScopedDataSource } from '../tenancy/scoped-orm.module.js';
import { Injectable, BadRequestException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike, In, FindOptionsWhere } from 'typeorm';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { Client } from '../clients/entities/client.entity';
import { InvoiceService } from '../invoice/invoice.service';
import { ServiceService } from '../service/service.service';
import { StyleDeskPackage } from '../StyleDesk-packages/entities/StyleDesk-package.entity';
import { EmployeeService } from '../employee/employee.service';
import { PayrollService } from '../payroll/payroll.service.js';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AppointmentSettingService } from '../appointment-setting/appointment-setting.service.js';
import { NotificationGateway } from '../notification/notification.gateway.js';
import { InvoiceSettingService } from '../invoice-setting/invoice-setting.service.js';
import { getBusinessMonthYear } from '../common/business-date.util.js';

const BOOKING_COUNTED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_SERVICE,
  AppointmentStatus.COMPLETED,
];

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(StyleDeskPackage)
    private readonly packageRepository: Repository<StyleDeskPackage>,
    private readonly dataSource: ScopedDataSource,
    private readonly invoiceService: InvoiceService,
    private readonly serviceService: ServiceService,
    private readonly employeeService: EmployeeService,
    private readonly payrollService: PayrollService,
    private readonly appointmentSettingService: AppointmentSettingService,
    private readonly invoiceSettingService: InvoiceSettingService,
    @Inject(SCOPED_CACHE_MANAGER) private cacheManager: Cache,
    private readonly notificationGateway: NotificationGateway,
  ) { }

  private splitNames(value?: string | null): string[] {
    if (!value) return [];
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private normalizeLabel(name: string | undefined | null): string {
    return String(name || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async loadPackageCatalog(): Promise<{ title: string; price: number; key: string }[]> {
    const rows = await this.packageRepository.find();
    return rows.map((p) => ({
      title: p.title,
      price: Number(p.price) || 0,
      key: this.normalizeLabel(p.title).toLowerCase(),
    }));
  }

  /**
   * Resolve one catalog title per selected package unit (duplicates = quantity).
   * Prefers `packageNames[]` from the client; falls back to comma-joined `packageName`.
   */
  private async resolvePackageUnits(
    packageNames?: string[],
    packageName?: string,
  ): Promise<string[]> {
    const catalog = await this.loadPackageCatalog();
    const byKey = new Map(catalog.map((p) => [p.key, p]));
    const units: string[] = [];

    if (Array.isArray(packageNames) && packageNames.length > 0) {
      for (const raw of packageNames) {
        const key = this.normalizeLabel(raw).toLowerCase();
        const hit = byKey.get(key);
        if (hit) units.push(hit.title);
        else {
          this.logger.warn(`Booking package not found in catalog: "${raw}"`);
        }
      }
      return units;
    }

    const raw = packageName?.trim();
    if (!raw) return [];

    // Full-string match first (legacy single package whose title might include commas)
    const fullKey = this.normalizeLabel(raw).toLowerCase();
    const exact = byKey.get(fullKey);
    if (exact) return [exact.title];

    for (const part of this.splitNames(raw)) {
      const key = this.normalizeLabel(part).toLowerCase();
      const hit = byKey.get(key);
      if (hit) units.push(hit.title);
      else {
        this.logger.warn(`Booking package segment not found in catalog: "${part}"`);
      }
    }
    return units;
  }

  private async sumPackageUnitPrices(packageUnits: string[]): Promise<number> {
    if (packageUnits.length === 0) return 0;
    const catalog = await this.loadPackageCatalog();
    const byKey = new Map(catalog.map((p) => [p.key, p]));
    let total = 0;
    for (const title of packageUnits) {
      const hit = byKey.get(this.normalizeLabel(title).toLowerCase());
      if (hit) total += hit.price;
    }
    return total;
  }

  /** Sum catalog prices for all selected packages + all selected services (independent). */
  private async calculateBookingTotal(
    serviceNames: string[] | undefined,
    packageUnits: string[],
  ): Promise<number> {
    let total = await this.sumPackageUnitPrices(packageUnits);

    // Services and packages are billed fully independently — every selected service
    // is charged at its catalog price. Use ServiceService.calculateTotal so qty
    // matching is normalized (DB names often have trailing tabs/spaces).
    const billableServices = this.getBillableServiceNames(serviceNames || []);
    if (billableServices.length > 0) {
      total += await this.serviceService.calculateTotal(billableServices);
    }

    return Math.round(total * 100) / 100;
  }

  private getBillableServiceNames(serviceNames: string[]): string[] {
    return serviceNames.map((s) => this.normalizeLabel(s)).filter(Boolean) as string[];
  }

  private async getCurrentTaxRate(): Promise<number> {
    try {
      const settings = await this.invoiceSettingService.findOne();
      const rate = Number(settings?.taxRate ?? 0);
      return Number.isFinite(rate) && rate > 0 ? rate : 0;
    } catch {
      return 0;
    }
  }

  /** Apply a specific tax rate (ceiled). Does not read live settings. */
  private applyTaxWithRate(subtotal: number, rate: number): number {
    if (!Number.isFinite(rate) || rate <= 0 || subtotal <= 0) return Math.max(0, subtotal);
    const tax = Math.ceil((subtotal * rate) / 100);
    return subtotal + tax;
  }

  private async applyBookingTax(subtotal: number): Promise<{ total: number; taxRate: number }> {
    const taxRate = await this.getCurrentTaxRate();
    return { total: this.applyTaxWithRate(subtotal, taxRate), taxRate };
  }

  private async adjustBookingCounts(
    appointment: Pick<Appointment, 'isPackage' | 'packageName' | 'services'>,
    delta: 1 | -1,
  ) {
    const packageTitles = this.splitNames(appointment.packageName);
    if (appointment.isPackage && packageTitles.length > 0) {
      const expr =
        delta > 0
          ? '"bookingCount" + 1'
          : 'GREATEST("bookingCount" - 1, 0)';
      for (const title of packageTitles) {
        await this.dataSource
          .createQueryBuilder()
          .update(StyleDeskPackage)
          .set({ bookingCount: () => expr })
          .where('title = :title', { title })
          .execute();
      }

      // Mixed bookings also store real catalog services alongside packageName
      const serviceNames = (appointment.services || []).filter((s) => s && s.trim() !== '');
      if (serviceNames.length > 0) {
        const matched = await this.serviceService.findByNames(serviceNames);
        const matchedNames = matched.map((s) => s.name);
        if (matchedNames.length > 0) {
          if (delta > 0) await this.serviceService.incrementBookingCounts(matchedNames);
          else await this.serviceService.decrementBookingCounts(matchedNames);
        }
      }
      return;
    }

    const names = (appointment.services || []).filter((s) => s && s.trim() !== '');
    if (delta > 0) {
      await this.serviceService.incrementBookingCounts(names);
    } else {
      await this.serviceService.decrementBookingCounts(names);
    }
  }

  private toResponse(appointment: Appointment) {
    return {
      id: appointment.id,
      invoiceId: null,
      clientName: appointment.client?.name ?? appointment.clientName,
      phoneNumber: appointment.phoneNumber,
      date: appointment.date,
      time: appointment.time,
      staff: appointment.staff,
      assistant: appointment.assistant,
      source: appointment.source,
      services: appointment.services ?? [],
      notes: appointment.notes,
      status: appointment.status,
      isPackage: appointment.isPackage,
      packageName: appointment.packageName,
      applyCommission: appointment.applyCommission,
      advance: appointment.advance != null ? Number(appointment.advance) : 0,
      discount: appointment.discount != null ? Number(appointment.discount) : 0,
      dueAmount: appointment.dueAmount != null ? Number(appointment.dueAmount) : 0,
      totalAmount: appointment.totalAmount != null ? Number(appointment.totalAmount) : 0,
      taxRate:
        (appointment as any).taxRate != null && (appointment as any).taxRate !== ''
          ? Number((appointment as any).taxRate)
          : null,
      inTime: appointment.inTime ?? null,
      outTime: appointment.outTime ?? null,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      client: appointment.client
        ? {
          id: appointment.client.id,
          name: appointment.client.name,
          phone: appointment.client.phone,
          email: appointment.client.email,
        }
        : null,
    };
  }

  async create(createAppointmentDto: CreateAppointmentDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate business hours
      if (createAppointmentDto.time) {
        await this.validateBusinessHours(createAppointmentDto.time);
      }

      // Validate that selected services are active (when catalog services are provided)
      if (createAppointmentDto.services && createAppointmentDto.services.length > 0) {
        const normalize = (n: string) =>
          String(n || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        // Normalize stored labels so trailing tabs/spaces from catalog don't poison matching later
        createAppointmentDto.services = createAppointmentDto.services
          .map((s) => String(s || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean);

        const activeServices = await this.serviceService.findByNames(createAppointmentDto.services);
        const activeKeys = new Set(activeServices.map((s) => normalize(s.name)));
        // For package-only bookings services may later be filled with feature strings —
        // only enforce when caller already sent service names that should be catalog services.
        // If isPackage and none of the names match, treat them as non-catalog (features) and skip.
        if (!createAppointmentDto.isPackage || activeKeys.size > 0) {
          const invalidServices = createAppointmentDto.services.filter(
            (s) => !activeKeys.has(normalize(s)),
          );
          if (invalidServices.length > 0 && !createAppointmentDto.isPackage) {
            throw new BadRequestException(`These services are not active: ${invalidServices.join(', ')}`);
          }
          if (invalidServices.length > 0 && createAppointmentDto.isPackage && activeKeys.size > 0) {
            // Mixed booking: all provided names should be valid catalog services
            throw new BadRequestException(`These services are not active: ${invalidServices.join(', ')}`);
          }
        }
      }

      // Validate staff name (must be an active Stylist)
      if (createAppointmentDto.staff && createAppointmentDto.staff.toLowerCase() !== 'any') {
        await this.employeeService.validateStylistByName(createAppointmentDto.staff);
      }

      // Validate assistant name (must be an active Assistant)
      if (createAppointmentDto.assistant) {
        await this.employeeService.validateAssistantByName(createAppointmentDto.assistant);
      }

      let client = await queryRunner.manager.findOne(Client, {
        where: { phone: createAppointmentDto.phoneNumber },
      });

      if (!client) {
        client = Object.assign(new Client(), {
          name: createAppointmentDto.clientName,
          phone: createAppointmentDto.phoneNumber,
        });
        client = await queryRunner.manager.save(Client, client);
      }

      // Always price from catalog + settings tax snapshot — never trust client-supplied money fields
      const { packageNames, confirmedTotal: _confirmedTotal, ...appointmentFields } =
        createAppointmentDto as CreateAppointmentDto & { confirmedTotal?: number };
      const packageUnits = await this.resolvePackageUnits(
        packageNames,
        appointmentFields.packageName,
      );
      const computedSubtotal = await this.calculateBookingTotal(
        appointmentFields.services,
        packageUnits,
      );
      const { total: totalAmount, taxRate } = await this.applyBookingTax(computedSubtotal);
      const clientTotal = Number(appointmentFields.totalAmount ?? 0);
      if (clientTotal > 0 && Math.abs(clientTotal - totalAmount) > 1) {
        this.logger.warn(
          `Booking total mismatch: client=${clientTotal} server=${totalAmount} ` +
          `packages=[${packageUnits.join(' | ')}] ` +
          `services=[${(appointmentFields.services || []).join(' | ')}]`,
        );
      }
      const dueRaw =
        appointmentFields.dueAmount != null
          ? Number(appointmentFields.dueAmount)
          : totalAmount;
      const dueAmount = Math.max(0, Math.min(Number.isFinite(dueRaw) ? dueRaw : totalAmount, totalAmount));
      const advanceRaw = Number(appointmentFields.advance ?? 0);
      const advance = Math.max(0, Math.min(Number.isFinite(advanceRaw) ? advanceRaw : 0, totalAmount));
      const discountRaw = Number(appointmentFields.discount ?? 0);
      const discount = Math.max(0, Number.isFinite(discountRaw) ? discountRaw : 0);

      // Keep services as user-selected items only.
      // Do NOT copy package features into services (that broke mixed package+service display/pricing).

      const appointment = queryRunner.manager.create(Appointment, {
        ...appointmentFields,
        // Persist resolved units so qty (duplicate titles) survives for admin display
        packageName: packageUnits.length > 0 ? packageUnits.join(', ') : appointmentFields.packageName,
        isPackage: packageUnits.length > 0 ? true : appointmentFields.isPackage,
        status: AppointmentStatus.PENDING,
        client: client,
        totalAmount,
        taxRate,
        dueAmount,
        advance,
        discount,
      });

      const savedAppointment = await queryRunner.manager.save(Appointment, appointment);

      await queryRunner.commitTransaction();
      await this.cacheManager.del('dashboard:stats');
      const created = await queryRunner.manager.findOne(Appointment, {
        where: { id: savedAppointment.id },
        relations: { client: true },
      });
      const response = created ? this.toResponse(created) : this.toResponse(savedAppointment);
      this.logger.log(`Booking successful, triggering notification for appointment: ${response.id}`);
      try {
        this.notificationGateway.emitNewAppointment(response);
      } catch (notificationError) {
        this.logger.error(`Failed to emit notification: ${(notificationError as Error).message}`);
      }
      return response;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(filters?: { date?: string; source?: string; status?: string; phone?: string; staff?: string; month?: number; year?: number }, page: number = 1, limit: number = 10) {
    const where: FindOptionsWhere<Appointment> = {};
    if (filters?.date) where.date = filters.date;
    if (filters?.source) where.source = ILike(filters.source);
    if (filters?.status) where.status = ILike(filters.status) as FindOptionsWhere<Appointment>['status'];
    if (filters?.phone) where.phoneNumber = ILike(`%${filters.phone}%`);
    if (filters?.staff) where.staff = ILike(`%${filters.staff}%`);

    // Month/year filter via raw column expression
    let monthYearCondition: string | undefined;
    const monthYearParams: Record<string, any> = {};
    if (filters?.month && filters?.year) {
      monthYearCondition = 'EXTRACT(MONTH FROM appointment.date) = :month AND EXTRACT(YEAR FROM appointment.date) = :year';
      monthYearParams.month = filters.month;
      monthYearParams.year = filters.year;
    } else if (filters?.year) {
      monthYearCondition = 'EXTRACT(YEAR FROM appointment.date) = :year';
      monthYearParams.year = filters.year;
    }

    const skip = (page - 1) * limit;

    if (monthYearCondition) {
      const qb = this.appointmentRepository.createQueryBuilder('appointment')
        .leftJoinAndSelect('appointment.client', 'client')
        .where(where)
        .andWhere(monthYearCondition, monthYearParams)
        .orderBy('appointment.createdAt', 'DESC')
        .addOrderBy('appointment.date', 'DESC')
        .addOrderBy('appointment.time', 'DESC')
        .skip(cursorRequest() ? undefined : skip)
        .take(cursorRequest() ? undefined : limit);
      const [data, total] = await qb.getManyAndCount();
      return {
        data: data.map((appointment) => this.toResponse(appointment)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const [data, total] = await this.appointmentRepository.findAndCount({
      where,
      relations: { client: true },
      order: { createdAt: 'DESC', date: 'DESC', time: 'DESC' },
      skip: cursorRequest() ? undefined : skip,
      take: cursorRequest() ? undefined : limit,
    });

    return {
      data: data.map((appointment) => this.toResponse(appointment)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  findOne(phone: string) {
    return this.appointmentRepository.find({ where: { phoneNumber: phone }, relations: { client: true } })
      .then((appointments) => appointments.map((appointment) => this.toResponse(appointment)));
  }

  async updateById(id: string, updateAppointmentDto: UpdateAppointmentDto) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: { client: true },
    });

    if (!appointment) {
      throw new Error(`Appointment with id #${id} not found`);
    }

    // Validate business hours if time is being updated
    if (updateAppointmentDto.time) {
      await this.validateBusinessHours(updateAppointmentDto.time);
    }

    // Validate active services if services are being updated (Skip for packages)
    const isPackageUpdate = updateAppointmentDto.isPackage || appointment.isPackage;
    if (!isPackageUpdate && updateAppointmentDto.services && updateAppointmentDto.services.length > 0) {
      const activeServices = await this.serviceService.findByNames(updateAppointmentDto.services);
      const activeNames = activeServices.map((s) => s.name);
      const invalidServices = updateAppointmentDto.services.filter((s) => !activeNames.includes(s));
      if (invalidServices.length > 0) {
        throw new BadRequestException(`These services are not active: ${invalidServices.join(', ')}`);
      }
    }

    // Validate staff name when provided (must be an active Stylist)
    if (
      updateAppointmentDto.staff &&
      updateAppointmentDto.staff.trim() &&
      updateAppointmentDto.staff.toLowerCase() !== 'any'
    ) {
      await this.employeeService.validateStylistByName(updateAppointmentDto.staff);
    }

    // Validate assistant name (must be an active Assistant)
    if (updateAppointmentDto.assistant) {
      await this.employeeService.validateAssistantByName(updateAppointmentDto.assistant);
    }

    const newlyConfirmed =
      updateAppointmentDto.status === AppointmentStatus.CONFIRMED && appointment.status !== AppointmentStatus.CONFIRMED;
    const newlyCancelled =
      updateAppointmentDto.status === AppointmentStatus.CANCELLED && appointment.status !== AppointmentStatus.CANCELLED;
    const newlyCompleted =
      updateAppointmentDto.status === AppointmentStatus.COMPLETED && appointment.status !== AppointmentStatus.COMPLETED;

    // Do not copy package features into services on update (breaks mixed package+service bookings)

    const { confirmedTotal, ...entityUpdate } = updateAppointmentDto as UpdateAppointmentDto & {
      confirmedTotal?: number;
    };
    // Tax rate is a booking-time snapshot — never overwrite from client / settings changes
    delete (entityUpdate as any).taxRate;
    if (confirmedTotal != null && Number.isFinite(Number(confirmedTotal))) {
      const nextTotal = Math.max(0, Number(confirmedTotal));
      // Never overwrite a stored booking total with 0 from a failed catalog match
      if (nextTotal > 0 || Number((appointment as any).totalAmount ?? 0) <= 0) {
        (entityUpdate as any).totalAmount = nextTotal;
      }
    }
    await this.appointmentRepository.update({ id }, { ...entityUpdate });

    // Re-fetch fresh state from DB — ensures commission uses actual persisted data,
    // not the pre-update snapshot (which may lack services when only status was sent).
    const updated = await this.appointmentRepository.findOne({ where: { id }, relations: { client: true } });
    if (!updated) {
      throw new Error(`Appointment with id #${id} not found after update`);
    }

    if (newlyConfirmed) {
      const serviceNames = updated.services || [];
      const staffName = updated.staff;
      const assistantName = updated.assistant;
      const isPackage = updated.isPackage;
      const packageName = updated.packageName;

      let total = 0;
      let invoiceServices: string[] = [];
      let invoicePackages: string[] = [];

      const packageTitles = await this.resolvePackageUnits(undefined, packageName);
      if (isPackage && packageTitles.length > 0) {
        // Keep every occurrence so invoice qty matches the booking
        invoicePackages = [...packageTitles];
        total += await this.sumPackageUnitPrices(packageTitles);
        // Mixed bookings: charge selected services independently of package features
        const billable = this.getBillableServiceNames(serviceNames);
        if (billable.length > 0) {
          total += await this.serviceService.calculateTotal(billable);
          const matched = await this.serviceService.findByNames(billable);
          const matchedKeys = new Set(
            matched.map((s) => this.normalizeLabel(s.name).toLowerCase()),
          );
          for (const name of billable) {
            if (matchedKeys.has(this.normalizeLabel(name).toLowerCase())) {
              invoiceServices.push(name);
            }
          }
        }
      } else {
        total = await this.serviceService.calculateTotal(serviceNames);
        invoiceServices = [...serviceNames];
        // Package name present even if isPackage flag is off — keep multiplicity
        invoicePackages = [...packageTitles];
        total += await this.sumPackageUnitPrices(packageTitles);
      }

      const discount = Math.max(0, Number(updated.discount ?? 0) || 0);
      const storedTotal = Math.max(0, Number((updated as any).totalAmount ?? 0) || 0);
      const confirmedValue =
        confirmedTotal != null && Number.isFinite(Number(confirmedTotal))
          ? Math.max(0, Number(confirmedTotal))
          : null;
      const hasConfirmedTotal = confirmedValue != null && confirmedValue > 0;
      // Prefer explicit confirm total, then stored booking total, then catalog - discount
      const invoiceTotal = hasConfirmedTotal
        ? confirmedValue!
        : storedTotal > 0
          ? storedTotal
          : Math.max(0, total - discount);
      // Stored/confirmed amounts are final (tax already included by client); catalog path needs tax
      const skipTax = hasConfirmedTotal || storedTotal > 0;

      if (invoiceTotal <= 0) {
        this.logger.warn(
          `[Confirm] Appointment ${id} confirmed with invoice total 0 (catalog=${total}, stored=${storedTotal}, confirmed=${confirmedValue})`,
        );
      }

      const taxRateSnap =
        (updated as any).taxRate != null && Number.isFinite(Number((updated as any).taxRate))
          ? Number((updated as any).taxRate)
          : undefined;

      await this.invoiceService.create({
        clientId: updated.client?.id,
        appointmentId: updated.id,
        services: invoiceServices,
        packageNames: invoicePackages.length ? invoicePackages : undefined,
        total: invoiceTotal,
        paidAmount: Number(updated.advance ?? 0) || 0,
        staff: staffName,
        assistant: assistantName,
        confirmedAt: new Date().toISOString(),
        skipTax,
        taxRate: taxRateSnap,
        // Invoices created from Bookings are Online; POS uses offline/Walk In
        source: 'online',
      });

      try {
        await this.adjustBookingCounts(updated, 1);
      } catch (err) {
        this.logger.error(`Failed to increment booking counts for appointment ${id}: ${(err as Error).message}`);
      }
    }

    if (newlyCancelled) {
      await this.invoiceService.removeByAppointmentId(updated.id);
      if (BOOKING_COUNTED_STATUSES.includes(appointment.status)) {
        try {
          await this.adjustBookingCounts(appointment, -1);
        } catch (err) {
          this.logger.error(`Failed to decrement booking counts for appointment ${id}: ${(err as Error).message}`);
        }
      }
    }

    if (newlyCompleted) {
      const staffName = updated.staff;
      const isPackage = updated.isPackage;
      // Filter out empty/whitespace-only strings that TypeORM simple-array can produce for empty arrays
      const serviceNames = (updated.services || []).filter(s => s && s.trim() !== '');
      const applyCommission = updated.applyCommission !== false;

      this.logger.log(`[Commission] appt=${id} staff="${staffName}" isPackage=${isPackage} services=[${serviceNames.join(',')}] applyCommission=${applyCommission}`);

      if (!applyCommission) {
        this.logger.log(`[Commission] skipped — applyCommission is false`);
      } else if (!staffName || staffName.toLowerCase() === 'any') {
        this.logger.warn(`[Commission] skipped — no valid staff assigned (got "${staffName}")`);
      } else if (isPackage) {
        this.logger.log(`[Commission] skipped — package appointment`);
      } else if (serviceNames.length === 0) {
        this.logger.warn(`[Commission] skipped — services array is empty`);
      } else {
        try {
          const employee = await this.employeeService.findByNameForCommission(staffName);
          if (!employee) {
            this.logger.warn(`[Commission] skipped — no employee found with name "${staffName}"`);
          } else {
            this.logger.log(`[Commission] employee found: id=${employee.id} name="${employee.name}"`);
            const commissionAmount = await this.serviceService.calculateCommission(serviceNames);
            this.logger.log(`[Commission] calculated amount: ${commissionAmount}`);
            if (commissionAmount > 0) {
              // Guard against double-crediting: if the linked invoice already had commission
              // applied via the Paid-invoice path, don't credit it again here.
              const linkedInvoice = await this.invoiceService.findByAppointmentId(id);
              if (linkedInvoice?.commissionApplied) {
                this.logger.log(`[Commission] skipped — already applied via invoice ${linkedInvoice.id}`);
              } else {
                const { month, year } = getBusinessMonthYear();
                await this.payrollService.addServiceCommission(
                  employee.id,
                  employee.name,
                  employee.role === 'Other' ? (employee.customRole || employee.role) : employee.role,
                  Number(employee.salary) || 0,
                  commissionAmount,
                  month,
                  year,
                );
                if (linkedInvoice) {
                  await this.invoiceService.markCommissionApplied(linkedInvoice.id);
                }
                this.logger.log(`[Commission] successfully added ${commissionAmount} to payroll for ${employee.name}`);
              }
            } else {
              this.logger.warn(`[Commission] skipped — commission is 0 for services [${serviceNames.join(', ')}]. Check that services have commission % set and status is active.`);
            }
          }
        } catch (err) {
          this.logger.error(`[Commission] FAILED for appointment ${id}: ${(err as Error).message}`, (err as Error).stack);
        }
      }
    }

    await this.cacheManager.del('dashboard:stats');
    return this.toResponse(updated);
  }

  async update(phone: string, updateAppointmentDto: UpdateAppointmentDto) {
    const appointments = await this.appointmentRepository.find({ where: { phoneNumber: phone }, relations: { client: true } });
    if (!appointments || appointments.length === 0) {
      throw new Error(`Appointment with phone #${phone} not found`);
    }

    // Validate business hours if time is being updated
    if (updateAppointmentDto.time) {
      await this.validateBusinessHours(updateAppointmentDto.time);
    }

    // Validate active services if services are being updated (Skip for packages)
    const isPkg = updateAppointmentDto.isPackage || appointments[0]?.isPackage;
    if (!isPkg && updateAppointmentDto.services && updateAppointmentDto.services.length > 0) {
      const activeServices = await this.serviceService.findByNames(updateAppointmentDto.services);
      const activeNames = activeServices.map(s => s.name);
      const invalidServices = updateAppointmentDto.services.filter(s => !activeNames.includes(s));
      if (invalidServices.length > 0) {
        throw new BadRequestException(`These services are not active: ${invalidServices.join(', ')}`);
      }
    }

    // Validate staff name when provided (must be an active Stylist)
    if (
      updateAppointmentDto.staff &&
      updateAppointmentDto.staff.trim() &&
      updateAppointmentDto.staff.toLowerCase() !== 'any'
    ) {
      await this.employeeService.validateStylistByName(updateAppointmentDto.staff);
    }

    // Validate assistant name (must be an active Assistant)
    if (updateAppointmentDto.assistant) {
      await this.employeeService.validateAssistantByName(updateAppointmentDto.assistant);
    }

    const newlyConfirmed =
      updateAppointmentDto.status === AppointmentStatus.CONFIRMED
        ? appointments.filter((app) => app.status !== AppointmentStatus.CONFIRMED)
        : [];

    const newlyCancelled =
      updateAppointmentDto.status === AppointmentStatus.CANCELLED
        ? appointments.filter((app) => app.status !== AppointmentStatus.CANCELLED)
        : [];

    const { confirmedTotal, ...entityUpdate } = updateAppointmentDto as UpdateAppointmentDto & {
      confirmedTotal?: number;
    };
    // Tax rate is a booking-time snapshot — never overwrite from client / settings changes
    // (matches updateById; this legacy phone-based path previously let it be overwritten).
    delete (entityUpdate as any).taxRate;
    const updatePayload: any = { ...entityUpdate };
    if (confirmedTotal != null && Number.isFinite(Number(confirmedTotal))) {
      const nextTotal = Math.max(0, Number(confirmedTotal));
      // Never overwrite a stored booking total with 0 from a failed catalog match
      if (nextTotal > 0 || appointments.every((a) => Number((a as any).totalAmount ?? 0) <= 0)) {
        updatePayload.totalAmount = nextTotal;
      }
    }

    await this.appointmentRepository.update({ phoneNumber: phone }, updatePayload);

    if (updateAppointmentDto.status === AppointmentStatus.CONFIRMED) {
      for (const appointment of newlyConfirmed) {
        const serviceNames = updateAppointmentDto.services || appointment.services || [];
        const staffName = updateAppointmentDto.staff || appointment.staff;
        const assistantName = updateAppointmentDto.assistant || appointment.assistant;
        const isPackage = updateAppointmentDto.isPackage ?? appointment.isPackage;
        const packageName = updateAppointmentDto.packageName ?? appointment.packageName;

        let total = 0;
        let invoiceServices: string[] = [];
        let invoicePackages: string[] = [];

        const packageTitles = await this.resolvePackageUnits(undefined, packageName);
        if (isPackage && packageTitles.length > 0) {
          invoicePackages = [...packageTitles];
          total += await this.sumPackageUnitPrices(packageTitles);
          const billable = this.getBillableServiceNames(serviceNames);
          if (billable.length > 0) {
            total += await this.serviceService.calculateTotal(billable);
            const matched = await this.serviceService.findByNames(billable);
            const matchedKeys = new Set(
              matched.map((s) => this.normalizeLabel(s.name).toLowerCase()),
            );
            for (const name of billable) {
              if (matchedKeys.has(this.normalizeLabel(name).toLowerCase())) {
                invoiceServices.push(name);
              }
            }
          }
        } else {
          total = await this.serviceService.calculateTotal(serviceNames);
          invoiceServices = [...(serviceNames || [])];
          invoicePackages = [...packageTitles];
          total += await this.sumPackageUnitPrices(packageTitles);
        }

        const discount = Math.max(
          0,
          Number(updateAppointmentDto.discount ?? appointment.discount ?? 0) || 0,
        );
        const storedTotal = Math.max(0, Number((appointment as any).totalAmount ?? 0) || 0);
        const confirmedValue =
          confirmedTotal != null && Number.isFinite(Number(confirmedTotal))
            ? Math.max(0, Number(confirmedTotal))
            : null;
        const hasConfirmedTotal = confirmedValue != null && confirmedValue > 0;
        // Prefer explicit confirm total, then stored booking total, then catalog - discount
        // (aligned with updateById — the ID-based confirm path).
        const invoiceTotal = hasConfirmedTotal
          ? confirmedValue!
          : storedTotal > 0
            ? storedTotal
            : Math.max(0, total - discount);
        // Stored/confirmed amounts are final (tax already included by client); catalog path needs tax
        const skipTax = hasConfirmedTotal || storedTotal > 0;

        if (invoiceTotal <= 0) {
          this.logger.warn(
            `[Confirm] Appointment ${appointment.id} confirmed with invoice total 0 (catalog=${total}, stored=${storedTotal}, confirmed=${confirmedValue})`,
          );
        }

        const taxRateSnap =
          (appointment as any).taxRate != null &&
            Number.isFinite(Number((appointment as any).taxRate))
            ? Number((appointment as any).taxRate)
            : undefined;

        await this.invoiceService.create({
          clientId: appointment.client?.id,
          appointmentId: appointment.id,
          services: invoiceServices,
          packageNames: invoicePackages.length ? invoicePackages : undefined,
          total: invoiceTotal,
          paidAmount: Number(
            updateAppointmentDto.advance ?? appointment.advance ?? 0,
          ) || 0,
          staff: staffName,
          assistant: assistantName,
          confirmedAt: new Date().toISOString(),
          skipTax,
          taxRate: taxRateSnap,
          source: 'online',
        });

        try {
          await this.adjustBookingCounts(
            {
              isPackage: !!isPackage,
              packageName: packageName ?? null,
              services: serviceNames,
            },
            1,
          );
        } catch (err) {
          this.logger.error(
            `Failed to increment booking counts for appointment ${appointment.id}: ${(err as Error).message}`,
          );
        }
      }
    }

    // Cancel → delete the linked invoice
    if (updateAppointmentDto.status === AppointmentStatus.CANCELLED) {
      for (const appointment of newlyCancelled) {
        await this.invoiceService.removeByAppointmentId(appointment.id);
        if (BOOKING_COUNTED_STATUSES.includes(appointment.status)) {
          try {
            await this.adjustBookingCounts(appointment, -1);
          } catch (err) {
            this.logger.error(
              `Failed to decrement booking counts for appointment ${appointment.id}: ${(err as Error).message}`,
            );
          }
        }
      }
    }

    await this.cacheManager.del('dashboard:stats');
    const updatedAppointments = await this.appointmentRepository.find({
      where: { id: In(appointments.map((appointment) => appointment.id)) },
      relations: { client: true },
    });
    return updatedAppointments.map((appointment) => this.toResponse(appointment));
  }

  private async validateBusinessHours(time: string): Promise<void> {
    const settings = await this.appointmentSettingService.findOne();
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const apptMinutes = toMinutes(time);
    if (apptMinutes < toMinutes(settings.openingTime) || apptMinutes >= toMinutes(settings.closingTime)) {
      throw new BadRequestException(
        `Appointment time must be between ${settings.openingTime} and ${settings.closingTime}`,
      );
    }
  }

  async remove(id: string) {
    await this.invoiceService.removeByAppointmentId(id);
    await this.appointmentRepository.delete(id);
    await this.cacheManager.del('dashboard:stats');
  }
}
