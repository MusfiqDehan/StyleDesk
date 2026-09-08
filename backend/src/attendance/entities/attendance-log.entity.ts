import { BranchOwned } from '../../tenancy/owned.entity.js';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';

@Entity({ name: 'attendance_log' })
@Unique(['tenantId', 'branchId', 'deviceId', 'deviceUserId', 'scannedAt'])

export class AttendanceLog extends BranchOwned {
  @Column({ name: 'device_id', type: 'uuid', default: () => "NULLIF(current_setting('app.device_id', true), '')::uuid" })
  deviceId: string;

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ type: 'varchar', length: 64 })
    deviceUserId: string;

    // Serial number (SN) of the device that produced this scan, from the ADMS push.
    // Null for TCP-mode scans (single local device) or legacy rows.
    @Index()
    @Column({ type: 'varchar', length: 64, nullable: true })
    deviceSerial: string | null;

    @Index()
    @Column({ type: 'timestamptz' })
    scannedAt: Date;

    @Column({ type: 'smallint', default: 0 })
    verifyMethod: number;

    @Column({ type: 'smallint', default: 0 })
    inOutStatus: number;

    @Column({ type: 'boolean', default: false })
    suppressed: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
