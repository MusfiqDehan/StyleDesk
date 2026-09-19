// Development tool: point only at an EMPTY throwaway database, never production.
const fs = require('node:fs');
const { migrationDataSource: ds } = require('../dist/src/database/data-source.js');
(async () => {
  await ds.initialize();
  const existing = await ds.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'migrations'");
  if (existing.length) throw new Error('Baseline generation requires an empty database');
  const sql = await ds.driver.createSchemaBuilder().log();
  fs.writeFileSync('migrations/baseline-schema.json', JSON.stringify(sql.upQueries.map(q => q.query), null, 2) + '\n');
  await ds.destroy();
})().catch(e => { console.error(e); process.exit(1); });
