import { TenantOwned } from '../../tenancy/owned.entity.js';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ServiceCategory {
  HAIR = 'Hair',
  SKIN = 'Skin',
  NAILS = 'Nails',
  MAKEUP = 'Makeup',
  SPA = 'Spa',
  BRIDAL = 'Bridal',
  OTHER = 'Other',
}

export enum ServiceStatus {
  ACTIVE = 'active',
  DRAFT = 'draft',
  HIDDEN = 'hidden',
}

@Entity()

export class Service extends TenantOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ServiceCategory,
    default: ServiceCategory.OTHER,
  })
  category: ServiceCategory;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'int', default: 0 })
  duration: number;

  @Column({
    type: 'enum',
    enum: ServiceStatus,
    default: ServiceStatus.ACTIVE,
  })
  status: ServiceStatus;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  commission: number;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  /** Confirmed bookings that include this service */
  @Column({ type: 'int', default: 0 })
  bookingCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
