import { cursorQueryRows } from '../common/pagination/cursor-query.js';
import { cursorRequest } from '../common/pagination/cursor.js';
import { requireScope as paymentScope } from '../tenancy/tenant-context.js';
import { SCOPED_CACHE_MANAGER } from '../tenancy/tenancy.module.js';
import { ScopedDataSource } from '../tenancy/scoped-orm.module.js';
import { Injectable, NotFoundException, BadRequestException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { StyleDeskPackage } from '../StyleDesk-packages/entities/StyleDesk-package.entity';
import { ServiceService } from '../service/service.service';
import { EmployeeService } from '../employee/employee.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InvoiceSettingService } from './../invoice-setting/invoice-setting.service.js';
import { DataSource } from 'typeorm';
import { PayrollService } from '../payroll/payroll.service.js';
import { getBusinessMonthYear } from '../common/business-date.util.js';
import { normalizeServiceName } from '../service/service.service';
import { NotificationGateway } from '../notification/notification.gateway.js';

/** Hardcoded POS order-taker roles (login-based) — "Name (Role)" or legacy "Role · Name". */
const POS_ORDER_TAKER_ROLE = /^(Admin|Manager|Staff)(?:\s*[·•\-–]\s*.+)?$/i;
const POS_ORDER_TAKER_NAME_ROLE = /^.+\s*\((Admin|Manager|Staff)\)$/i;

function isPosOrderTakerLabel(name: string): boolean {
  const trimmed = name.trim();
  return POS_ORDER_TAKER_ROLE.test(trimmed) || POS_ORDER_TAKER_NAME_ROLE.test(trimmed);
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(StyleDeskPackage)
    private readonly packageRepository: Repository<StyleDeskPackage>,
    private readonly serviceService: ServiceService,
    private readonly employeeService: EmployeeService,
    private readonly invoiceSettingService: InvoiceSettingService,
    private readonly payrollService: PayrollService,
    private readonly dataSource: ScopedDataSource,
    private readonly notificationGateway: NotificationGateway,
    @Inject(SCOPED_CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  /**
   * Sum service + package catalog prices, respecting quantity (duplicate names).
   * Counts are keyed by a case/whitespace-normalized form (matching the convention
   * used by ServiceService) so a qty lookup never silently misses due to the DB's
   * canonical name differing in case from the stored line-item string.
   */
  private async calculateLineItemsTotal(names: string[]): Promise<number> {
    if (!names?.length) return 0;

    const counts = new Map<string, number>();
    const original = new Map<string, string>();
    for (const raw of names) {
      const name = (raw || '').trim();
      if (!name) continue;
      const key = normalizeServiceName(name).toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!original.has(key)) original.set(key, name);
    }
    const uniqueKeys = [...counts.keys()];
    if (uniqueKeys.length === 0) return 0;

    let total = 0;
    const services = await this.serviceService.findByNames(uniqueKeys.map((k) => original.get(k)!));
    const matchedKeys = new Set(services.map((s) => normalizeServiceName(s.name).toLowerCase()));
    for (const service of services) {
      const key = normalizeServiceName(service.name).toLowerCase();
      total += Number(service.price) * (counts.get(key) ?? 1);
    }

    const unmatchedKeys = uniqueKeys.filter((k) => !matchedKeys.has(k));
    if (unmatchedKeys.length > 0) {
      const unmatchedNames = unmatchedKeys.map((k) => original.get(k)!);
      const packages = await this.packageRepository
        .createQueryBuilder('pkg')
        .where('pkg.title IN (:...titles)', { titles: unmatchedNames })
        .getMany();
      for (const pkg of packages) {
        const key = normalizeServiceName(pkg.title).toLowerCase();
        total += Number(pkg.price) * (counts.get(key) ?? 1);
        matchedKeys.add(key);
      }
    }

    const unknown = uniqueKeys.filter(key => !matchedKeys.has(key));
    if (unknown.length) throw new BadRequestException(`Unknown catalog items: ${unknown.map(key => original.get(key)).join(', ')}`);
    return Math.round(total * 100) / 100;
  }

  async findByAppointmentId(appointmentId: string) {
    return this.invoiceRepository.findOne({
      where: { appointment: { id: appointmentId } },
      relations: { client: true, appointment: true },
    });
  }

  /** Derive Due / Partial / Paid from total vs paid amount */
  resolvePaymentStatus(total: number, paidAmount?: number | null): InvoiceStatus {
    const tot = Math.max(0, Number(total) || 0);
    const paid = Math.max(0, Number(paidAmount) || 0);
    if (paid <= 0) return InvoiceStatus.DUE;
    if (paid + 0.009 >= tot) return InvoiceStatus.PAID;
    return InvoiceStatus.PARTIAL;
  }

  /** Sum of unpaid balances across a client's invoices (total − paid). */
  private async getClientOutstandingDue(
    clientId: string,
    manager: EntityManager,
    excludeInvoiceId?: string,
  ): Promise<number> {
    const qb = manager
      .createQueryBuilder(Invoice, 'invoice')
      .innerJoin('invoice.client', 'client')
      .where('client.id = :clientId', { clientId });
    if (excludeInvoiceId) {
      qb.andWhere('invoice.id != :excludeInvoiceId', { excludeInvoiceId });
    }
    const rows = await qb.getMany();
    return rows.reduce((sum, inv) => {
      const total = Math.max(0, Number(inv.total) || 0);
      const paid = Math.max(0, Number(inv.paidAmount) || 0);
      return sum + Math.max(0, total - paid);
    }, 0);
  }

  /**
   * Transfer `amount` of prior due onto a new invoice by increasing paidAmount on
   * older unpaid invoices (oldest first). Returns the allocation trail for audit/rollback.
   */
  private async allocateDueCollectionFifo(
    clientId: string,
    amount: number,
    manager: EntityManager,
  ): Promise<{ invoiceId: string; amount: number }[]> {
    const remainingTarget = Math.round(Math.max(0, amount) * 100) / 100;
    if (remainingTarget <= 0) return [];

    const unpaid = await manager
      .createQueryBuilder(Invoice, 'invoice')
      .innerJoin('invoice.client', 'client')
      .where('client.id = :clientId', { clientId })
      .orderBy('COALESCE(invoice.confirmedAt, invoice.createdAt)', 'ASC')
      .addOrderBy('invoice.createdAt', 'ASC')
      .setLock('pessimistic_write',undefined,['invoice'])
      .getMany();

    const allocations: { invoiceId: string; amount: number }[] = [];
    let left = remainingTarget;

    for (const inv of unpaid) {
      if (left <= 0.009) break;
      const total = Math.max(0, Number(inv.total) || 0);
      const paid = Math.max(0, Number(inv.paidAmount) || 0);
      const due = Math.max(0, total - paid);
      if (due <= 0.009) continue;

      const pending=await manager.query("SELECT id FROM payment_attempt WHERE source='invoice' AND source_id=$1 AND status IN ('init','pending')",[inv.id]);if(pending.length)throw new BadRequestException('Online checkout pending for an invoice included in due collection');
      const apply = Math.min(due, left);
      const nextPaid = Math.round((paid + apply) * 100) / 100;
      inv.paidAmount = nextPaid;
      inv.status = this.resolvePaymentStatus(total, nextPaid);
      await manager.save(inv);
      allocations.push({ invoiceId: inv.id, amount: apply });
      left = Math.round((left - apply) * 100) / 100;
    }

    if (left > 0.05) {
      throw new BadRequestException(
        `Due collection exceeds outstanding balance (short by ${left.toFixed(2)})`,
      );
    }

    return allocations;
  }

  private async reverseDueCollectionAllocations(
    invoice: Invoice,
    manager: EntityManager,
  ): Promise<void> {
    const allocations = invoice.dueCollectionAllocations;
    if (!allocations?.length) return;

    for (const row of allocations) {
      const target = await manager.findOne(Invoice, { where: { id: row.invoiceId },lock:{mode:'pessimistic_write'} });
      const pending=await manager.query("SELECT id FROM payment_attempt WHERE source='invoice' AND source_id=$1 AND status IN ('init','pending')",[row.invoiceId]);if(pending.length)throw new BadRequestException('Online checkout pending for an allocated invoice');
      if (!target) continue;
      const total = Math.max(0, Number(target.total) || 0);
      const paid = Math.max(0, Number(target.paidAmount) || 0);
      const nextPaid = Math.max(0, Math.round((paid - Number(row.amount || 0)) * 100) / 100);
      target.paidAmount = nextPaid;
      target.status = this.resolvePaymentStatus(total, nextPaid);
      await manager.save(target);
    }
  }

  async create(createInvoiceDto: CreateInvoiceDto) {
    if (createInvoiceDto.staff && createInvoiceDto.staff !== 'N/A') await this.employeeService.validateStylistByName(createInvoiceDto.staff);
    if (createInvoiceDto.assistant && createInvoiceDto.assistant !== 'N/A') await this.employeeService.validateAssistantByName(createInvoiceDto.assistant);
    if (createInvoiceDto.total != null) await this.calculateLineItemsTotal([...(createInvoiceDto.services ?? []), ...(createInvoiceDto.packageNames ?? [])]);
    // printBy only required for offline Paid invoices (no linked appointment)
    if (
      createInvoiceDto.status === InvoiceStatus.PAID &&
      !createInvoiceDto.appointmentId &&
      !createInvoiceDto.printBy
    ) {
      throw new BadRequestException('printBy name is required when creating a PAID invoice');
    }
    if (createInvoiceDto.printBy && !isPosOrderTakerLabel(createInvoiceDto.printBy)) {
      await this.employeeService.validateEmployeeByName(createInvoiceDto.printBy);
    }

    let total = createInvoiceDto.total;

    // Auto-calculate total from service + package prices if not provided
    if (total === undefined || total === null) {
      const lineNames = [
        ...(createInvoiceDto.services ?? []),
        ...(createInvoiceDto.packageNames ?? []),
      ];
      if (lineNames.length > 0) {
        total = await this.calculateLineItemsTotal(lineNames);
      }
    }

    // Apply tax if total was provided or recalculated (unless already final).
    // Capture the settings rate used so it is frozen on the invoice.
    let appliedSettingsTaxRate: number | null = null;
    if (total !== undefined && total !== null && !createInvoiceDto.skipTax) {
      const applied = await this.applyTaxWithSnapshot(total);
      total = applied.total;
      appliedSettingsTaxRate = applied.taxRate;
    }

    const paidAmount =
      createInvoiceDto.paidAmount != null ? Math.max(0, Number(createInvoiceDto.paidAmount) || 0) : 0;
    // Always derive status from payment amounts when paidAmount is provided or status omitted
    const resolvedStatus =
      createInvoiceDto.paidAmount != null || !createInvoiceDto.status
        ? this.resolvePaymentStatus(total ?? 0, paidAmount)
        : createInvoiceDto.status;

    let resolvedClientId = createInvoiceDto.clientId;
    let linkedAppointment: Appointment | null = null;

    if (createInvoiceDto.appointmentId) {
      linkedAppointment = await this.appointmentRepository.findOne({
        where: { id: createInvoiceDto.appointmentId },
        relations: { client: true },
      });

      if (!linkedAppointment) {
        throw new NotFoundException(`Appointment ${createInvoiceDto.appointmentId} not found`);
      }

      if (
        createInvoiceDto.clientId &&
        linkedAppointment.client?.id &&
        createInvoiceDto.clientId !== linkedAppointment.client.id
      ) {
        throw new BadRequestException('Invoice clientId does not match appointment client');
      }

      resolvedClientId = resolvedClientId ?? linkedAppointment.client?.id;

      const existingInvoice = await this.findByAppointmentId(createInvoiceDto.appointmentId);
      if (existingInvoice) {
        const wasAlreadyPaid = existingInvoice.status === InvoiceStatus.PAID;
        const { skipTax: _skipTax, clientId: _clientId, appointmentId: _appointmentId, ...invoiceFields } =
          createInvoiceDto;
        const taxSnap =
          this.resolveTaxSnapshot(createInvoiceDto.taxRate, linkedAppointment) ??
          appliedSettingsTaxRate;
        this.invoiceRepository.merge(existingInvoice, {
          ...invoiceFields,
          staff: createInvoiceDto.staff || existingInvoice.staff || 'N/A',
          total: total ?? existingInvoice.total,
          paidAmount,
          status: resolvedStatus,
          // Keep original tax snapshot unless this create provides one (or appointment has one)
          taxRate:
            taxSnap != null
              ? taxSnap
              : existingInvoice.taxRate != null
                ? Number(existingInvoice.taxRate)
                : null,
          // Booking-linked invoices are Online (unless caller sets offline explicitly)
          source:
            createInvoiceDto.source === 'offline'
              ? 'offline'
              : createInvoiceDto.source === 'online'
                ? 'online'
                : 'online',
          client: resolvedClientId ? { id: resolvedClientId } : existingInvoice.client,
          appointment: { id: createInvoiceDto.appointmentId },
        } as any);
        const updated = await this.invoiceRepository.save(existingInvoice);
        await this.cacheManager.del('dashboard:stats');

        if (
          createInvoiceDto.applyCommission &&
          updated.status === InvoiceStatus.PAID &&
          !wasAlreadyPaid &&
          !updated.commissionApplied
        ) {
          const staffName = updated.staff;
          const services = updated.services ?? [];
          if (staffName && staffName !== 'N/A' && services.length > 0) {
            const credited = await this.applyServiceCommission(staffName, services);
            if (credited) {
              updated.commissionApplied = true;
              await this.markCommissionApplied(updated.id);
            }
          }
        }

        return updated;
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const {
        skipTax: _skipTax,
        clientId: _clientId,
        appointmentId: _appointmentId,
        dueCollected: dueCollectedRaw,
        priorDueSnapshot: priorDueSnapshotRaw,
        ...invoiceFields
      } = createInvoiceDto;
      // POS (no appointment) → offline/Walk In; Bookings confirm → online
      const resolvedSource =
        createInvoiceDto.source === 'online' || createInvoiceDto.source === 'offline'
          ? createInvoiceDto.source
          : createInvoiceDto.appointmentId
            ? 'online'
            : 'offline';

      const taxSnap =
        this.resolveTaxSnapshot(createInvoiceDto.taxRate, linkedAppointment) ??
        appliedSettingsTaxRate;

      let dueCollected = Math.max(0, Number(dueCollectedRaw) || 0);
      let priorDueSnapshot =
        priorDueSnapshotRaw != null && Number.isFinite(Number(priorDueSnapshotRaw))
          ? Math.max(0, Number(priorDueSnapshotRaw))
          : null;
      let dueCollectionAllocations: { invoiceId: string; amount: number }[] | null = null;

      if (dueCollected > 0) {
        if (!resolvedClientId) {
          throw new BadRequestException('clientId is required when collecting prior due');
        }
        const outstanding = await this.getClientOutstandingDue(
          resolvedClientId,
          queryRunner.manager,
        );
        if (dueCollected > outstanding + 0.05) {
          throw new BadRequestException(
            `Due collection (${dueCollected}) exceeds outstanding due (${outstanding})`,
          );
        }
        dueCollected = Math.min(dueCollected, outstanding);
        if (priorDueSnapshot == null) priorDueSnapshot = outstanding;
        dueCollectionAllocations = await this.allocateDueCollectionFifo(
          resolvedClientId,
          dueCollected,
          queryRunner.manager,
        );
      }

      const invoice = this.invoiceRepository.create({
        ...invoiceFields,
        staff: createInvoiceDto.staff || 'N/A',
        total: total ?? 0,
        paidAmount,
        status: resolvedStatus,
        source: resolvedSource,
        taxRate: taxSnap,
        packageNames: createInvoiceDto.packageNames?.length
          ? createInvoiceDto.packageNames
          : null,
        dueCollected,
        priorDueSnapshot,
        dueCollectionAllocations,
        client: resolvedClientId ? { id: resolvedClientId } : undefined,
        appointment: createInvoiceDto.appointmentId ? { id: createInvoiceDto.appointmentId } : undefined,
      });

      const savedInvoice = await queryRunner.manager.save(invoice);

      await queryRunner.commitTransaction();
      await this.cacheManager.del('dashboard:stats');

      // Brand-new invoice created directly as Paid (e.g. POS checkout) — credit commission once.
      if (
        createInvoiceDto.applyCommission &&
        savedInvoice.status === InvoiceStatus.PAID &&
        !savedInvoice.commissionApplied
      ) {
        const staffName = savedInvoice.staff;
        const services = savedInvoice.services ?? [];
        if (staffName && staffName !== 'N/A' && services.length > 0) {
          const credited = await this.applyServiceCommission(staffName, services);
          if (credited) {
            savedInvoice.commissionApplied = true;
            await this.markCommissionApplied(savedInvoice.id);
          }
        }
      }

      try {
        this.notificationGateway.emitNewInvoice({ id: savedInvoice.id });
      } catch (err) {
        this.logger.warn(
          `Failed to emit new-invoice for ${savedInvoice.id}: ${(err as Error).message}`,
        );
      }

      return savedInvoice;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    filters?: { invoiceNumber?: string; phone?: string; staff?: string; date?: string; month?: number; year?: number },
    page: number = 1,
    limit: number = 10,
  ) {
    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .leftJoinAndSelect('invoice.appointment', 'appointment')
      .orderBy('invoice.createdAt', 'DESC');

    if (filters?.invoiceNumber) qb.andWhere('invoice.invoiceNumber = :invoiceNumber', { invoiceNumber: filters.invoiceNumber });
    if (filters?.phone) qb.andWhere('client.phone = :phone', { phone: filters.phone });
    if (filters?.staff) qb.andWhere('invoice.staff ILIKE :staff', { staff: `%${filters.staff}%` });
    if (filters?.date) {
      qb.andWhere('DATE(COALESCE(invoice.confirmedAt, invoice.createdAt)) = :date', { date: filters.date });
    } else if (filters?.month && filters?.year) {
      qb.andWhere('EXTRACT(MONTH FROM COALESCE(invoice.confirmedAt, invoice.createdAt)) = :month', { month: filters.month })
        .andWhere('EXTRACT(YEAR FROM COALESCE(invoice.confirmedAt, invoice.createdAt)) = :year', { year: filters.year });
    }

    const skip = (page - 1) * limit;
    if (!cursorRequest()) qb.skip(skip).take(limit);

    const cursor = cursorRequest();
    const [data, total] = cursor ? [await cursorQueryRows(qb, ['/invoice', '/pos/invoices']), cursor.pageInfo!.total] : await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(param: string) {
    const isInvoiceNumber = param.startsWith('INV-');
    const whereCondition = isInvoiceNumber ? { invoiceNumber: param } : { id: param };
    const invoice = await this.invoiceRepository.findOne({ where: whereCondition, relations: { client: true, appointment: true } });
    if (!invoice) throw new NotFoundException(`Invoice ${param} not found`);
    return invoice;
  }

  async update(id: string, updateInvoiceDto: UpdateInvoiceDto) {
    const lockScope = paymentScope();
    await lockScope.runner.query('SELECT id FROM invoice WHERE id=$1 FOR UPDATE',[id]);
    if (!(lockScope as any).paymentSettlement) {
      const [pending] = await lockScope.runner.query("SELECT id FROM payment_attempt WHERE source='invoice' AND source_id=$1 AND status IN ('init','pending')",[id]);
      if (pending) throw new BadRequestException('An online checkout is pending. Settle it before changing this invoice.');
    }
    const invoice = await this.findOne(id);
    if (updateInvoiceDto.staff && updateInvoiceDto.staff !== 'N/A') await this.employeeService.validateStylistByName(updateInvoiceDto.staff);
    if (updateInvoiceDto.assistant && updateInvoiceDto.assistant !== 'N/A') await this.employeeService.validateAssistantByName(updateInvoiceDto.assistant);
    if (updateInvoiceDto.services || updateInvoiceDto.packageNames) await this.calculateLineItemsTotal([...(updateInvoiceDto.services ?? []), ...(updateInvoiceDto.packageNames ?? [])]);

    // Capture original paid state BEFORE any mutation
    const wasAlreadyPaid = invoice.status === InvoiceStatus.PAID;

    if (updateInvoiceDto.printBy && !isPosOrderTakerLabel(updateInvoiceDto.printBy)) {
      await this.employeeService.validateEmployeeByName(updateInvoiceDto.printBy);
    }

    // Tax % and due-collection audit fields are immutable after create
    delete (updateInvoiceDto as any).taxRate;
    delete (updateInvoiceDto as any).dueCollected;
    delete (updateInvoiceDto as any).priorDueSnapshot;
    delete (updateInvoiceDto as any).dueCollectionAllocations;

    // Recalculate total if services and/or packages changed and no explicit total was sent.
    // Must include BOTH line-item kinds even when only one of them was patched, otherwise
    // updating just `services` silently drops the existing packageNames cost (and vice versa).
    const totalProvided =
      updateInvoiceDto.total !== undefined && updateInvoiceDto.total !== null;
    let total = updateInvoiceDto.total;
    let shouldApplyTax = false;
    const servicesChanged = updateInvoiceDto.services !== undefined;
    const packagesChanged = updateInvoiceDto.packageNames !== undefined;
    if (!totalProvided && (servicesChanged || packagesChanged)) {
      const nextServices = servicesChanged ? updateInvoiceDto.services ?? [] : invoice.services ?? [];
      const nextPackages = packagesChanged ? updateInvoiceDto.packageNames ?? [] : invoice.packageNames ?? [];
      total = await this.calculateLineItemsTotal([...nextServices, ...nextPackages]);
      shouldApplyTax = true;
    }

    // Only auto-tax when total was derived from line items — use frozen invoice rate, never live settings
    if (total !== undefined && total !== null && shouldApplyTax) {
      const frozenRate =
        invoice.taxRate != null && Number.isFinite(Number(invoice.taxRate))
          ? Number(invoice.taxRate)
          : 0;
      if (frozenRate > 0) {
        total = total + Math.ceil((total * frozenRate) / 100);
      }
    }

    const nextTotal = total ?? (Number(invoice.total) || 0);
    const nextPaid =
      updateInvoiceDto.paidAmount !== undefined
        ? Math.max(0, Number(updateInvoiceDto.paidAmount) || 0)
        : Number(invoice.paidAmount) || 0;

    // Status is always derived from total vs paid amount — never trust a bare client-supplied
    // `status` in isolation. A patch like `{ status: "Paid" }` with no paidAmount previously
    // bypassed this check entirely, letting an invoice be marked Paid (or reverted to Due)
    // without its paidAmount actually reflecting that, corrupting financial reporting.
    const resolvedStatus = this.resolvePaymentStatus(nextTotal, nextPaid);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.invoiceRepository.merge(invoice, {
        ...updateInvoiceDto,
        total: nextTotal,
        paidAmount: nextPaid,
        status: resolvedStatus,
        client: updateInvoiceDto.clientId ? { id: updateInvoiceDto.clientId } : invoice.client,
        appointment: updateInvoiceDto.appointmentId ? { id: updateInvoiceDto.appointmentId } : invoice.appointment,
      } as any);

      const updatedInvoice = await queryRunner.manager.save(invoice);

      await queryRunner.commitTransaction();
      await this.cacheManager.del('dashboard:stats');

      // Commission only when transitioning to Paid (does not auto-complete booking), and
      // only once ever per invoice — guards against Paid→Due→Paid cycles re-crediting,
      // and against double-crediting when the linked appointment's Completion already did.
      if (
        updateInvoiceDto.applyCommission &&
        resolvedStatus === InvoiceStatus.PAID &&
        !wasAlreadyPaid &&
        !invoice.commissionApplied
      ) {
        const staffName = updatedInvoice.staff;
        const services = updatedInvoice.services ?? [];
        if (staffName && staffName !== 'N/A' && services.length > 0) {
          const credited = await this.applyServiceCommission(staffName, services);
          if (credited) {
            updatedInvoice.commissionApplied = true;
            await this.markCommissionApplied(updatedInvoice.id);
          }
        }
      }

      return updatedInvoice;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async applyTax(total: number): Promise<number> {
    const { total: next } = await this.applyTaxWithSnapshot(total);
    return next;
  }

  private async applyTaxWithSnapshot(
    total: number,
  ): Promise<{ total: number; taxRate: number | null }> {
    const settings = await this.invoiceSettingService.findOne();
    if (!settings.taxRate) return { total, taxRate: null };
    const tax = parseFloat(settings.taxRate.toString());
    if (!Number.isFinite(tax) || tax <= 0) return { total, taxRate: null };
    // Ceil (not plain addition) to match the rounding used by booking confirm and receipts
    return {
      total: total + Math.ceil((total * tax) / 100),
      taxRate: Math.min(100, Math.max(0, tax)),
    };
  }

  /** Freeze tax % at create time from DTO or linked booking — never from live settings on read. */
  private resolveTaxSnapshot(
    dtoRate: number | undefined | null,
    appointment?: Pick<Appointment, 'taxRate'> | null,
  ): number | null {
    if (dtoRate != null && Number.isFinite(Number(dtoRate))) {
      return Math.min(100, Math.max(0, Number(dtoRate)));
    }
    const apptRate = appointment?.taxRate;
    if (apptRate != null && apptRate !== ('' as any) && Number.isFinite(Number(apptRate))) {
      return Math.min(100, Math.max(0, Number(apptRate)));
    }
    return null;
  }

  /**
   * Calculate and add service commission to the stylist's payroll bonus.
   * Called when a PAID invoice is created/transitions to Paid with applyCommission = true
   * and a staff name is set. Returns true if commission was actually credited, so the
   * caller can mark the invoice `commissionApplied` and prevent a second credit later.
   */
  private async applyServiceCommission(staffName: string, services: string[]): Promise<boolean> {
    try {
      const employee = await this.employeeService.findByNameForCommission(staffName);
      if (!employee) {
        this.logger.warn(`[Commission] Employee not found for name "${staffName}", skipping commission.`);
        return false;
      }

      // Use the existing calculateCommission helper (handles duplicate service names correctly)
      const totalCommission = await this.serviceService.calculateCommission(services);

      if (totalCommission <= 0) {
        this.logger.log(`[Commission] Total commission is 0 for services [${services.join(', ')}], skipping.`);
        return false;
      }

      const { month, year } = getBusinessMonthYear();
      const baseSalary = parseFloat(employee.salary?.toString() ?? '0');
      const role = employee.role === 'Other' ? (employee.customRole || employee.role) : employee.role;

      this.logger.log(`[Commission] Adding ৳${totalCommission} commission to ${employee.name} (${month}/${year})`);

      await this.payrollService.addServiceCommission(
        employee.id,
        employee.name,
        role,
        baseSalary,
        totalCommission,
        month,
        year,
      );
      return true;
    } catch (err) {
      this.logger.error('[Commission] Failed to apply service commission:', err);
      return false;
    }
  }

  /** Marks an invoice as having had commission credited — idempotency guard against double-crediting. */
  async markCommissionApplied(invoiceId: string): Promise<void> {
    await this.invoiceRepository.update({ id: invoiceId }, { commissionApplied: true });
  }

  async remove(id: string) {
    const lockScope = paymentScope();
    await lockScope.runner.query('SELECT id FROM invoice WHERE id=$1 FOR UPDATE',[id]);
    if (!(lockScope as any).paymentSettlement) {
      const [pending] = await lockScope.runner.query("SELECT id FROM payment_attempt WHERE source='invoice' AND source_id=$1 AND status IN ('init','pending')",[id]);
      if (pending) throw new BadRequestException('An online checkout is pending. Settle it before changing this invoice.');
    }
    const invoice = await this.findOne(id);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Restore prior dues that were transferred onto this invoice
      await this.reverseDueCollectionAllocations(invoice, queryRunner.manager);
      // Unlink booking only — do not delete the appointment (would destroy booking history)
      const removed = await queryRunner.manager.remove(invoice);
      await queryRunner.commitTransaction();
      await this.cacheManager.del('dashboard:stats');
      return removed;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async removeByAppointmentId(appointmentId: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: { appointment: { id: appointmentId } },
    });
    if (invoice) {
      await this.remove(invoice.id);
    }
  }
}
