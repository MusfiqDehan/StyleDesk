import { BranchOwned } from '../../tenancy/owned.entity.js';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { Invoice } from '../../invoice/entities/invoice.entity';

export enum AppointmentStatus {
  PENDING = 'Pending',
  CONFIRMED = 'Confirmed',
  CHECKED_IN = 'Checked In',
  IN_SERVICE = 'In Service',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

@Entity()

export class Appointment extends BranchOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  phoneNumber: string;

  @Index()
  @Column()
  clientName: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  time: string;

  @Column({ nullable: true })
  staff: string;

  @Column({ nullable: true })
  assistant: string;

  @Column({})
  source: string;

  @Column('simple-array', { nullable: true })
  services: string[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDING,
  })
  status: AppointmentStatus;

  @ManyToOne(() => Client, (client) => client.appointments, { nullable: true })
  client: Relation<Client>;

  @OneToMany(() => Invoice, (invoice) => invoice.appointment)
  invoices: Relation<Invoice[]>;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: false })
  isPackage: boolean;

  @Column({ nullable: true })
  packageName: string;

  @Column({ default: true })
  applyCommission: boolean;

  // Booking-sheet financial fields
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  advance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  dueAmount: number;

  /** Catalog total (services + packages + tax at booking time). */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  /**
   * Tax % applied when this booking was created.
   * Settings changes later do not rewrite this — only new bookings get the new rate.
   */
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  taxRate: number | null;

  // Actual arrival / departure times (separate from the scheduled `time`)
  @Column({ type: 'time', nullable: true })
  inTime: string | null;

  @Column({ type: 'time', nullable: true })
  outTime: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
