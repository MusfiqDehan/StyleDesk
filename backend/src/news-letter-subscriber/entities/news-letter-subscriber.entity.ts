import { TenantOwned } from '../../tenancy/owned.entity.js';
import { Index as TenantIndex } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
@TenantIndex(['tenantId', 'email'], { unique: true })
export class NewsLetterSubscriber extends TenantOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: false })
  email: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
