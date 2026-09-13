import { BranchOwned } from '../../tenancy/owned.entity.js';
import { Index as TenantIndex } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
@TenantIndex('invoice-setting_scope_unique', ['tenantId', 'branchId'], { unique: true })
export class InvoiceSetting extends BranchOwned {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 'BDT' })
  defaultCurrency: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
