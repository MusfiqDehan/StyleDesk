import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class RuntimeDatabaseGuard implements OnModuleInit {
  constructor(private readonly ds: DataSource) {}
  async onModuleInit() {
    const [role] = await this.ds.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
    const [owned] = await this.ds.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tableowner=current_user");
    if (role?.rolsuper || role?.rolbypassrls || owned?.count) throw new Error('Runtime DATABASE_URL must use a non-owner role without SUPERUSER/BYPASSRLS; use MIGRATION_DATABASE_URL for provisioning');
  }
}
