import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BranchOwned } from '../owned.entity.js';
@Entity('registered_device')
export class RegisteredDevice extends BranchOwned {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) serial: string;
  @Column({ select: false }) secretHash: string;
  @Column({ type: 'varchar', nullable: true }) allowedIp: string | null;
  @Column({ type: 'varchar', nullable: true }) host: string | null;
  @Column({ default: 4370 }) port: number;
  @Column({ default: true }) active: boolean;
}
