import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
@Injectable()
export class PlatformDb implements OnModuleInit, OnModuleDestroy {
  readonly ds = new DataSource({
    type: 'postgres',
    url: process.env.PLATFORM_DATABASE_URL,
    entities: [],
    synchronize: false,
  });
  async onModuleInit() {
    if (
      !process.env.PLATFORM_JWT_SECRET ||
      process.env.PLATFORM_JWT_SECRET.length < 24 ||
      process.env.PLATFORM_JWT_SECRET === process.env.JWT_SECRET
    )
      throw new Error(
        'Use a distinct PLATFORM_JWT_SECRET with at least 24 characters',
      );
    if (!/^[a-f0-9]{64}$/i.test(process.env.PAYMENT_ENCRYPTION_KEY ?? ''))
      throw new Error('PAYMENT_ENCRYPTION_KEY must be 64 hex characters');
    if (!process.env.PLATFORM_DATABASE_URL)
      throw new Error(
        'PLATFORM_DATABASE_URL is required; use a restricted platform role',
      );
    await this.ds.initialize();
    const [r] = await this.ds.query(
      "SELECT rolsuper,rolbypassrls, (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tableowner=current_user)::int AS owned FROM pg_roles WHERE rolname=current_user",
    );
    if (r.rolsuper || r.rolbypassrls || r.owned)
      throw new Error(
        'Platform connection must be a non-owner without BYPASSRLS',
      );
  }
  query(sql: string, args: any[] = []): Promise<any[]> {
    return this.ds.query(sql, args);
  }
  transaction<T>(work: (m: EntityManager) => Promise<T>): Promise<T> {
    return this.ds.transaction(work);
  }
  async onModuleDestroy() {
    if (this.ds.isInitialized) await this.ds.destroy();
  }
}
