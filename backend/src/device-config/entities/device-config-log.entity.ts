import { BranchOwned } from '../../tenancy/owned.entity.js';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'device_config_log' })

export class DeviceConfigLog extends BranchOwned {
  @Column({ name: 'device_id', type: 'uuid', default: () => "NULLIF(current_setting('app.device_id', true), '')::uuid" })
  deviceId: string;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 'manual_update' | 'auto_sync' | 'cron_sync' */
  @Column({ type: 'varchar', length: 32 })
  action: string;

  @Column({ type: 'jsonb' })
  oldValues: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  newValues: Record<string, unknown>;

  /** 'success' | 'db_only' | 'no_change' | 'failed' */
  @Column({ type: 'varchar', length: 32 })
  result: string;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
