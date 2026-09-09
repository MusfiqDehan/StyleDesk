import { BranchOwned } from '../../tenancy/owned.entity.js';
import { Index as TenantIndex } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Employee } from '../../employee/entities/employee.entity';

export enum DeviceUserStatus {
  UNLINKED = 'unlinked',
  LINKED = 'linked',
  DELETED = 'deleted',
}

@Entity({ name: 'device_user' })
@TenantIndex(['tenantId', 'branchId', 'deviceId', 'deviceUid'], { unique: true })
export class DeviceUser extends BranchOwned {
  @Column({ name: 'device_id', type: 'uuid', default: () => "NULLIF(current_setting('app.device_id', true), '')::uuid" })
  deviceId: string;

  @PrimaryGeneratedColumn('uuid')
  id: string;


  @Column({ type: 'varchar', length: 64 })
  deviceUid: string;

  // Serial number (SN) of the attendance device this user was last seen on.
  // Populated from the ADMS push (?SN=...) so the dashboard can show which
  // physical device a fingerprint came from when multiple devices are connected.
  @Column({ type: 'varchar', length: 64, nullable: true })
  deviceSerial: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @Column({ type: 'uuid', nullable: true })
  linkedEmployeeId: string | null;

  @ManyToOne(() => Employee, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: false,
  })
  @JoinColumn({ name: 'linkedEmployeeId' })
  linkedEmployee: Relation<Employee> | null;

  @Column({
    type: 'enum',
    enum: DeviceUserStatus,
    default: DeviceUserStatus.UNLINKED,
  })
  status: DeviceUserStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
