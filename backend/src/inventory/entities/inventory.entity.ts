import { BranchOwned } from '../../tenancy/owned.entity.js';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()

export class Inventory extends BranchOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ type: 'int', default: 0 })
  stockQty: number;

  @Column({ type: 'int', default: 0 })
  minStockLevel: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  @Column()
  supplier: string;

  @Column({ type: 'date' })
  expiryDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
