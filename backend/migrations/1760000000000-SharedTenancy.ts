import type { MigrationInterface, QueryRunner } from 'typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
export class SharedTenancy1760000000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    const existing = await runner.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'migrations'");
    if (existing.length) throw new Error('Fresh installation only: use a new database; existing tables will not be removed');
    await runner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    const baseline: string[] = JSON.parse(readFileSync(join(process.cwd(), 'migrations/baseline-schema.json'), 'utf8'));
    for (const query of baseline) await runner.query(query);
    const owned = runner.connection.entityMetadatas.filter(m => m.columns.some(c => c.databaseName === 'tenant_id'));
    for (const meta of owned) {
      const table = quote(meta.tableName);
      const branch = meta.columns.some(c => c.databaseName === 'branch_id') && meta.tableName !== 'auth';
      if (meta.columns.some(c => c.databaseName === 'id')) {
        await runner.query(`ALTER TABLE ${table} ADD CONSTRAINT ${quote(`${meta.tableName}_tenant_id_key`)} UNIQUE (tenant_id,id)`);
        if (branch) await runner.query(`ALTER TABLE ${table} ADD CONSTRAINT ${quote(`${meta.tableName}_branch_id_key`)} UNIQUE (tenant_id,branch_id,id)`);
      }
    }
    for (const meta of owned) {
      const table = quote(meta.tableName);
      const branch = meta.columns.some(c => c.databaseName === 'branch_id') && meta.tableName !== 'auth';
      const device = meta.columns.some(c => c.databaseName === 'device_id');
      await runner.query(`ALTER TABLE ${table} ADD CONSTRAINT ${quote(`${meta.tableName}_tenant_fk`)} FOREIGN KEY (tenant_id) REFERENCES tenant(id)`);
      if (meta.columns.some(c => c.databaseName === 'branch_id')) {
        await runner.query(`ALTER TABLE ${table} ADD CONSTRAINT ${quote(`${meta.tableName}_branch_fk`)} FOREIGN KEY (tenant_id,branch_id) REFERENCES branch(tenant_id,id)`);
      }
      if (device) await runner.query(`ALTER TABLE ${table} ADD CONSTRAINT ${quote(`${meta.tableName}_device_fk`)} FOREIGN KEY (tenant_id,branch_id,device_id) REFERENCES registered_device(tenant_id,branch_id,id)`);
      await runner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await runner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      const tenantRule = "tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid";
      const branchRule = "branch_id = NULLIF(current_setting('app.branch_id', true),'')::uuid";
      const deviceRule = "device_id = NULLIF(current_setting('app.device_id', true),'')::uuid";
      const authRule = "(current_setting('app.restrict_auth',true) IS DISTINCT FROM 'true' OR id = NULLIF(current_setting('app.auth_id',true),'')::uuid OR branch_id = NULLIF(current_setting('app.branch_id',true),'')::uuid)";
      const readRule = tenantRule + (branch ? ` AND (${branchRule} OR current_setting('app.all_branches',true) = 'true')` : '') + (device ? ` AND ${deviceRule}` : '') + (meta.tableName === 'auth' ? ` AND ${authRule}` : '');
      const writeRule = tenantRule + (branch ? ` AND ${branchRule}` : '') + (device ? ` AND ${deviceRule}` : '') + (meta.tableName === 'auth' ? ` AND ${authRule}` : '');
      await runner.query(`CREATE POLICY tenant_read ON ${table} FOR SELECT USING (${readRule})`);
      await runner.query(`CREATE POLICY tenant_insert ON ${table} FOR INSERT WITH CHECK (${writeRule})`);
      await runner.query(`CREATE POLICY tenant_update ON ${table} FOR UPDATE USING (${writeRule}) WITH CHECK (${writeRule})`);
      await runner.query(`CREATE POLICY tenant_delete ON ${table} FOR DELETE USING (${writeRule})`);
    }
    // Replace ORM ID-only foreign keys with ownership-aware constraints.
    for (const meta of owned) {
      for (const fk of meta.foreignKeys) {
        const target = fk.referencedEntityMetadata;
        if (!target.columns.some(c => c.databaseName === 'tenant_id')) continue;
        const sameBranch = meta.columns.some(c => c.databaseName === 'branch_id') && target.columns.some(c => c.databaseName === 'branch_id');
        const prefix = sameBranch ? ['tenant_id','branch_id'] : ['tenant_id'];
        const source = [...prefix, ...fk.columns.map(c => c.databaseName)];
        const destination = [...prefix, ...fk.referencedColumns.map(c => c.databaseName)];
        await runner.query(`ALTER TABLE ${quote(meta.tableName)} DROP CONSTRAINT ${quote(fk.name)}`);
        const onDelete = fk.onDelete === 'SET NULL' ? `SET NULL (${fk.columns.map(c => quote(c.databaseName)).join(',')})` : fk.onDelete ?? 'NO ACTION';
        await runner.query(`ALTER TABLE ${quote(meta.tableName)} ADD CONSTRAINT ${quote(fk.name)} FOREIGN KEY (${source.map(quote).join(',')}) REFERENCES ${quote(target.tableName)} (${destination.map(quote).join(',')}) ON DELETE ${onDelete}`);
      }
    }
    await runner.query(`ALTER TABLE finance_entry ADD CONSTRAINT finance_payroll_scope_fk FOREIGN KEY (tenant_id,branch_id,"sourcePayrollId") REFERENCES payroll(tenant_id,branch_id,id)`);
    await runner.query(`CREATE UNIQUE INDEX payroll_employee_month_key ON payroll(tenant_id,branch_id,"employeeId",year,month)`);
    await runner.query(`CREATE OR REPLACE FUNCTION normalize_auth_scope() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        NEW.useremail := lower(trim(NEW.useremail));
        IF NEW.role::text IN ('admin','customer') THEN NEW.branch_id := NULL;
        ELSIF NEW.branch_id IS NULL THEN RAISE EXCEPTION 'Staff requires a home branch'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER auth_scope BEFORE INSERT OR UPDATE ON auth FOR EACH ROW EXECUTE FUNCTION normalize_auth_scope();`);
    // Narrow control-plane functions: runtime has no direct cross-tenant directory access.
    await runner.query(`CREATE OR REPLACE FUNCTION resolve_tenant(s text) RETURNS TABLE(tenant_id uuid,branch_id uuid)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
        SELECT t.id,b.id FROM tenant t JOIN branch b ON b.tenant_id=t.id AND b.active
        WHERE t.slug=s AND t.active ORDER BY b.slug LIMIT 1
      $$`);
    await runner.query(`CREATE OR REPLACE FUNCTION resolve_device(s text,h text,ip text) RETURNS TABLE(tenant_id uuid,branch_id uuid,device_id uuid)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
        SELECT d.tenant_id,d.branch_id,d.id FROM registered_device d JOIN tenant t ON t.id=d.tenant_id JOIN branch b ON b.id=d.branch_id
        WHERE d.serial=s AND d.active AND t.active AND b.active AND (d."secretHash"=h OR (d."allowedIp" IS NOT NULL AND d."allowedIp"=ip))
      $$`);
    await runner.query(`CREATE OR REPLACE FUNCTION scheduled_scopes(devices boolean) RETURNS TABLE(tenant_id uuid,branch_id uuid,device_id uuid)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
        SELECT t.id,b.id,CASE WHEN devices THEN d.id ELSE NULL END FROM tenant t JOIN branch b ON b.tenant_id=t.id
        LEFT JOIN registered_device d ON devices AND d.branch_id=b.id AND d.tenant_id=t.id AND d.active
        WHERE t.active AND b.active AND (NOT devices OR d.id IS NOT NULL)
      $$`);
    for (const signature of ['resolve_tenant(text)', 'resolve_device(text,text,text)', 'scheduled_scopes(boolean)']) await runner.query(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC`);
    await runner.query(`REVOKE ALL ON tenant FROM PUBLIC`);
  }
  async down(): Promise<void> { throw new Error('Fresh schema rollback is destructive; restore the disposable database instead'); }
}
