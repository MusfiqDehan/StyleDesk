import {
  isAllowedOriginAsync,
  configureOriginResolver,
} from './common/allowed-origin';
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { TypeOrmExceptionFilter } from './common/filters/typeorm-exception.filter';
import { tenantHostKey } from './tenancy/host.js';
import { DataSource } from 'typeorm';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { requireJwtSecret } from './auth/require-jwt-secret';

process.on('unhandledRejection', (reason) => {
  console.error(
    '[process] Unhandled promise rejection (server kept alive):',
    reason,
  );
});

async function bootstrap() {
  // Fail fast — never sign/verify JWTs with a public fallback secret.
  requireJwtSecret(process.env.JWT_SECRET);

  // Increase the default max listeners to prevent false-positive warnings
  // during hot-reload (start:dev), where Socket.IO / TypeORM pool sockets
  // accumulate listeners across module re-initializations.
  require('events').EventEmitter.defaultMaxListeners = 25;

  if (process.env.DOMAIN_WORKER === 'true') {
    const worker = await NestFactory.createApplicationContext(AppModule);
    worker.enableShutdownHooks();
    return;
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.useWebSocketAdapter(new IoAdapter(app as any));
  app.useGlobalFilters(new TypeOrmExceptionFilter());
  configureOriginResolver(async (host) => {
    const rows = await app
      .get(DataSource)
      .query('SELECT * FROM resolve_tenant_host($1)', [tenantHostKey(host)]);
    return rows.length > 0;
  });
  app.enableCors({
    origin: (origin, callback) => {
      void isAllowedOriginAsync(origin)
        .then((allowed) =>
          callback(allowed ? null : new Error('Origin not allowed'), allowed),
        )
        .catch(() => callback(new Error('Origin unavailable')));
    },
    credentials: true,
  });
  app.use(cookieParser());
  // Raw/text body parser for ZKTeco ADMS (iClock) cloud push endpoints.
  // Must be registered BEFORE json/urlencoded so the device's plain-text body
  // is preserved as a string and isn't discarded as an unrecognised format.
  app.use('/iclock', express.text({ type: '*/*', limit: '1mb' }));
  app.use('/iclock', express.raw({ type: '*/*', limit: '1mb' }));
  // Nest's parser retains the exact bytes needed for Stripe signatures.
  app.useBodyParser('json', { limit: '50mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '50mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Salon Management API')
    .setDescription(
      'REST API for the salon management system — covers authentication, clients, appointments, employees, services, inventory, invoices, attendance, and user management.',
    )
    .setVersion('1.0')
    .addCookieAuth('accessToken')
    .addTag('Auth', 'Login, logout, and password management')
    .addTag(
      'User Management',
      'Create and manage system users (admin/manager only)',
    )
    .addTag('Clients', 'Client profiles and lookup')
    .addTag('Appointments', 'Appointment scheduling and tracking')
    .addTag('Employees', 'Employee records and roles')
    .addTag('Services', 'Salon service catalogue')
    .addTag('Inventory', 'Stock and inventory management')
    .addTag('Invoice', 'Billing and payment records')
    .addTag('Attendance', 'Employee attendance via biometric punch')
    .addTag('Biometric', 'ZKTeco device users and fingerprint linking')
    .addTag(
      'Leave Requests',
      'Employee leave request submissions and approvals',
    )
    .addTag('Announcements', 'Internal announcements for staff and managers')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
