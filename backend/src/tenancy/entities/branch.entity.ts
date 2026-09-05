import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';
import { TenantOwned } from '../owned.entity.js';
@Entity('branch')
@Index(['tenantId', 'slug'], { unique: true })
export class Branch extends TenantOwned {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column() slug: string;
  @Column({ default: true }) active: boolean;
}
