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
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator.js';
import { TenantConsoleService } from './tenant-console.service.js';
import { PaymentsService } from './payments.service.js';
import { requireScope } from '../tenancy/tenant-context.js';
import { required } from './validation.js';
@Controller('tenant-console')
export class TenantConsoleController {
  constructor(
    private console: TenantConsoleService,
    private payments: PaymentsService,
  ) {}
  @Get('usage') usage(@Req() r: any) {
    return this.console.usage(r.user);
  }
  @Get('roles') roles(@Req() r: any) {
    return this.console.roles(r.user);
  }
  @Post('roles') role(@Body() b: any, @Req() r: any) {
    return this.console.saveRole(null, b, r.user);
  }
  @Patch('roles/:id') editRole(
    @Param('id') id: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.console.saveRole(id, b, r.user);
  }
  @Get('invitations') invitations(@Req() r: any) {
    return this.console.invitations(r.user);
  }
  @Post('invitations') invite(@Body() b: any, @Req() r: any) {
    return this.console.invite(b, r.user);
  }
  @Delete('invitations/:id') revoke(@Param('id') id: string, @Req() r: any) {
    return this.console.revoke(id, r.user);
  }
  @Post('invitations/:id/resend') resend(
    @Param('id') id: string,
    @Req() r: any,
  ) {
    return this.console.resend(id, r.user);
  }
  @Public() @Post('accept') accept(@Body() b: any) {
    return this.console.accept(b);
  }
  @Patch('users/:id') assign(
    @Param('id') id: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.console.assign(id, b, r.user);
  }
  @Get('domains') domains(@Req() r: any) {
    return this.console.domains(r.user);
  }
  @Post('domains') domain(@Body() b: any, @Req() r: any) {
    return this.console.addDomain(b, r.user);
  }
  @Patch('domains/:id') domainEdit(
    @Param('id') id: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.console.updateDomain(id, b, r.user);
  }
  @Get('subscription') subscription(@Req() r: any) {
    return this.console.subscription(r.user);
  }
  @Patch('subscription') subscriptionEdit(@Body() b: any, @Req() r: any) {
    return this.console.subscriptionChange(b, r.user);
  }
  @Get('subscription/gateways') async billingGateways(@Req() r: any) {
    await this.console.subscription(r.user);
    return this.payments.available(true);
  }
  @Post('subscription/checkout') async checkout(@Body() b: any, @Req() r: any) {
    await this.console.subscription(r.user);
    return this.payments.initiateSubscription(requireScope().tenantId, b);
  }
}
@Controller('payments')
export class TenantPaymentsController {
  constructor(private payments: PaymentsService) {}
  @Get('gateways') gateways(@Req() r: any) {
    return this.payments.tenantGateways(r.user);
  }
  @Patch('gateways') save(@Body() b: any, @Req() r: any) {
    return this.payments.saveTenantGateway(b, r.user);
  }
  @Get('invoices') invoices(@Req() r: any) {
    return this.payments.invoiceList(r.user);
  }
  @Public() @Get('available-gateways') available() {
    return this.payments.available();
  }
  @Post('initiate') initiate(@Body() b: any, @Req() r: any) {
    return this.payments.initiateInvoice(b, r.user);
  }
  @Public() @Post('ipn') ipn(@Body() b: any) {
    return this.payments.callback(b);
  }
  @Public() @Post('webhooks/stripe') webhook(@Req() r: any) {
    return this.payments.webhook(
      r.rawBody,
      required(r.headers['stripe-signature'], 'signature', 1000),
    );
  }
  @Public() @Get('status') status(@Query('tran_id') tran: string) {
    return this.payments.status(tran);
  }
  @Public() @Get(':outcome') resultGet(
    @Param('outcome') outcome: string,
    @Query() b: any,
    @Res() res: Response,
  ) {
    return this.result(outcome, b, res);
  }
  @Public() @Post(':outcome') resultPost(
    @Param('outcome') outcome: string,
    @Body() b: any,
    @Res() res: Response,
  ) {
    return this.result(outcome, b, res);
  }
  private async result(outcome: string, b: any, res: Response) {
    if (!['success', 'fail', 'cancel'].includes(outcome))
      throw new BadRequestException();
    let status = 'pending';
    if (outcome === 'success')
      status = (await this.payments.callback(b)).status;
    return res.redirect(
      303,
      `/payment-result?tran_id=${encodeURIComponent(b.tran_id ?? '')}&payment_status=${status}`,
    );
  }
}
