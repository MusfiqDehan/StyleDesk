import { TenantOwned } from '../../tenancy/owned.entity.js';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()

export class SisterConcerns extends TenantOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  aboveText: string;

  @Column({ nullable: true })
  mainText: string;

  @Column({ type: 'text', nullable: true })
  subText: string;

  @Column({ nullable: true })
  buttonText: string;

  @Column({ nullable: true })
  buttonLink: string;

  @Column({ nullable: true })
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
