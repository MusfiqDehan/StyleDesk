import { BranchOwned } from '../../tenancy/owned.entity.js';
import { Index as TenantIndex } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
@TenantIndex('appointment-setting_scope_unique', ['tenantId', 'branchId'], { unique: true })
export class AppointmentSetting extends BranchOwned {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '09:00' })
  openingTime: string;

  @Column({ default: '21:00' })
  closingTime: string;

  @Column({ default: 30 })
  defaultSlotDuration: number; // in minutes

  @Column({ default: 30 })
  advanceBookingWindow: number; // in days

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
