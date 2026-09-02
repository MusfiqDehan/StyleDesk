import { RuntimeDatabaseGuard } from './tenancy/runtime-database.guard.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { types as pgTypes } from 'pg';

// Columns are `timestamp without time zone` but Nest/TypeORM write UTC wall-clock.
// node-pg otherwise reads them as the host local TZ (Asia/Dhaka here), which shifts
// every createdAt back by 6h and makes Order Time show e.g. 5:46 AM instead of 11:46 AM.
const PG_TIMESTAMP_OID = 1114;
pgTypes.setTypeParser(PG_TIMESTAMP_OID, (value: string) => {
  if (!value) return value;
  // Treat naive timestamps as UTC
  const utc = /Z$/i.test(value) || /[+-]\d{2}:?\d{2}$/.test(value)
    ? value
    : `${value.replace(' ', 'T')}Z`;
  return new Date(utc);
});

@Module({
    providers: [RuntimeDatabaseGuard],
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            url: process.env.DATABASE_URL,
            autoLoadEntities: true,
            // Schema synchronization can drop or rewrite production data during
            // dependency upgrades. Production changes must use reviewed SQL.
            synchronize: false,
            installExtensions: false,
            logging: ['error'],
        }),
    ],
})
export class DatabaseModule { }
