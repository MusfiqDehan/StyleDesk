import { DomainProofController } from './domain-proof.controller.js';
import { PosController } from './pos.controller.js';
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InvoiceModule } from '../invoice/invoice.module.js';
import { PlatformDb } from './platform-db.js';
import { PlatformService } from './platform.service.js';
import { PlatformGuard } from './platform.guard.js';
import { AccessService, TenantAccessGuard } from './access.service.js';
import { PlatformController } from './platform.controller.js';
import { AccessController } from './access.controller.js';
import {
  TenantConsoleController,
  TenantPaymentsController,
} from './tenant-console.controller.js';
import { TenantConsoleService } from './tenant-console.service.js';
import { PaymentsService } from './payments.service.js';
import { PlatformWorkers } from './platform-workers.js';
@Global()
@Module({
  imports: [JwtModule.register({}), InvoiceModule],
  providers: [
    PlatformDb,
    PlatformService,
    PlatformGuard,
    AccessService,
    TenantAccessGuard,
    TenantConsoleService,
    PaymentsService,
    PlatformWorkers,
  ],
  controllers: [
    PosController,
    DomainProofController,
    PlatformController,
    AccessController,
    TenantConsoleController,
    TenantPaymentsController,
  ],
  exports: [AccessService, PlatformDb, PaymentsService],
})
export class PlatformModule {}
