const { migrationDataSource: ds } = require('../dist/src/database/data-source.js');
(async () => {
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required');
  await ds.initialize();
  const migrations = await ds.runMigrations({ transaction: 'all' });
  console.log(`Applied ${migrations.length} migration(s)`);
  const role = process.env.RUNTIME_DATABASE_ROLE;
  if (role) {
    if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error('Invalid runtime role');
    const [check] = await ds.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1', [role]);
    if (!check || check.rolsuper || check.rolbypassrls) throw new Error('Runtime role must exist without SUPERUSER or BYPASSRLS');
    await ds.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    for (const meta of ds.entityMetadatas) {
      if (!meta.columns.some(c => c.databaseName === 'tenant_id')) continue;
      await ds.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON "${meta.tableName}" TO "${role}"`);
    }
    await ds.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"`);
    for (const f of ['resolve_tenant(text)','resolve_device(text,text,text)','scheduled_scopes(boolean)']) await ds.query(`GRANT EXECUTE ON FUNCTION ${f} TO "${role}"`);
  }
  const platformRole = process.env.PLATFORM_DATABASE_ROLE;
  if (platformRole) {
    if (!/^[a-z_][a-z0-9_]*$/.test(platformRole)) throw new Error('Invalid platform role');
    const [check] = await ds.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1', [platformRole]);
    if (!check || check.rolsuper || check.rolbypassrls) throw new Error('Platform role must exist without SUPERUSER or BYPASSRLS');
    await ds.query(`GRANT USAGE ON SCHEMA public TO "${platformRole}"`);
    const tables=['tenant','platform_role','platform_account','platform_package','platform_package_version','tenant_subscription','platform_invitation','platform_audit','platform_outbox','platform_settings','gateway_catalog','tenant_gateway_policy','payment_attempt','payment_event','payment_settlement','tenant_domain'];
    for (const table of tables) await ds.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON "${table}" TO "${platformRole}"`);
    for (const table of ['payment_attempt','payment_settlement']) {
      await ds.query(`DROP POLICY IF EXISTS platform_payment ON ${table}`);
      await ds.query(`CREATE POLICY platform_payment ON ${table} TO "${platformRole}" USING(true) WITH CHECK(true)`);
    }
    for(const signature of ['platform_provision(text,text,text,text,uuid,text)','platform_usage(uuid)','platform_branches(uuid)','platform_seed_tenant(uuid,jsonb,jsonb)','platform_accept_staff(uuid,text)','platform_seed_roles(uuid,jsonb)']) await ds.query(`GRANT EXECUTE ON FUNCTION ${signature} TO "${platformRole}"`);
  }
  if(role) {
    for(const table of ['tenant_gateway','tenant_custom_role','payment_attempt','payment_settlement']) await ds.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO "${role}"`);
    for(const signature of ['tenant_access()','tenant_gateways()','resolve_tenant_host(text)','platform_tenant_identity()']) await ds.query(`GRANT EXECUTE ON FUNCTION ${signature} TO "${role}"`);
  }
  await ds.destroy();
})().catch(e => { console.error(e); process.exit(1); });
