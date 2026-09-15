import { Controller, Get, Req } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { AccessService } from './access.service.js';
@Controller('access')
export class AccessController {
  constructor(private access: AccessService) {}
  @Get('bootstrap') bootstrap(@Req() req: any) {
    return this.access.bootstrap(req.user);
  }
  @Public() @Get('public') async publicState() {
    const s = await this.access.state();
    return {
      slug: s.slug,
      canonicalHost:
        s.primaryDomain ??
        s.slug + '.' + (process.env.TENANT_BASE_DOMAIN ?? 'localhost'),
      operational: s.operational,
      landingPage: s.operational && s.features.includes('landing-page'),
      revision: s.revision,
    };
  }
}
