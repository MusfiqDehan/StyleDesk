import { TenantOwned } from '../../tenancy/owned.entity.js';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()

export class Testimonial extends TenantOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  position: string;

  @Column('text')
  description: string;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
