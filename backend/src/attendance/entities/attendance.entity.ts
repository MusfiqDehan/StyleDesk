import { BranchOwned } from '../../tenancy/owned.entity.js';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Employee } from '../../employee/entities/employee.entity';

export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  HALF_DAY = 'half_day',
  ABSENT = 'absent',
}

@Entity({ name: 'attendance' })
@Unique(['tenantId', 'branchId', 'employeeId', 'attendanceDate'])

export class Attendance extends BranchOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Relation<Employee>;

  @Column({ type: 'varchar', length: 120 })
  employeeName: string;

  @Index()
  @Column({ length: 64 })
  machineId: string;

  // Serial number (SN) of the attendance device this record came from.
  // Used to filter attendance by physical device when several are connected.
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  deviceSerial: string | null;

  @Index()
  @Column({ type: 'date' })
  attendanceDate: string;

  @Column({ type: 'timestamptz', nullable: true })
  checkInTime: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkOutTime: Date | null;

  @Column({
    type: 'int',
    nullable: true,
    comment: 'Total worked time in minutes',
  })
  workingMinutes: number | null;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    nullable: true,
  })
  status: AttendanceStatus | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
