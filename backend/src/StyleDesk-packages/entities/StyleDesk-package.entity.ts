import { TenantOwned } from '../../tenancy/owned.entity.js';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()

export class StyleDeskPackage extends TenantOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  category: string;

  @Column()
  title: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ nullable: true })
  billingCycle: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'simple-array' })
  features: string[];

  @Column({ default: 0 })
  position: number;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: false })
  popular: boolean;

  /** Confirmed bookings for this package */
  @Column({ type: 'int', default: 0 })
  bookingCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
