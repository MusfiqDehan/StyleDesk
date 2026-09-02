import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'node:path';
export const migrationDataSource = new DataSource({
  type: 'postgres',
  url: process.env.MIGRATION_DATABASE_URL,
  entities: [join(__dirname, '../**/*.entity.js')],
  migrations: [join(__dirname, '../../migrations/*.js')],
  synchronize: false,
  installExtensions: false,
});
export default migrationDataSource;
