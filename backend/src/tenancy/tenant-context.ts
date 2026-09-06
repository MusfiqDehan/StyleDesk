import { AsyncLocalStorage } from 'node:async_hooks';
import { ServiceUnavailableException } from '@nestjs/common';
import type { QueryRunner, EntityManager } from 'typeorm';

export interface TenantScope {
  tenantId: string;
  branchId: string | null;
  deviceId?: string;
  runner: QueryRunner;
  afterCommit: Array<() => void | Promise<void>>;
  persistSecurityFailure?: boolean;
}
export const tenantStorage = new AsyncLocalStorage<TenantScope>();
export function requireScope(): TenantScope {
  const scope = tenantStorage.getStore();
  if (!scope || scope.runner.isReleased) throw new ServiceUnavailableException('Tenant context is required');
  return scope;
}
/** Failed verification attempts must survive their 400 response. */
export function persistSecurityFailure(): void {
  const scope = tenantStorage.getStore();
  if (scope) scope.persistSecurityFailure = true;
}
export function scopedManager(): EntityManager { return requireScope().runner.manager; }
export function afterCommit(effect: () => void | Promise<void>): void { requireScope().afterCommit.push(effect); }
export function scopeKey(key: string): string {
  const scope = requireScope();
  return `tenant:${scope.tenantId}:branch:${scope.branchId ?? 'all'}:${key}`;
}

/** Physical device mutations cannot be rolled back: commit database work first. */
export async function commitBeforeDeviceMutation(): Promise<void> {
  const scope = requireScope();
  const runner = scope.runner;
  if (!runner.isTransactionActive) return;
  if ((runner as any).transactionDepth > 1) throw new Error('Device mutations cannot run inside a nested database transaction');
  const [settings] = await runner.query("SELECT current_setting('app.all_branches',true) AS all_branches,current_setting('app.auth_id',true) AS auth_id,current_setting('app.restrict_auth',true) AS restrict_auth");
  await runner.commitTransaction();
  for (const effect of scope.afterCommit.splice(0)) { try { await effect(); } catch (error) { console.error('Post-commit effect failed', error); } }
  await runner.startTransaction();
  await runner.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.branch_id',$2,true),set_config('app.device_id',$3,true),set_config('app.all_branches',$4,true),set_config('app.auth_id',$5,true),set_config('app.restrict_auth',$6,true)", [scope.tenantId,scope.branchId ?? '',scope.deviceId ?? '',settings.all_branches ?? 'false',settings.auth_id ?? '',settings.restrict_auth ?? 'false']);
}
