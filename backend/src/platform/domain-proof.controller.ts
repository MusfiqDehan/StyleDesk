import { Controller, Get, NotFoundException, Query, Req } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { PlatformDb } from './platform-db.js';
import { required } from './validation.js';

/** Public routing probe only: provisioning hosts cannot use any business API. */
@Controller('domain-proof')
export class DomainProofController {
  constructor(private db: PlatformDb) {}
  @Public() @Get() async verify(
    @Req() req: any,
    @Query('token') token: string,
  ) {
    if (!req.domainProofHost) throw new NotFoundException();
    const [domain] = await this.db.query(
      "SELECT tenant_id FROM tenant_domain WHERE hostname=$1 AND verification_token=$2 AND status IN('provisioning','active') AND verified_at IS NOT NULL",
      [req.domainProofHost, required(token, 'token', 128)],
    );
    if (!domain) throw new NotFoundException();
    return { tenantId: domain.tenant_id };
  }
}
