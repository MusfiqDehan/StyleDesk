import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { subscriptionOpen } from '../platform/access.service.js';
import { effectiveFeatures } from '../platform/features.js';
import { Cron } from '@nestjs/schedule';
import { tenantStorage } from './tenant-context.js';
const JOB_FEATURES: Record<string, string> = {
  syncFromDevice: 'attendance', syncRegisteredDevices: 'attendance',
  'enrollment-fallback': 'attendance', generateMonthlyPayroll: 'hr-payroll',
  handleAutoPayrollGenerationMorning: 'hr-payroll', handleAutoPayrollGenerationNoon: 'hr-payroll',
};
@Injectable()
export class TenantJobs {
  private readonly logger = new Logger(TenantJobs.name);
  constructor(private readonly dataSource: DataSource) {}
  async forDevice(tenantId: string, branchId: string, deviceId: string, job: string, work: () => Promise<unknown>) {
    await this.each(job, work, true, { tenantId, branchId, deviceId });
  }
  async each(job: string, work: () => Promise<unknown>, devices = false, selected?: { tenantId: string; branchId: string; deviceId: string }) {
    const feature = JOB_FEATURES[job];
    if (!feature) throw new Error(`Unclassified scheduled job: ${job}`);
    const rows = await this.dataSource.query('SELECT * FROM scheduled_scopes($1)', [devices]);
    for (const row of rows) {
      if (selected && (row.tenant_id !== selected.tenantId || row.branch_id !== selected.branchId || row.device_id !== selected.deviceId)) continue;
      const runner = this.dataSource.createQueryRunner();
      try {
        await runner.connect(); await runner.startTransaction();
        const [lock] = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired', [`${job}:${row.tenant_id}:${row.branch_id}:${row.device_id ?? ''}`]);
        if (!lock.acquired) { await runner.rollbackTransaction(); continue; }
        await runner.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.branch_id',$2,true),set_config('app.device_id',$3,true),set_config('app.all_branches','false',true)", [row.tenant_id,row.branch_id,row.device_id ?? '']);
        const [access]=await runner.query('SELECT tenant_access() AS state');
        if(!subscriptionOpen(access.state)||!effectiveFeatures(access.state.features,access.state.overrides).includes(feature)){await runner.rollbackTransaction();continue;}
        const scope = { tenantId: row.tenant_id, branchId: row.branch_id, deviceId: row.device_id ?? undefined, runner, afterCommit: [] as Array<() => void | Promise<void>> };
        await tenantStorage.run(scope, work);
        await runner.commitTransaction();
        for (const effect of scope.afterCommit) await effect();
      } catch (error) {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        this.logger.error(`Job ${job} failed for branch ${row.branch_id}`, error);
      } finally { if (!runner.isReleased) { await runner.query('SELECT pg_advisory_unlock(hashtext($1))',[`${job}:${row.tenant_id}:${row.branch_id}:${row.device_id ?? ''}`]); await runner.release(); } }
    }
  }
}
export function TenantCron(expression: string, options?: any): MethodDecorator {
  return (target: any, name, descriptor: any) => {
    const original = descriptor.value;
    descriptor.value = function (...args: any[]) {
      if (tenantStorage.getStore() || !this.tenantJobs) return original.apply(this, args);
      return this.tenantJobs.each(String(name), () => original.apply(this, args), ['syncFromDevice', 'syncRegisteredDevices'].includes(String(name)));
    };
    Cron(expression, options)(target, name, descriptor);
  };
}
