import { cursorRequest } from '../common/pagination/cursor.js';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator.js';
import { PlatformGuard } from './platform.guard.js';
import { PlatformService } from './platform.service.js';
import { PaymentsService } from './payments.service.js';
import { uuid, required, integer } from './validation.js';
@Public()
@UseGuards(PlatformGuard)
@Controller('platform')
export class PlatformController {
  constructor(
    private service: PlatformService,
    private payments: PaymentsService,
  ) {}
  @Post('login') async login(
    @Body() b: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.login(b);
    res.cookie('platformToken', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400000,
    });
    return result.user;
  }
  @Post('logout') logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('platformToken', { path: '/' });
    return { message: 'Signed out' };
  }
  @Get('me') me(@Req() r: any) {
    return r.platformUser;
  }
  @Get('catalog') catalog() {
    return this.service.catalog();
  }
  @Get('packages/public') publicPackages() {
    return this.service.packages(true);
  }
  @Get('packages') packages() {
    return this.service.packages();
  }
  @Post('packages') newPackage(@Body() b: any, @Req() r: any) {
    return this.service.savePackage(null, b, r.platformUser.id);
  }
  @Patch('packages/:id') updatePackage(
    @Param('id') id: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.service.savePackage(id, b, r.platformUser.id);
  }
  @Post('onboard') onboard(@Body() b: any) {
    return this.service.onboard(b);
  }
  @Post('activate') activate(@Body() b: any) {
    return this.service.activate(b.token);
  }
  @Post('invite/accept') accept(@Body() b: any) {
    return this.service.accept(b);
  }
  @Post('reset/request') reset(@Body() b: any) {
    return this.service.resetRequest(b);
  }
  @Post('reset/confirm') resetConfirm(@Body() b: any) {
    return this.service.resetConfirm(b);
  }
  @Get('onboarding/status') async onboarding(
    @Query('activation_id') id: string,
  ) {
    const [i] = await this.service.db.query(
      "SELECT s.tenant_id,s.email_verified,s.status,v.monthly,v.yearly,v.currency,s.interval,t.slug FROM platform_invitation i JOIN tenant_subscription s ON s.tenant_id=i.tenant_id JOIN tenant t ON t.id=s.tenant_id JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) WHERE i.id=$1 AND i.realm='activation' AND i.revoked_at IS NULL",
      [uuid(id)],
    );
    if (!i) throw new BadRequestException('Unknown onboarding');
    return i;
  }
  @Post('payments/onboarding') async onboardingPayment(@Body() b: any) {
    const s = await this.onboarding(b.activation_id);
    return this.payments.initiateSubscription(s.tenant_id, b);
  }
  @Get('stats') stats() {
    return this.service.stats();
  }
  @Get('tenants') tenants(@Query('search') search: string) {
    return this.service.tenants(search ?? '');
  }
  @Get('tenants/:id') tenant(@Param('id') id: string) {
    return this.service.detail(id);
  }
  @Patch('tenants/:id') updateTenant(
    @Param('id') id: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.service.updateTenant(id, b, r.platformUser.id);
  }
  @Post('tenants/invite') inviteTenant(@Body() b: any, @Req() r: any) {
    return this.service.invite(
      { ...b, realm: 'tenant-onboarding' },
      r.platformUser.id,
    );
  }
  @Patch('tenants/:id/gateways/:slug') policy(
    @Param('id') id: string,
    @Param('slug') slug: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.payments.policy(id, slug, b, r.platformUser.id);
  }
  @Get('users') users() {
    return this.service.users();
  }
  @Post('users/invite') invite(@Body() b: any, @Req() r: any) {
    return this.service.invite(b, r.platformUser.id);
  }
  @Patch('users/:id') updateUser(
    @Param('id') id: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.service.updateUser(id, b, r.platformUser.id);
  }
  @Get('roles') roles() {
    return this.service.roles();
  }
  @Post('roles') addRole(@Body() b: any, @Req() r: any) {
    return this.service.saveRole(null, b, r.platformUser.id);
  }
  @Patch('roles/:id') role(
    @Param('id') id: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.service.saveRole(id, b, r.platformUser.id);
  }
  @Get('gateways') gateways() {
    return this.payments.catalog();
  }
  @Patch('gateways/:slug') gateway(
    @Param('slug') slug: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.payments.saveCatalog(slug, b, r.platformUser.id);
  }
  @Post('gateways/:slug/toggle') async toggle(
    @Param('slug') slug: string,
    @Req() r: any,
  ) {
    const [g] = await this.service.db.query(
      'SELECT enabled_for_tenants FROM gateway_catalog WHERE slug=$1',
      [slug],
    );
    return this.payments.saveCatalog(
      slug,
      { enabled_for_tenants: !g?.enabled_for_tenants },
      r.platformUser.id,
    );
  }
  @Delete('gateways/:slug') async deleteGateway(@Param('slug') slug: string) {
    const [a] = await this.service.db.query(
      'SELECT count(*)::int AS n FROM payment_attempt WHERE gateway_slug=$1',
      [slug],
    );
    if (a.n)
      throw new BadRequestException(
        'Used gateways must be disabled, not deleted',
      );
    await this.service.db.query('DELETE FROM gateway_catalog WHERE slug=$1', [
      slug,
    ]);
    return { message: 'Gateway removed' };
  }
  @Get('subscriptions') subscriptions() {
    return this.service.db.query(
      'SELECT s.*,t.name,t.slug,v.name AS package FROM tenant_subscription s JOIN tenant t ON t.id=s.tenant_id JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) ORDER BY t."createdAt" DESC',
    );
  }
  @Patch('subscriptions/:id') subscriptionUpdate(
    @Param('id') id: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    const allowed = {
      package_id: b.package_id,
      complimentary_until: b.complimentary_until,
      reason: b.reason,
    };
    return this.service.updateTenant(id, allowed, r.platformUser.id);
  }
  @Patch('domains/:id') async domainUpdate(
    @Param('id') id: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.service.db.transaction(async (m) => {
      const [d] = await m.query(
        'SELECT * FROM tenant_domain WHERE id=$1 FOR UPDATE',
        [uuid(id)],
      );
      if (!d) throw new BadRequestException('Unknown domain');
      await m.query(
        'UPDATE tenant_domain SET status=$2,next_check=now(),is_primary=false WHERE id=$1',
        [id, b.disabled ? 'disabled' : 'pending'],
      );
      await this.service.audit(
        m,
        r.platformUser.id,
        d.tenant_id,
        'domain.update',
        d,
        { disabled: !!b.disabled },
        required(b.reason, 'reason', 1000),
      );
      return { message: 'Domain updated' };
    });
  }
  @Get('payments') paymentList() {
    return this.service.db.query(
      "SELECT a.id,a.tran_id,a.tenant_id,t.name,a.amount,a.currency,a.gateway_slug,a.status,a.created_at FROM payment_attempt a JOIN tenant t ON t.id=a.tenant_id WHERE a.source='subscription' ORDER BY a.created_at DESC LIMIT 200",
    );
  }
  @Get('domains') domains() {
    return this.service.db.query(
      'SELECT d.*,t.name AS tenant FROM tenant_domain d JOIN tenant t ON t.id=d.tenant_id ORDER BY d.created_at DESC',
    );
  }
  @Get('audit') audit() {
    return this.service.db.query(
      'SELECT * FROM platform_audit ORDER BY created_at DESC' + (cursorRequest() ? '' : ' LIMIT 200'),
    );
  }
  @Get('settings') async settings() {
    return {
      settings: (
        await this.service.db.query('SELECT value FROM platform_settings')
      )[0].value,
      ...this.service.catalog(),
    };
  }
  @Patch('settings') async settingsSave(@Body() b: any, @Req() r: any) {
    const value = {
      trialDays: integer(b.trialDays, 0, 365),
      graceDays: integer(b.graceDays, 0, 30),
    };
    await this.service.db.transaction(async (m) => {
      const [old] = await m.query(
        'SELECT value FROM platform_settings FOR UPDATE',
      );
      await m.query('UPDATE platform_settings SET value=$1', [
        JSON.stringify(value),
      ]);
      await this.service.audit(
        m,
        r.platformUser.id,
        null,
        'settings.update',
        old.value,
        value,
      );
    });
    return { message: 'Settings saved' };
  }
  @Get('invitations') invitations() {
    return this.service.db.query(
      'SELECT id,realm,email,tenant_id,expires_at,accepted_at,revoked_at FROM platform_invitation ORDER BY created_at DESC LIMIT 200',
    );
  }
  @Post('invitations/:id/resend') resend(
    @Param('id') id: string,
    @Req() r: any,
  ) {
    return this.service.resend(id, r.platformUser.id);
  }
  @Delete('invitations/:id') async revoke(@Param('id') id: string) {
    await this.service.db.query(
      'UPDATE platform_invitation SET revoked_at=now() WHERE id=$1 AND accepted_at IS NULL',
      [uuid(id)],
    );
    return { message: 'Revoked' };
  }
  @Get('payments/available-gateways') available() {
    return this.payments.available(true);
  }
  @Post('payments/ipn') ipn(@Body() b: any) {
    return this.payments.callback(b, true);
  }
  @Post('payments/webhooks/stripe') webhook(@Req() r: any) {
    return this.payments.webhook(
      r.rawBody,
      required(r.headers['stripe-signature'], 'signature', 1000),
      true,
    );
  }
  @Get('payments/status') status(@Query('tran_id') tran: string) {
    return this.payments.status(tran, true);
  }
  @Get('payments/:outcome') async resultGet(
    @Param('outcome') outcome: string,
    @Query() b: any,
    @Res() res: Response,
  ) {
    return this.redirectResult(outcome, b, res);
  }
  @Post('payments/:outcome') async resultPost(
    @Param('outcome') outcome: string,
    @Body() b: any,
    @Res() res: Response,
  ) {
    return this.redirectResult(outcome, b, res);
  }
  private async redirectResult(outcome: string, b: any, res: Response) {
    if (!['success', 'fail', 'cancel'].includes(outcome))
      throw new BadRequestException();
    let status = 'pending';
    if (outcome === 'success')
      status = (await this.payments.callback(b, true)).status;
    return res.redirect(
      303,
      `/payment-result?tran_id=${encodeURIComponent(b.tran_id ?? '')}&payment_status=${status}`,
    );
  }
}
