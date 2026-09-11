import { BranchOwned } from '../../tenancy/owned.entity.js';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'device_network_config' })

export class DeviceNetworkConfig extends BranchOwned {
  @Column({ name: 'device_id', type: 'uuid', default: () => "NULLIF(current_setting('app.device_id', true), '')::uuid" })
  deviceId: string;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  deviceIp: string;

  @Column({ type: 'int', default: 4370 })
  devicePort: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  subnetMask: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gateway: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  dnsServer: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  communicationKey: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
