import { DynamicModule, Module, Injectable } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { EntityTarget, ObjectLiteral, EntityManager } from 'typeorm';
import { scopedManager, requireScope, tenantStorage } from './tenant-context.js';

/** Repository tokens remain compatible with Nest's InjectRepository decorator. */
@Module({})
export class ScopedOrmModule {
  static forFeature(entities: Function[]): DynamicModule {
    const providers = entities.map((entity) => ({
      provide: getRepositoryToken(entity),
      useFactory: () => new Proxy({}, {
        get: (_target, property) => {
          if (property === 'constructor') return Repository;
          if (typeof property === 'symbol') return undefined;
          if (['then', 'onModuleInit', 'onApplicationBootstrap', 'onModuleDestroy', 'onApplicationShutdown'].includes(String(property))) return undefined;
          if (!tenantStorage.getStore()) return undefined;
          const repository = scopedManager().getRepository(entity as EntityTarget<ObjectLiteral>);
          const value = Reflect.get(repository, property);
          return typeof value === 'function' ? value.bind(repository) : value;
        },
      }),
    }));
    return { module: ScopedOrmModule, imports: [TypeOrmModule.forFeature(entities)], providers, exports: providers };
  }
}

/** Existing business transactions reuse the tenant connection, including savepoints. */
@Injectable()
export class ScopedDataSource {
  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>) { return scopedManager().getRepository(entity); }
  query<T = any>(sql: string, parameters?: any[]): Promise<T> { return scopedManager().query(sql, parameters); }
  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> { return scopedManager().transaction(work); }
  createQueryBuilder() { return scopedManager().createQueryBuilder(); }
  createQueryRunner() {
    const runner = requireScope().runner;
    return new Proxy(runner, {
      get(target, key) {
        if (key === 'connect') return async () => (target as any).databaseConnection;
        if (key === 'release') return async () => undefined;
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }
}
