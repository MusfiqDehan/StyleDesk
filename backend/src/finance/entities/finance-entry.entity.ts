import { BranchOwned } from '../../tenancy/owned.entity.js';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum FinanceEntryType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

/** Which part of a paid payroll this ledger row represents. */
export enum PayrollExpenseComponent {
  SALARY = 'salary',
  BONUS = 'bonus',
}

@Entity('finance_entry')
@Index(['tenantId', 'branchId', 'sourcePayrollId', 'sourcePayrollComponent'], {
  unique: true,
  where: '"sourcePayrollId" IS NOT NULL',
})

export class FinanceEntry extends BranchOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: FinanceEntryType,
  })
  type: FinanceEntryType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Optional category label for ledger grouping */
  @Column({ type: 'varchar', length: 64, nullable: true })
  category: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: number;

  /** Business date YYYY-MM-DD (Asia/Dhaka). */
  @Index()
  @Column({ type: 'date' })
  date: string;

  /**
   * When set, this expense was auto-created from a Paid payroll.
   * Composite-unique with sourcePayrollComponent so one payroll can own
   * a salary row and a bonus row without duplicates.
   */
  @Column({ type: 'uuid', nullable: true })
  sourcePayrollId: string | null;

  /** salary | bonus — null for manual ledger rows. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  sourcePayrollComponent: PayrollExpenseComponent | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
