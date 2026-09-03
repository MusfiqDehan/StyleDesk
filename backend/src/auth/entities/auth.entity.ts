import { TenantOwned } from '../../tenancy/owned.entity.js';
import { Index as TenantIndex } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Employee } from '../../employee/entities/employee.entity';
import { Client } from '../../clients/entities/client.entity';

export enum UserRole {
  ADMIN = 'admin',
  STORE_MANAGER = 'storeManager',
  STAFF = 'staff',
  STYLIST = 'stylist',
  CUSTOM = 'custom',
  CUSTOMER = 'customer',
}

@Entity()
@TenantIndex(['tenantId', 'useremail'], { unique: true })
export class Auth extends TenantOwned {
  @Column({ name: 'branch_id', type: 'uuid', nullable: true, default: () => "NULLIF(current_setting('app.branch_id', true), '')::uuid" })
  branchId: string | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: true }) active: boolean;

  @Column({ name: 'custom_role_id', type: 'uuid', nullable: true }) customRoleId: string | null;

  @Column({ unique: false })
  useremail: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.STAFF,
  })
  role: UserRole;

  @Column('simple-array', { nullable: true })
  permissions: string[]; // for custom permissions like ['invoice', 'inventory']

  @Column({ nullable: true })
  employeeId: string | null;

  @OneToOne(() => Employee, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'employeeId' })
  employee: Relation<Employee> | null;

  @Column({ nullable: true })
  clientId: string | null;

  @OneToOne(() => Client, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clientId' })
  client: Relation<Client> | null;

  @Column({ type: 'varchar', nullable: true })
  resetCode: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resetCodeExpiry: Date | null;

  /** Failed verify/reset attempts against the current resetCode; cleared when a new code is issued. */
  @Column({ type: 'int', default: 0 })
  resetCodeAttempts: number;

  /**
   * Bumped when role/permissions change so existing JWTs are rejected
   * until the user logs in again.
   */
  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
