import { BranchOwned } from '../../tenancy/owned.entity.js';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Employee } from '../../employee/entities/employee.entity.js';

export enum PayrollStatus {
  PAID = 'Paid',
  PENDING = 'Pending',
  PROCESSING = 'Processing',
}

@Entity()

export class Payroll extends BranchOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE', nullable: false })
  employee: Relation<Employee>;

  @Column({ nullable: true })
  employeeId: string;

  @Column()
  employeeName: string;

  @Column()
  role: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  baseSalary: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  bonus: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deductions: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  netSalary: number;

  @Column({ type: 'enum', enum: PayrollStatus, default: PayrollStatus.PENDING })
  status: PayrollStatus;

  @Column({ type: 'date', nullable: true })
  payDate: string | null;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int' })
  year: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  calculateNetSalary() {
    this.netSalary =
      Number(this.baseSalary || 0) +
      Number(this.bonus || 0) -
      Number(this.deductions || 0);
  }
}
