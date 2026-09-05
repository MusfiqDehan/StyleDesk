import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
@Entity('tenant')
export class Tenant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ unique: true }) slug: string;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
}
