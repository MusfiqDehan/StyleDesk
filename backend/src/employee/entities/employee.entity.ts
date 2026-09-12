import { BranchOwned } from '../../tenancy/owned.entity.js';
import { Index as TenantIndex } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Payroll } from '../../payroll/entities/payroll.entity.js';

export enum EmployeeRole {
  STYLIST = 'Stylist',
  MANAGER = 'Manager',
  RECEPTIONIST = 'Receptionist',
  ASSISTANT = 'Assistant',
  OTHER = 'Other',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
  RESIGNED = 'RESIGNED',
  RETIRED = 'RETIRED',
  PROBATION = 'PROBATION',
  TRAINING = 'TRAINING',
}

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
}

@Entity()
@TenantIndex(['tenantId', 'phone'], { unique: true })
@TenantIndex(['tenantId', 'email'], { unique: true })
export class Employee extends BranchOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: EmployeeRole,
    default: EmployeeRole.OTHER,
  })
  role: EmployeeRole;

  @Column({ type: 'varchar', nullable: true })
  customRole: string | null;

  @Column({ unique: false })
  phone: string;

  @Column({ nullable: true, unique: false })
  email: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  salary: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  commission: number;

  @Column({ nullable: true })
  shift: string;

  @Column({ type: 'int', default: 0 })
  experience: number;

  @Column({ type: 'date', nullable: true })
  joinDate: string;

  @Column({
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.ACTIVE,
  })
  status: EmployeeStatus;

  @Column({
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: false })
  fingerprintCode: string | null;

  @Column({ type: 'simple-array', nullable: true })
  specializations: string[];

  @Column({ type: 'varchar', nullable: true })
  image: string | null;

  @Column({ type: 'text', nullable: true })
  about: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Payroll, (payroll) => payroll.employee)
  payrolls: Relation<Payroll[]>;

  @UpdateDateColumn()
  updatedAt: Date;
}
