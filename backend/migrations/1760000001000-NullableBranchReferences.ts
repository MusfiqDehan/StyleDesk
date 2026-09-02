import type { MigrationInterface, QueryRunner } from 'typeorm';
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
/** A nullable branch must never disable tenant validation of an account relation. */
export class NullableBranchReferences1760000001000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    for (const source of runner.connection.entityMetadatas) {
      if (!source.columns.some(column => column.databaseName === 'branch_id' && column.isNullable)) continue;
      for (const fk of source.foreignKeys) {
        const target = fk.referencedEntityMetadata;
        if (!target.columns.some(column => column.databaseName === 'branch_id')) continue;
        const columns = ['tenant_id', ...fk.columns.map(column => column.databaseName)];
        const referenced = ['tenant_id', ...fk.referencedColumns.map(column => column.databaseName)];
        const onDelete = fk.onDelete === 'SET NULL' ? `SET NULL (${fk.columns.map(column => quote(column.databaseName)).join(',')})` : fk.onDelete ?? 'NO ACTION';
        await runner.query(`ALTER TABLE ${quote(source.tableName)} ADD CONSTRAINT ${quote(`${fk.name}_tenant`)} FOREIGN KEY (${columns.map(quote).join(',')}) REFERENCES ${quote(target.tableName)} (${referenced.map(quote).join(',')}) ON DELETE ${onDelete}`);
      }
    }
  }
  async down(): Promise<void> { throw new Error('Do not remove tenant isolation constraints through an automatic rollback'); }
}
