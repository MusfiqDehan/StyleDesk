import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { tenantStorage } from './tenant-context.js';
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return `${tenantStorage.getStore()?.tenantId ?? 'platform'}:${await super.getTracker(req)}`;
  }
}
