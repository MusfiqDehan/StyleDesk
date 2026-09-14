import { BranchOwned } from '../../tenancy/owned.entity.js';
import { Index as TenantIndex } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  BeforeInsert,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';

export enum PaymentMethod {
  CASH = 'Cash',
  BKASH = 'bKash',
  NAGAD = 'Nagad',
  BANK = 'Bank',
  CARD = 'Card',
}

export enum InvoiceStatus {
  PAID = 'Paid',
  DUE = 'Due',
  PARTIAL = 'Partial',
}

@Entity()
@TenantIndex(['tenantId', 'invoiceNumber'], { unique: true })
export class Invoice extends BranchOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: false })
  invoiceNumber: string;

  @ManyToOne(() => Client, (client) => client.invoices, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  client: Relation<Client>;

  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Relation<Appointment>;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column('simple-array', { nullable: true })
  services: string[];

  @Column()
  staff: string;

  @Column({ nullable: true })
  assistant: string;

  @Column({ nullable: true })
  printBy: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  paidAmount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DUE,
  })
  status: InvoiceStatus;

  /** Billing origin: offline = POS/Walk In; online = created from Bookings. */
  @Column({ type: 'varchar', length: 20, default: 'offline' })
  source: string;

  /** Package line items (separate from catalog services). */
  @Column('simple-array', { nullable: true })
  packageNames: string[] | null;

  /**
   * Tax % locked when this invoice was created.
   * Settings changes later must not rewrite this — only new invoices get the new rate.
   */
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  taxRate: number | null;

  /** Discount amount (currency, not %) applied at checkout — frozen, like taxRate. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discount: number | null;

  /**
   * Prior customer due included on this invoice (POS "Due Collection").
   * Included in `total` for payment, but excluded from new-sales revenue reports.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  dueCollected: number;

  /** Customer's outstanding due at the moment due collection was added (audit snapshot). */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priorDueSnapshot: number | null;

  /**
   * FIFO allocations applied to older unpaid invoices when this invoice collected due.
   * Used to reverse the transfer if this invoice is deleted.
   */
  @Column({ type: 'simple-json', nullable: true })
  dueCollectionAllocations: { invoiceId: string; amount: number }[] | null;

  /**
   * True once stylist commission has been credited to payroll for this invoice's
   * services — set by either the booking-completion path or the invoice-paid path,
   * whichever runs first. Prevents the other path from crediting it again.
   */
  @Column({ default: false })
  commissionApplied: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateInvoiceNumber() {
    this.invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }
}
