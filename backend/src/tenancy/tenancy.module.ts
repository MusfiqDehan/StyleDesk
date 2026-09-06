import { DeviceController } from './device.controller.js';
import { Global, Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Tenant } from './entities/tenant.entity.js';
import { Branch } from './entities/branch.entity.js';
import { RegisteredDevice } from './entities/device.entity.js';
import { TenantMiddleware } from './tenant.middleware.js';
import { ScopedDataSource, ScopedOrmModule } from './scoped-orm.module.js';
import { BranchController } from './branch.controller.js';
import { TenantJobs } from './tenant-jobs.js';
import { randomUUID } from 'node:crypto';
import { requireScope, scopeKey } from './tenant-context.js';
export const SCOPED_CACHE_MANAGER = 'SCOPED_CACHE_MANAGER';
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), ScopedOrmModule.forFeature([Branch, RegisteredDevice])],
  providers: [TenantMiddleware, ScopedDataSource, TenantJobs, {
    provide: SCOPED_CACHE_MANAGER, inject: [CACHE_MANAGER],
    useFactory: (cache: any) => new Proxy(cache, {
      get(target, key) {
        if (['get', 'set', 'del', 'wrap'].includes(String(key))) return async (name: string, ...args: any[]) => {
          const tenantId = requireScope().tenantId;
          const revisionKey = `tenant:${tenantId}:cache-revision`;
          const revision = await target.get(revisionKey) ?? 'initial';
          const result = await target[key](`${scopeKey(name)}:revision:${revision}`, ...args);
          // Any invalidation refreshes business aggregates and shared catalog/client caches.
          if (key === 'del') await target.set(revisionKey, randomUUID(), 0);
          return result;
        };
        if (['clear', 'reset'].includes(String(key))) return () => { throw new Error('Global cache clearing is prohibited'); };
        const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
      },
    }),
  }],
  controllers: [BranchController, DeviceController], exports: [ScopedDataSource, TenantJobs, SCOPED_CACHE_MANAGER],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) { consumer.apply(TenantMiddleware).forRoutes('{*path}'); }
}
