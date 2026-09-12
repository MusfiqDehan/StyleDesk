import { TenantOwned } from '../../tenancy/owned.entity.js';
import { Index as TenantIndex } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum FinanceCategoryType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export enum FinanceCategoryStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('finance_category')

@TenantIndex(['tenantId', 'code'], { unique: true })
export class FinanceCategory extends TenantOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /**
   * Stable system key (e.g. service_revenue). Null for custom categories.
   * Invoice / payroll binding uses this — never the display name.
   */
  @Column({ type: 'varchar', length: 64, nullable: true, unique: false })
  code: string | null;

  /** True for system-bound categories (hidden from Custom Categories UI). */
  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @Column({
    type: 'enum',
    enum: FinanceCategoryType,
  })
  type: FinanceCategoryType;

  @Column({
    type: 'enum',
    enum: FinanceCategoryStatus,
    default: FinanceCategoryStatus.ACTIVE,
  })
  status: FinanceCategoryStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
