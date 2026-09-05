import { Column, Index } from 'typeorm';

@Index(['tenantId'])
export abstract class TenantOwned {
  @Column({ name: 'tenant_id', type: 'uuid', default: () => "NULLIF(current_setting('app.tenant_id', true), '')::uuid" })
  tenantId: string;
}

@Index(['tenantId', 'branchId'])
export abstract class BranchOwned extends TenantOwned {
  @Column({ name: 'branch_id', type: 'uuid', default: () => "NULLIF(current_setting('app.branch_id', true), '')::uuid" })
  branchId: string;
}
