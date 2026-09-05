import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';
import { UserRole } from '../../auth/entities/auth.entity.js';

/** Editable role templates (not admin / customer / custom per-user). */
export type EditableRole =
  | UserRole.STORE_MANAGER
  | UserRole.STAFF
  | UserRole.STYLIST;

@Entity('role_permission')

export class RolePermission {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid', default: () => "NULLIF(current_setting('app.tenant_id', true), '')::uuid" })
  tenantId: string;
  @PrimaryColumn({
    type: 'enum',
    enum: UserRole,
  })
  role: EditableRole;

  @Column('simple-array', { nullable: true })
  permissions: string[];

  @UpdateDateColumn()
  updatedAt: Date;
}
