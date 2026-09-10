import { TenantOwned } from '../../tenancy/owned.entity.js';
import { Index as TenantIndex } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { Invoice } from '../../invoice/entities/invoice.entity';

@Entity()
@TenantIndex(['tenantId', 'phone'], { unique: true })
export class Client extends TenantOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  name: string;

  @Index()
  @Column({ unique: false })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  preferredStylist: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true, select: false })
  password: string;

  @OneToMany(() => Appointment, (appointment) => appointment.client)
  appointments: Relation<Appointment[]>;

  @OneToMany(() => Invoice, (invoice) => invoice.client)
  invoices: Relation<Invoice[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
