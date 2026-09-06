import { BranchOwned } from '../../tenancy/owned.entity.js';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AnnouncementPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum AnnouncementTarget {
  ALL = 'all',
  STAFFS = 'staffs',
  MANAGERS = 'managers',
}

@Entity({ name: 'announcement' })

export class Announcement extends BranchOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: AnnouncementPriority, default: AnnouncementPriority.MEDIUM })
  priority: AnnouncementPriority;

  @Column({ type: 'enum', enum: AnnouncementTarget, default: AnnouncementTarget.ALL })
  target: AnnouncementTarget;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
