import { TenantOwned } from '../../tenancy/owned.entity.js';
import { Index as TenantIndex } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
@TenantIndex('bussiness-info_scope_unique', ['tenantId'], { unique: true })
export class BussinessInfo extends TenantOwned {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  businessName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  gstNumber: string;

  @Column({ type: 'varchar', nullable: true })
  contactSectionTitle: string;

  @Column({ type: 'text', nullable: true })
  contactSectionDescription: string;

  @Column({ type: 'text', nullable: true })
  mapEmbedUrl: string;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  /** When true, public marketing site is unreachable; visitors see admin login instead. */
  @Column({ type: 'boolean', default: false })
  hideMainWebsite: boolean;

  /** Display order for /packages and admin manage-packages. */
  @Column({ type: 'varchar', default: 'newest' })
  packagesSortOrder: string;

  /** Display order for /services and admin services. */
  @Column({ type: 'varchar', default: 'newest' })
  servicesSortOrder: string;

  @Column({ type: 'varchar', length: 7, default: '#7040c1' })
  primaryColor: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
