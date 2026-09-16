import { cursorRequest } from '../common/pagination/cursor.js';
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  BadGatewayException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  PlatformService,
  platformOrigin,
  tenantOrigin,
} from './platform.service.js';
import { AccessService } from './access.service.js';
import { decrypt, encrypt, verifyStripe, hashToken } from './crypto.js';
import {
  gateway,
  missingFields,
  minorUnits,
  StripeAdapter,
} from './gateway-adapters.js';
import { required, uuid } from './validation.js';
import { requireScope, tenantStorage } from '../tenancy/tenant-context.js';
import { InvoiceService } from '../invoice/invoice.service.js';
@Injectable()
export class PaymentsService {
  constructor(
    private platform: PlatformService,
    private access: AccessService,
    private invoice: InvoiceService,
    private ds: DataSource,
  ) {}
  async catalog() {
    const rows = await this.platform.db.query(
      'SELECT * FROM gateway_catalog ORDER BY sort_order,slug',
    );
    return rows.map(({ credentials, ...g }) => ({
      ...g,
      has_credentials: !!credentials,
      is_configured:
        !!credentials &&
        !missingFields(g.config_schema, decrypt(credentials)).length,
    }));
  }
  async saveCatalog(slug: string, b: any, actor: string) {
    gateway(slug, {}, true);
    return this.platform.db.transaction(async (m) => {
      const [g] = await m.query(
        'SELECT * FROM gateway_catalog WHERE slug=$1 FOR UPDATE',
        [slug],
      );
      if (!g) throw new NotFoundException();
      const c = g.credentials ? decrypt(g.credentials) : {};
      for (const [k, v] of Object.entries(b.credentials ?? {}))
        if (
          typeof v === 'string' &&
          v.trim() &&
          g.config_schema.some((f: any) => f.key === k)
        )
          c[k] = v.trim();
      const secret = Object.keys(c).length ? encrypt(c) : null;
      await m.query(
        'UPDATE gateway_catalog SET credentials=$2,enabled_for_tenants=$3,enabled_for_platform=$4,sandbox=$5 WHERE slug=$1',
        [
          slug,
          secret,
          b.enabled_for_tenants ?? g.enabled_for_tenants,
          b.enabled_for_platform ?? g.enabled_for_platform,
          b.sandbox ?? g.sandbox,
        ],
      );
      await this.platform.audit(m, actor, null, 'gateway.update', null, {
        slug,
        enabled_for_tenants: b.enabled_for_tenants,
        enabled_for_platform: b.enabled_for_platform,
        credentials_changed: !!b.credentials,
      });
      return { message: 'Gateway saved' };
    });
  }
  async policy(tenant: string, slug: string, b: any, actor: string) {
    uuid(tenant);
    if (typeof b.allowed !== 'boolean')
      throw new BadRequestException('allowed must be boolean');
    await this.platform.db.transaction(async (m) => {
      await m.query(
        'INSERT INTO tenant_gateway_policy(tenant_id,slug,allowed) VALUES($1,$2,$3) ON CONFLICT(tenant_id,slug) DO UPDATE SET allowed=excluded.allowed',
        [tenant, slug, b.allowed],
      );
      await this.platform.audit(m, actor, tenant, 'gateway.policy', null, {
        slug,
        allowed: b.allowed,
      });
    });
    return { message: 'Gateway policy updated' };
  }
  async tenantGateways(user: any) {
    await this.access.require('online-payments', 'manage', user);
    const [r] = await requireScope().runner.query(
      'SELECT tenant_gateways() AS gateways',
    );
    return r.gateways;
  }
  async saveTenantGateway(b: any, user: any) {
    await this.access.require('online-payments', 'manage', user);
    const scope = requireScope(),
      slug = required(b.gateway_slug, 'gateway_slug', 30);
    const [g] = await this.platform.db.query(
      'SELECT g.*,COALESCE(p.allowed,true) AS allowed FROM gateway_catalog g LEFT JOIN tenant_gateway_policy p ON p.slug=g.slug AND p.tenant_id=$2 WHERE g.slug=$1',
      [slug, scope.tenantId],
    );
    if (!g?.enabled_for_tenants || !g.allowed)
      throw new BadRequestException('Gateway disabled by platform');
    const [old] = await scope.runner.query(
      'SELECT * FROM tenant_gateway WHERE slug=$1 FOR UPDATE',
      [slug],
    );
    const c = old?.credentials ? decrypt(old.credentials) : {};
    for (const [k, v] of Object.entries(b.credentials ?? {}))
      if (
        typeof v === 'string' &&
        v.trim() &&
        g.config_schema.some((f: any) => f.key === k)
      )
        c[k] = v.trim();
    const missing = missingFields(g.config_schema, c);
    if (b.active && missing.length)
      throw new BadRequestException({
        missing_fields: missing,
        message: 'Credentials incomplete',
      });
    await scope.runner.query(
      'INSERT INTO tenant_gateway(tenant_id,slug,credentials,active,sandbox) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,slug) DO UPDATE SET credentials=excluded.credentials,active=excluded.active,sandbox=excluded.sandbox',
      [
        scope.tenantId,
        slug,
        encrypt(c),
        b.active === true,
        b.sandbox !== false,
      ],
    );
    return { message: 'Gateway saved', is_configured: !missing.length };
  }
  async available(platform = false) {
    if (platform)
      return (await this.catalog())
        .filter((g) => g.enabled_for_platform && g.is_configured)
        .map(({ slug, name, description, sandbox }) => ({
          slug,
          name,
          description,
          is_sandbox: sandbox,
        }));
    const state = await this.access.state();
    if (!state.operational || !state.features.includes('online-payments'))
      return [];
    const [r] = await requireScope().runner.query(
      'SELECT tenant_gateways() AS gateways',
    );
    return r.gateways
      .filter((g: any) => g.allowed && g.active && g.is_configured)
      .map(({ slug, name, description, is_sandbox }: any) => ({
        slug,
        name,
        description,
        is_sandbox,
      }));
  }
  async initiateSubscription(tid: string, b: any) {
    return this.initiate(tid, 'subscription', tid, b.gateway_slug, true);
  }
  async initiateInvoice(b: any, user: any) {
    const scope = requireScope();
    if (user.role !== 'customer')
      await this.access.require('online-payments', 'create', user);
    else {
      const s = await this.access.state();
      if (!s.operational || !s.features.includes('online-payments'))
        throw new ForbiddenException('Online payments unavailable');
    }
    const id = uuid(b.source_id);
    const [i] = await scope.runner.query(
      'SELECT * FROM invoice WHERE id=$1 FOR UPDATE',
      [id],
    );
    if (!i) throw new NotFoundException();
    if (user.role === 'customer') {
      const [a] = await scope.runner.query(
        'SELECT "clientId" FROM auth WHERE id=$1',
        [user.id],
      );
      if (!a?.clientId || a.clientId !== i.clientId)
        throw new ForbiddenException(
          'Invoice does not belong to this customer',
        );
    }
    return this.initiate(
      scope.tenantId,
      'invoice',
      id,
      b.gateway_slug,
      false,
      i,
    );
  }
  private async initiate(
    tid: string,
    source: string,
    sourceId: string,
    slug: string,
    platform: boolean,
    invoice?: any,
  ) {
    slug = required(slug, 'gateway_slug', 30);
    const run = platform
      ? this.platform.db.transaction.bind(this.platform.db)
      : async (work: any) => work(requireScope().runner.manager);
    return run(async (m: any) => {
      let amount: string,
        currency: string,
        email: string,
        name: string,
        branch: string | null = null;
      let interval = 'monthly';
      let credentials: any;
      let sandbox: boolean;
      const [g] = await this.platform.db.query(
        'SELECT * FROM gateway_catalog WHERE slug=$1',
        [slug],
      );
      if (!g) throw new BadRequestException('Unknown gateway');
      if (platform) {
        if (!g.enabled_for_platform || !g.credentials)
          throw new BadRequestException('Gateway unavailable');
        credentials = decrypt(g.credentials);
        sandbox = g.sandbox;
        const [s] = await m.query(
          'SELECT s.*,v.monthly,v.yearly,v.currency,t.name FROM tenant_subscription s JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) JOIN tenant t ON t.id=s.tenant_id WHERE tenant_id=$1 FOR UPDATE OF s',
          [tid],
        );
        if (!s) throw new NotFoundException();
        if (s.stripe_subscription && s.status === 'active')
          throw new BadRequestException(
            'An automatic subscription already exists',
          );
        interval = s.interval;
        amount = String(s.interval === 'yearly' ? s.yearly : s.monthly);
        currency = s.currency;
        name = s.name;
        const [a] = await m.query(
          "SELECT email FROM platform_invitation WHERE tenant_id=$1 AND realm='activation' LIMIT 1",
          [tid],
        );
        email = a?.email ?? 'billing@styledesk.test';
      } else {
        const [i] = await m.query(
          'SELECT * FROM tenant_gateway WHERE slug=$1',
          [slug],
        );
        const [p] = await this.platform.db.query(
          'SELECT allowed FROM tenant_gateway_policy WHERE tenant_id=$1 AND slug=$2',
          [tid, slug],
        );
        if (
          !g.enabled_for_tenants ||
          p?.allowed === false ||
          !i?.active ||
          !i.credentials
        )
          throw new BadRequestException('Gateway unavailable');
        credentials = decrypt(i.credentials);
        sandbox = i.sandbox;
        amount = (
          Number(invoice.total) - Number(invoice.paidAmount ?? 0)
        ).toFixed(2);
        branch = invoice.branch_id;
        const [c] = await m.query(
          'SELECT "defaultCurrency" FROM invoice_setting LIMIT 1',
        );
        currency = c?.defaultCurrency ?? 'BDT';
        const [client] = await m.query(
          'SELECT name,email,phone FROM client WHERE id=$1',
          [invoice.clientId],
        );
        email = client?.email ?? 'customer@styledesk.test';
        name = client?.name ?? 'Salon invoice';
      }
      const missing = missingFields(g.config_schema, credentials);
      if (missing.length)
        throw new BadRequestException({
          message: 'Credentials incomplete',
          missing_fields: missing,
        });
      minorUnits(amount, currency);
      const tran = 'TXN-' + randomUUID();
      const [t] = await m.query(
        'SELECT slug FROM ' +
          (platform ? 'tenant' : 'platform_tenant_identity()') +
          ' WHERE id=$1',
        [tid],
      );
      const origin = platform ? platformOrigin() : tenantOrigin(t.slug);
      const base =
        origin +
        '/api/backend/' +
        (platform ? 'platform/payments' : 'payments');
      let attempt: any;
      try {
        [attempt] = await m.query(
          'INSERT INTO payment_attempt(tran_id,tenant_id,branch_id,source,source_id,gateway_slug,amount,currency,credential_snapshot,sandbox) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
          [
            tran,
            tid,
            branch,
            source,
            sourceId,
            slug,
            amount,
            currency,
            encrypt(credentials),
            sandbox,
          ],
        );
      } catch (e: any) {
        if (e.code === '23505')
          throw new BadRequestException(
            'A checkout is already pending for this payment',
          );
        throw e;
      }
      try {
        const result = await gateway(slug, credentials, sandbox).initiate(
          {
            tran_id: tran,
            amount,
            currency,
            email,
            name,
            phone: process.env.SSLCOMMERZ_FALLBACK_PHONE ?? '01700000000',
            subscription: platform && slug === 'stripe',
            interval,
          },
          {
            success_url: base + '/success',
            fail_url: base + '/fail',
            cancel_url: base + '/cancel',
            ipn_url: base + (slug === 'stripe' ? '/webhooks/stripe' : '/ipn'),
          },
        );
        await m.query(
          "UPDATE payment_attempt SET status='pending',provider_id=$2,response=$3 WHERE id=$1",
          [
            attempt.id,
            result.raw.id ?? result.raw.sessionkey,
            JSON.stringify(result.raw),
          ],
        );
        return { gateway_url: result.gateway_url, tran_id: tran };
      } catch {
        await m.query(
          'UPDATE payment_attempt SET status=\'failed\',response=\'{"error":"Provider initialization failed"}\' WHERE id=$1',
          [attempt.id],
        );
        return { error: 'Provider initialization failed', statusCode: 502 };
      }
    });
  }
  async settle(tran: string, valId?: string, platform = false) {
    const scope = platform ? null : requireScope();
    const run = platform
      ? this.platform.db.transaction.bind(this.platform.db)
      : async (work: any) => work(scope!.runner.manager);
    return run(async (m: any) => {
      const [initial] = await m.query(
        'SELECT * FROM payment_attempt WHERE tran_id=$1',
        [required(tran, 'transaction', 80)],
      );
      if (
        !initial ||
        initial.source !== (platform ? 'subscription' : 'invoice')
      )
        throw new NotFoundException();
      await m.query(
        platform
          ? 'SELECT tenant_id FROM tenant_subscription WHERE tenant_id=$1 FOR UPDATE'
          : 'SELECT id FROM invoice WHERE id=$1 FOR UPDATE',
        [platform ? initial.tenant_id : initial.source_id],
      );
      const [a] = await m.query(
        'SELECT * FROM payment_attempt WHERE tran_id=$1 FOR UPDATE',
        [required(tran, 'transaction', 80)],
      );
      if (!a || a.source !== (platform ? 'subscription' : 'invoice'))
        throw new NotFoundException();
      if (['success', 'failed', 'cancelled'].includes(a.status))
        return { status: a.status };
      const id = valId || a.provider_id;
      if (!id) return { status: 'pending' };
      const v = await gateway(
        a.gateway_slug,
        decrypt(a.credential_snapshot),
        a.sandbox,
      ).validate(id, a.gateway_slug === 'sslcommerz' && !valId);
      if (v.status === 'PENDING') return { status: 'pending' };
      if (valId && (v.status !== 'VALID' || v.tran_id !== a.tran_id))
        throw new BadRequestException(
          'Provider validation did not match this transaction',
        );
      if (
        v.status !== 'VALID' ||
        v.tran_id !== a.tran_id ||
        v.currency !== a.currency ||
        minorUnits(v.amount, v.currency) !== minorUnits(a.amount, a.currency)
      ) {
        await m.query(
          "UPDATE payment_attempt SET status='failed',response=$2 WHERE id=$1",
          [a.id, JSON.stringify(v.raw)],
        );
        return { status: 'failed' };
      }
      if (platform) {
        await m.query(
          "UPDATE tenant_subscription SET payment_verified=true,status=CASE WHEN email_verified THEN 'active' ELSE status END,starts_at=COALESCE(starts_at,now()),ends_at=(CASE WHEN status='active' THEN GREATEST(now(),ends_at) ELSE now() END)+CASE WHEN interval='yearly' THEN interval '1 year' ELSE interval '1 month' END,grace_until=NULL,stripe_subscription=COALESCE($2,stripe_subscription),stripe_customer=COALESCE($3,stripe_customer),revision=revision+1 WHERE tenant_id=$1",
          [a.tenant_id, v.raw.subscription ?? null, v.raw.customer ?? null],
        );
      } else {
        if (a.tenant_id !== scope!.tenantId) throw new ForbiddenException();
        const [invoice] = await m.query(
          'SELECT * FROM invoice WHERE id=$1 FOR UPDATE',
          [a.source_id],
        );
        if (
          !invoice ||
          Number(invoice.total) - Number(invoice.paidAmount ?? 0) + 0.001 <
            Number(a.amount)
        )
          throw new BadRequestException(
            'Invoice balance changed; payment requires review',
          );
        (scope as any).paymentSettlement = true;
        try {
          await this.invoice.update(a.source_id, {
            paidAmount: Number(invoice.paidAmount ?? 0) + Number(a.amount),
            applyCommission: true,
          } as any);
        } finally {
          (scope as any).paymentSettlement = false;
        }
      }
      await m.query(
        'INSERT INTO payment_settlement(attempt_id,tenant_id,source_id,amount) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [a.id, a.tenant_id, a.source_id, a.amount],
      );
      await m.query(
        "UPDATE payment_attempt SET status='success',validated_at=now(),response=$2 WHERE id=$1",
        [a.id, JSON.stringify(v.raw)],
      );
      return { status: 'success' };
    });
  }
  async callback(b: any, platform = false) {
    const tran = b.tran_id ?? b.client_reference_id;
    if (!tran) throw new BadRequestException('Missing transaction');
    return this.settle(tran, b.val_id ?? b.session_id, platform);
  }
  async webhook(raw: Buffer, signature: string, platform = false) {
    let event: any;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      throw new BadRequestException('Invalid webhook');
    }
    const obj = event.data?.object;
    let tran = obj?.client_reference_id ?? obj?.metadata?.tran_id;
    let attempt: any;
    if (tran)
      [attempt] = await this.platform.db.query(
        'SELECT * FROM payment_attempt WHERE tran_id=$1',
        [tran],
      );
    else if (platform) {
      const sub =
        obj?.subscription ?? (obj?.object === 'subscription' ? obj.id : null);
      const [s] = await this.platform.db.query(
        'SELECT tenant_id FROM tenant_subscription WHERE stripe_subscription=$1',
        [sub],
      );
      if (s)
        [attempt] = await this.platform.db.query(
          "SELECT * FROM payment_attempt WHERE tenant_id=$1 AND source='subscription' AND gateway_slug='stripe' ORDER BY created_at DESC LIMIT 1",
          [s.tenant_id],
        );
    }
    if (!attempt && /refund|dispute/.test(event.type)) {
      const snapshots = await this.platform.db.query(
        "SELECT DISTINCT credential_snapshot,sandbox FROM payment_attempt WHERE gateway_slug='stripe' AND source=$1" +
          (platform ? '' : ' AND tenant_id=$2'),
        platform ? ['subscription'] : ['invoice', requireScope().tenantId],
      );
      for (const snapshot of snapshots) {
        const credentials = decrypt(snapshot.credential_snapshot);
        if (!verifyStripe(raw, signature, credentials.webhook_secret)) continue;
        const adapter = new StripeAdapter(credentials, snapshot.sandbox);
        let charge = obj;
        if (obj.object === 'refund' || obj.object === 'dispute') {
          if (obj.charge)
            charge = await adapter.request(
              'charges/' +
                encodeURIComponent(
                  typeof obj.charge === 'string' ? obj.charge : obj.charge.id,
                ),
            );
        }
        const intentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (intentId) {
          const intent = await adapter.request(
            'payment_intents/' + encodeURIComponent(intentId),
          );
          tran = intent.metadata?.tran_id;
          if (tran)
            [attempt] = await this.platform.db.query(
              'SELECT * FROM payment_attempt WHERE tran_id=$1',
              [tran],
            );
        }
        if (!attempt && platform && charge.invoice) {
          const invoice = await adapter.request(
            'invoices/' +
              encodeURIComponent(
                typeof charge.invoice === 'string'
                  ? charge.invoice
                  : charge.invoice.id,
              ),
          );
          const subId =
            typeof invoice.subscription === 'string'
              ? invoice.subscription
              : invoice.subscription?.id;
          [attempt] = await this.platform.db.query(
            "SELECT a.* FROM payment_attempt a JOIN tenant_subscription s ON s.tenant_id=a.tenant_id WHERE s.stripe_subscription=$1 AND a.source='subscription' AND a.gateway_slug='stripe' AND a.status='success' ORDER BY a.created_at DESC LIMIT 1",
            [subId],
          );
        }
        if (attempt) break;
      }
    }
    if (
      !attempt ||
      attempt.source !== (platform ? 'subscription' : 'invoice') ||
      (!platform && attempt.tenant_id !== requireScope().tenantId)
    )
      throw new BadRequestException('Unknown webhook source');
    const c = decrypt(attempt.credential_snapshot);
    if (!verifyStripe(raw, signature, c.webhook_secret))
      throw new BadRequestException('Invalid Stripe signature');
    const [previous] = await this.platform.db.query(
      "SELECT processed_at FROM payment_event WHERE gateway_slug='stripe' AND event_id=$1",
      [required(event.id, 'event ID')],
    );
    if (previous?.processed_at) return { received: true };
    await this.platform.db.query(
      "INSERT INTO payment_event(gateway_slug,event_id,payload) VALUES('stripe',$1,$2) ON CONFLICT DO NOTHING",
      [required(event.id, 'event ID'), JSON.stringify(event)],
    );
    if (event.type.startsWith('checkout.session.'))
      await this.settle(attempt.tran_id, obj.id, platform);
    if (
      platform &&
      [
        'invoice.paid',
        'invoice.payment_failed',
        'customer.subscription.updated',
        'customer.subscription.deleted',
      ].includes(event.type)
    )
      await this.recurring(event, attempt, c);
    if (/refund|dispute/.test(event.type))
      await this.platform.db.transaction(async (m) => {
        await this.platform.audit(
          m,
          null,
          attempt.tenant_id,
          'payment.review',
          null,
          {
            event_id: event.id,
            type: event.type,
            transaction: attempt.tran_id,
          },
        );
      });
    await this.platform.db.query(
      "UPDATE payment_event SET processed_at=now() WHERE gateway_slug='stripe' AND event_id=$1",
      [event.id],
    );
    return { received: true };
  }
  private async recurring(event: any, attempt: any, c: any) {
    const adapter = new StripeAdapter(c, attempt.sandbox);
    const obj = event.data.object;
    const subId = obj.object === 'subscription' ? obj.id : obj.subscription;
    if (!subId) return;
    const live = await adapter.request(
      'subscriptions/' + encodeURIComponent(subId),
    );
    await this.platform.db.transaction(async (m) => {
      const [s] = await m.query(
        'SELECT * FROM tenant_subscription WHERE tenant_id=$1 FOR UPDATE',
        [attempt.tenant_id],
      );
      if (s.stripe_subscription && s.stripe_subscription !== live.id)
        throw new BadRequestException('Subscription mismatch');
      const ending =
        live.current_period_end ?? live.items?.data?.[0]?.current_period_end;
      const status = ['active', 'trialing'].includes(live.status)
        ? 'active'
        : live.status === 'past_due'
          ? 'past_due'
          : ['canceled', 'unpaid'].includes(live.status)
            ? 'expired'
            : 'pending';
      const [settings] = await m.query('SELECT value FROM platform_settings');
      await m.query(
        "UPDATE tenant_subscription SET stripe_subscription=$2,status=$3,ends_at=to_timestamp($4),grace_until=CASE WHEN $3='past_due' THEN COALESCE(grace_until,now()+make_interval(days=>$5)) ELSE NULL END,revision=revision+1 WHERE tenant_id=$1",
        [
          attempt.tenant_id,
          live.id,
          status,
          ending ?? Math.floor(Date.now() / 1000),
          settings.value.graceDays ?? 7,
        ],
      );
      if (live.metadata?.package_id) {
        const [v] = await m.query(
          'SELECT * FROM platform_package_version WHERE package_id=$1 AND version=$2',
          [
            uuid(live.metadata.package_id),
            Number(live.metadata.package_version),
          ],
        );
        if (v)
          await m.query(
            'UPDATE tenant_subscription SET package_id=$2,package_version=$3,interval=$4 WHERE tenant_id=$1',
            [
              attempt.tenant_id,
              v.package_id,
              v.version,
              live.metadata.interval === 'yearly' ? 'yearly' : 'monthly',
            ],
          );
      }
      if (
        event.type === 'invoice.paid' &&
        obj.amount_paid > 0 &&
        obj.billing_reason !== 'subscription_create'
      ) {
        const invoice = await adapter.request(
          'invoices/' + encodeURIComponent(obj.id),
        );
        if (invoice.status !== 'paid' || invoice.subscription !== live.id)
          return;
        const terms = invoice.subscription_details?.metadata ?? live.metadata ?? {};
        const [version] = await m.query(
          'SELECT * FROM platform_package_version WHERE package_id=$1 AND version=$2',
          [terms.package_id ? uuid(terms.package_id) : s.package_id,
           terms.package_version ? Number(terms.package_version) : s.package_version],
        );
        const interval = terms.interval ?? s.interval;
        if (!version || invoice.currency.toUpperCase() !== version.currency ||
            invoice.amount_paid !== minorUnits(interval === 'yearly' ? version.yearly : version.monthly, version.currency))
          throw new BadRequestException('Renewal amount or currency mismatch');
        const tx = 'STRIPE-INVOICE-' + invoice.id;
        await m.query(
          "INSERT INTO payment_attempt(tran_id,tenant_id,source,source_id,gateway_slug,amount,currency,status,credential_snapshot,sandbox,provider_id,validated_at) VALUES($1,$2,'subscription',$2,'stripe',$3,$4,'success',$5,$6,$7,now()) ON CONFLICT(tran_id) DO NOTHING",
          [
            tx,
            attempt.tenant_id,
            (await import('./gateway-adapters.js')).majorUnits(
              invoice.amount_paid,
              invoice.currency,
            ),
            invoice.currency.toUpperCase(),
            attempt.credential_snapshot,
            attempt.sandbox,
            invoice.id,
          ],
        );
      }
    });
  }
  async status(tran: string, platform = false) {
    const [a] = await this.platform.db.query(
      'SELECT tran_id,status,tenant_id,source FROM payment_attempt WHERE tran_id=$1',
      [required(tran, 'transaction', 80)],
    );
    if (
      !a ||
      a.source !== (platform ? 'subscription' : 'invoice') ||
      (!platform && a.tenant_id !== requireScope().tenantId)
    )
      throw new NotFoundException();
    return { tran_id: a.tran_id, status: a.status };
  }
  async invoiceList(user: any) {
    const scope = requireScope();
    if (user.role !== 'customer')
      await this.access.require('invoice', 'view', user);
    return scope.runner.query(
      'SELECT i.id,i."invoiceNumber",i.total,i."paidAmount",i.status FROM invoice i ' +
        (user.role === 'customer'
          ? 'JOIN auth a ON a."clientId"=i."clientId" WHERE a.id=$1'
          : '') +
        ' ORDER BY i."createdAt" DESC' + (cursorRequest() ? '' : ' LIMIT 100'),
      user.role === 'customer' ? [user.id] : [],
    );
  }
  async reconcile() {
    const rows = await this.platform.db.query(
      "SELECT * FROM payment_attempt WHERE status='pending' AND next_check<=now() ORDER BY created_at LIMIT 20",
    );
    for (const a of rows) {
      try {
        if (a.source === 'subscription')
          await this.settle(a.tran_id, undefined, true);
        else {
          const runner = this.ds.createQueryRunner();
          await runner.connect();
          await runner.startTransaction();
          try {
            await runner.query(
              "SELECT set_config('app.tenant_id',$1,true),set_config('app.branch_id',$2,true)",
              [a.tenant_id, a.branch_id],
            );
            const scope = {
              tenantId: a.tenant_id,
              branchId: a.branch_id,
              runner,
              afterCommit: [] as Array<() => Promise<void>>,
            };
            await tenantStorage.run(scope, () => this.settle(a.tran_id));
            await runner.commitTransaction();
            for (const f of scope.afterCommit) await f();
          } catch (e) {
            await runner.rollbackTransaction();
            throw e;
          } finally {
            await runner.release();
          }
        }
      } catch {}
      await this.platform.db.query(
        "UPDATE payment_attempt SET next_check=now()+interval '5 minutes',retry_count=retry_count+1 WHERE id=$1",
        [a.id],
      );
    }
  }
}
