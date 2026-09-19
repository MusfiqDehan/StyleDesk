// Provider responses are mocked; PostgreSQL transactions, RLS and InvoiceService are real.
const assert = require('node:assert/strict');
const { randomUUID, createHmac } = require('node:crypto');
const { Client } = require('pg');
const connection = process.env.TEST_OPERATOR_DATABASE_URL;
if (!connection || !new URL(connection).pathname.endsWith('_test'))
  throw new Error('Use explicit disposable _test database');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PLATFORM_DATABASE_URL = process.env.TEST_PLATFORM_DATABASE_URL;
process.env.JWT_SECRET = 'styledesk-tenant-test-secret-2026';
process.env.PLATFORM_JWT_SECRET = 'styledesk-platform-test-secret-2026';
process.env.PAYMENT_ENCRYPTION_KEY = '12'.repeat(32);
process.env.NODE_ENV = 'test';
process.env.MAIL_HOST = '';
process.env.DOMAIN_WORKER = 'false';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6380';
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module.js');
const { PaymentsService } = require('../dist/src/platform/payments.service.js');
const { PlatformService } = require('../dist/src/platform/platform.service.js');
const { PlatformWorkers } = require('../dist/src/platform/platform-workers.js');
const { InvoiceService } = require('../dist/src/invoice/invoice.service.js');
const { encrypt } = require('../dist/src/platform/crypto.js');
const { tenantStorage } = require('../dist/src/tenancy/tenant-context.js');
const { DataSource } = require('typeorm');
const db = new Client({ connectionString: connection });
let app;
const originalFetch = global.fetch;
let validation;
global.fetch = async (url) => {
  if (String(url).startsWith('https://api.stripe.com/v1/checkout/sessions/'))
    return { ok: true, json: async () => validation };
  throw new Error('Provider outage');
};
(async () => {
  await db.connect();
  app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const service = app.get(PaymentsService),
    platform = app.get(PlatformService),
    invoiceService = app.get(InvoiceService),
    ds = app.get(DataSource);
  const credentials = encrypt({
    secret_key: 'sk_test',
    publishable_key: 'pk_test',
    webhook_secret: 'whsec_test',
  });
  const {
    rows: [pkg],
  } = await db.query("SELECT id FROM platform_package WHERE slug='growth'");
  async function newTenant(label) {
    const email = label + '@styledesk.test';
    const {
      rows: [t],
    } = await db.query('SELECT platform_provision($1,$2,$3,$4,$5,$6) AS id', [
      label,
      label,
      email,
      'test-hash',
      pkg.id,
      'monthly',
    ]);
    const token = 'verification-' + randomUUID();
    const { hashToken } = require('../dist/src/platform/crypto.js');
    await db.query(
      "INSERT INTO platform_invitation(realm,tenant_id,email,token_hash,expires_at) VALUES('activation',$1,$2,$3,now()+interval '1 hour')",
      [t.id, email, hashToken(token)],
    );
    return { ...t, token };
  }
  async function attempt(
    t,
    source = 'subscription',
    sourceId = t.id,
    branch = null,
    amount = '2990',
  ) {
    const tran = 'TXN-' + randomUUID();
    const {
      rows: [a],
    } = await db.query(
      "INSERT INTO payment_attempt(tran_id,tenant_id,branch_id,source,source_id,gateway_slug,amount,currency,status,credential_snapshot,sandbox,provider_id) VALUES($1,$2,$3,$4,$5,'stripe',$6,'BDT','pending',$7,true,$8) RETURNING *",
      [
        tran,
        t.id,
        branch,
        source,
        sourceId,
        amount,
        credentials,
        'cs_' + randomUUID(),
      ],
    );
    validation = {
      id: a.provider_id,
      payment_status: 'paid',
      status: 'complete',
      amount_total: Number(amount) * 100,
      currency: 'bdt',
      client_reference_id: tran,
      subscription: source === 'subscription' ? 'sub_' + t.id : null,
      customer: 'cus_test',
    };
    return a;
  }
  const beforeEmail = await newTenant('pay-first-' + randomUUID().slice(0, 8));
  const paidFirst = await attempt(beforeEmail);
  assert.equal(
    (await service.settle(paidFirst.tran_id, undefined, true)).status,
    'success',
  );
  let s = (
    await db.query('SELECT * FROM tenant_subscription WHERE tenant_id=$1', [
      beforeEmail.id,
    ])
  ).rows[0];
  assert.equal(s.payment_verified, true);
  assert.equal(s.status, 'pending');
  await platform.activate(beforeEmail.token);
  s = (
    await db.query('SELECT * FROM tenant_subscription WHERE tenant_id=$1', [
      beforeEmail.id,
    ])
  ).rows[0];
  assert.equal(s.status, 'active');
  const beforePayment = await newTenant(
    'email-first-' + randomUUID().slice(0, 8),
  );
  await platform.activate(beforePayment.token);
  s = (
    await db.query('SELECT * FROM tenant_subscription WHERE tenant_id=$1', [
      beforePayment.id,
    ])
  ).rows[0];
  assert.equal(s.status, 'pending');
  const payment = await attempt(beforePayment);
  const results = await Promise.all([
    service.settle(payment.tran_id, undefined, true),
    service.settle(payment.tran_id, undefined, true),
  ]);
  assert(results.every((r) => r.status === 'success'));
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM payment_settlement WHERE attempt_id=$1',
        [payment.id],
      )
    ).rows[0].n,
    1,
  );
  // A successful payment must not undo administrative suspension.
  await db.query('UPDATE tenant SET active=false WHERE id=$1', [
    beforePayment.id,
  ]);
  assert.equal(
    (
      await db.query('SELECT active FROM tenant WHERE id=$1', [
        beforePayment.id,
      ])
    ).rows[0].active,
    false,
  );
  await service.settle(payment.tran_id, undefined, true);
  assert.equal(
    (
      await db.query('SELECT active FROM tenant WHERE id=$1', [
        beforePayment.id,
      ])
    ).rows[0].active,
    false,
  );
  // Signature verification and duplicate event settlement.
  const event = Buffer.from(
    JSON.stringify({
      id: 'evt_' + randomUUID(),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: paidFirst.provider_id,
          client_reference_id: paidFirst.tran_id,
        },
      },
    }),
  );
  const stamp = Math.floor(Date.now() / 1000),
    signature =
      't=' +
      stamp +
      ',v1=' +
      createHmac('sha256', 'whsec_test')
        .update(stamp + '.')
        .update(event)
        .digest('hex');
  await assert.rejects(service.webhook(event, 't=' + stamp + ',v1=00', true));
  await service.webhook(event, signature, true);
  await service.webhook(event, signature, true);
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM payment_settlement WHERE attempt_id=$1',
        [paidFirst.id],
      )
    ).rows[0].n,
    1,
  );
  // Renewal events use live provider state, immutable terms and deduplicated invoice IDs.
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
  let live = {
    id: 'sub_' + beforeEmail.id,
    status: 'active',
    current_period_end: periodEnd,
  };
  let renewal = {
    id: 'in_' + randomUUID(),
    status: 'paid',
    subscription: live.id,
    amount_paid: 299000,
    currency: 'bdt',
  };
  global.fetch = async (url) => ({
    ok: true,
    json: async () => (String(url).includes('/invoices/') ? renewal : live),
  });
  async function sendRecurring(type, object) {
    const bytes = Buffer.from(
      JSON.stringify({ id: 'evt_' + randomUUID(), type, data: { object } }),
    );
    const now = Math.floor(Date.now() / 1000);
    const sig =
      't=' +
      now +
      ',v1=' +
      createHmac('sha256', 'whsec_test')
        .update(now + '.')
        .update(bytes)
        .digest('hex');
    return service.webhook(bytes, sig, true);
  }
  const renewalEvent = { ...renewal, billing_reason: 'subscription_cycle' };
  await sendRecurring('invoice.paid', renewalEvent);
  await sendRecurring('invoice.paid', renewalEvent);
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM payment_attempt WHERE tran_id=$1',
        ['STRIPE-INVOICE-' + renewal.id],
      )
    ).rows[0].n,
    1,
  );
  live.status = 'past_due';
  await sendRecurring('invoice.payment_failed', renewalEvent);
  let renewalState = (
    await db.query(
      'SELECT status,grace_until FROM tenant_subscription WHERE tenant_id=$1',
      [beforeEmail.id],
    )
  ).rows[0];
  assert.equal(renewalState.status, 'past_due');
  assert(renewalState.grace_until > new Date());
  // A delayed failure event cannot overwrite a now-active subscription.
  live.status = 'active';
  await sendRecurring('invoice.payment_failed', renewalEvent);
  assert.equal(
    (
      await db.query(
        'SELECT status FROM tenant_subscription WHERE tenant_id=$1',
        [beforeEmail.id],
      )
    ).rows[0].status,
    'active',
  );
  renewal = { ...renewal, id: 'in_' + randomUUID(), amount_paid: 299001 };
  await assert.rejects(
    sendRecurring('invoice.paid', {
      ...renewal,
      billing_reason: 'subscription_cycle',
    }),
    /amount or currency mismatch/,
  );
  live.status = 'canceled';
  await sendRecurring('customer.subscription.deleted', {
    object: 'subscription',
    id: live.id,
  });
  assert.equal(
    (
      await db.query(
        'SELECT status FROM tenant_subscription WHERE tenant_id=$1',
        [beforeEmail.id],
      )
    ).rows[0].status,
    'expired',
  );
  global.fetch = async () => ({ ok: true, json: async () => validation });
  const mismatchTenant = await newTenant(
    'mismatch-' + randomUUID().slice(0, 8),
  );
  const mismatch = await attempt(mismatchTenant);
  validation.amount_total += 1;
  assert.equal(
    (await service.settle(mismatch.tran_id, undefined, true)).status,
    'failed',
  );
  assert.equal(
    (
      await db.query(
        'SELECT payment_verified FROM tenant_subscription WHERE tenant_id=$1',
        [mismatchTenant.id],
      )
    ).rows[0].payment_verified,
    false,
  );
  const outageTenant = await newTenant('outage-' + randomUUID().slice(0, 8));
  const outage = await attempt(outageTenant);
  global.fetch = async () => {
    throw new Error('Outage');
  };
  await assert.rejects(service.settle(outage.tran_id, undefined, true));
  assert.equal(
    (
      await db.query('SELECT status FROM payment_attempt WHERE id=$1', [
        outage.id,
      ])
    ).rows[0].status,
    'pending',
  );
  global.fetch = async () => ({ ok: true, json: async () => validation });
  // One-time invoice payment uses real business settlement code and serializes with offline edits.
  const {
    rows: [tenant],
  } = await db.query("SELECT id FROM tenant WHERE slug='client2'");
  const {
    rows: [branch],
  } = await db.query('SELECT id FROM branch WHERE tenant_id=$1 LIMIT 1', [
    tenant.id,
  ]);
  const {
    rows: [invoice],
  } = await db.query(
    'INSERT INTO invoice(tenant_id,branch_id,"invoiceNumber",staff,total,"paidAmount",status) VALUES($1,$2,$3,\'N/A\',1000,250,\'Partial\') RETURNING id',
    [tenant.id, branch.id, 'INV-TEST-' + randomUUID()],
  );
  const online = await attempt(tenant, 'invoice', invoice.id, branch.id, '750');
  async function scoped(work) {
    const runner = ds.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(
        "SELECT set_config('app.tenant_id',$1,true),set_config('app.branch_id',$2,true)",
        [tenant.id, branch.id],
      );
      const scope = {
        tenantId: tenant.id,
        branchId: branch.id,
        runner,
        afterCommit: [],
      };
      const r = await tenantStorage.run(scope, work);
      await runner.commitTransaction();
      for (const effect of scope.afterCommit) await effect();
      return r;
    } catch (e) {
      await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
    }
  }
  await assert.rejects(
    scoped(() => invoiceService.update(invoice.id, { paidAmount: 1000 })),
    /checkout is pending/,
  );
  await Promise.all([
    scoped(() => service.settle(online.tran_id)),
    scoped(() => service.settle(online.tran_id)),
  ]);
  const settled = (
    await db.query('SELECT "paidAmount",status FROM invoice WHERE id=$1', [
      invoice.id,
    ])
  ).rows[0];
  assert.equal(Number(settled.paidAmount), 1000);
  assert.equal(settled.status, 'Paid');
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM payment_settlement WHERE attempt_id=$1',
        [online.id],
      )
    ).rows[0].n,
    1,
  );
  // Separate customer caps are serialized by the database, including reactivation.
  const seatTenant = await newTenant('seats-' + randomUUID().slice(0, 8));
  await db.query(
    'UPDATE tenant_subscription SET customer_limit_override=1 WHERE tenant_id=$1',
    [seatTenant.id],
  );
  async function customerSeat() {
    const client = new Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id',$1,true)", [
        seatTenant.id,
      ]);
      const row = (
        await client.query(
          "INSERT INTO auth(useremail,password,role) VALUES($1,'test-hash','customer') RETURNING id",
          ['seat-' + randomUUID() + '@example.test'],
        )
      ).rows[0];
      await client.query('COMMIT');
      return row.id;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      await client.end();
    }
  }
  const seats = await Promise.allSettled([customerSeat(), customerSeat()]);
  assert.equal(seats.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(
    seats.find((r) => r.status === 'rejected').reason.message,
    /Account limit reached/,
  );
  const customerId = seats.find((r) => r.status === 'fulfilled').value;
  await db.query('UPDATE auth SET active=false WHERE id=$1', [customerId]);
  await customerSeat();
  await assert.rejects(
    db.query('UPDATE auth SET active=true WHERE id=$1', [customerId]),
    /Account limit reached/,
  );
  await db.query(
    'UPDATE tenant_subscription SET staff_limit_override=2 WHERE tenant_id=$1',
    [seatTenant.id],
  );
  const expiredId = randomUUID();
  await db.query(
    "INSERT INTO platform_invitation(id,realm,tenant_id,email,token_hash,expires_at) VALUES($1,'tenant',$2,'expired@example.test',$3,now()-interval '1 day')",
    [expiredId, seatTenant.id, randomUUID()],
  );
  assert.equal(
    (await db.query('SELECT platform_usage($1) AS usage', [seatTenant.id]))
      .rows[0].usage.reserved,
    0,
  );
  await assert.rejects(
    db.query('SELECT platform_accept_staff($1,$2)', [expiredId, 'test-hash']),
    /Invalid invitation/,
  );
  // The worker applies trial/complimentary expiry, renewal grace and end-of-period cancellation.
  const cases = [
    ['trial', 'expired', 1, false],
    ['active', 'past_due', 1, false],
    ['active', 'expired', 8, false],
    ['active', 'cancelled', 1, true],
    ['complimentary', 'expired', 1, false],
  ];
  const states = [];
  for (const [status, expected, days, cancel] of cases) {
    const t = await newTenant('period-' + randomUUID().slice(0, 8));
    await db.query(
      "UPDATE tenant_subscription SET status=$2,email_verified=true,ends_at=now()-make_interval(days=>$3),complimentary_until=now()-interval '1 day',cancel_at_period_end=$4 WHERE tenant_id=$1",
      [t.id, status, days, cancel],
    );
    states.push({ id: t.id, expected });
  }
  const { PlatformDb } = require('../dist/src/platform/platform-db.js');
  await app
    .get(PlatformDb)
    .transaction((m) => app.get(PlatformWorkers).billing(m));
  for (const state of states)
    assert.equal(
      (
        await db.query(
          'SELECT status FROM tenant_subscription WHERE tenant_id=$1',
          [state.id],
        )
      ).rows[0].status,
      state.expected,
    );
  // Domain worker is safe with an empty inventory and produces only its own watched file.
  const os = require('node:os'),
    fs = require('node:fs/promises');
  const directory = await fs.mkdtemp(os.tmpdir() + '/styledesk-domains-test-');
  process.env.DOMAIN_WORKER = 'true';
  process.env.STYLEDESK_TRAEFIK_DIR = directory;
  await app.get(PlatformWorkers).domains();
  const routes = JSON.parse(
    await fs.readFile(directory + '/styledesk-domains.json', 'utf8'),
  );
  assert(routes.http.routers);
  // DNS and TLS are mocked; route files, database status and entitlement revocation are real.
  const dns = require('node:dns').promises,
    https = require('node:https'),
    { EventEmitter } = require('node:events');
  const originalTxt = dns.resolveTxt,
    originalLookup = dns.lookup,
    originalCname = dns.resolveCname,
    originalGet = https.get;
  const domain = 'worker-' + randomUUID().slice(0, 8) + '.example.org',
    proof = randomUUID();
  const domainId = (
    await db.query(
      "INSERT INTO tenant_domain(tenant_id,hostname,verification_token,status) VALUES($1,$2,$3,'pending') RETURNING id",
      [tenant.id, domain, proof],
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(
      'INSERT INTO tenant_domain(tenant_id,hostname,verification_token) VALUES($1,$2,$3)',
      [beforeEmail.id, domain, randomUUID()],
    ),
    /unique/,
  );
  let tlsReady = false;
  dns.resolveTxt = async (name) =>
    name === '_styledesk.' + domain ? [[proof]] : [];
  dns.lookup = async () => [{ address: '8.8.8.8', family: 4 }];
  dns.resolveCname = async () => [
    process.env.DOMAIN_CNAME_TARGET || process.env.PLATFORM_HOST || 'localhost',
  ];
  https.get = (url, options, callback) => {
    const req = new EventEmitter();
    req.destroy = (error) => req.emit('error', error);
    process.nextTick(() => {
      if (!tlsReady) return req.emit('error', new Error('TLS pending'));
      assert(String(url).includes('/api/backend/domain-proof?token='));
      const res = new EventEmitter();
      res.statusCode = 200;
      callback(res);
      res.emit('data', JSON.stringify({ tenantId: tenant.id }));
      res.emit('end');
    });
    return req;
  };
  process.env.DOMAIN_WORKER = 'true';
  try {
    await app.get(PlatformWorkers).domains();
    let domainState = (
      await db.query(
        'SELECT status,last_error FROM tenant_domain WHERE id=$1',
        [domainId],
      )
    ).rows[0];
    assert.equal(domainState.status, 'provisioning');
    assert.match(domainState.last_error, /TLS/);
    tlsReady = true;
    await db.query('UPDATE tenant_domain SET next_check=now() WHERE id=$1', [
      domainId,
    ]);
    await app.get(PlatformWorkers).domains();
    assert.equal(
      (
        await db.query('SELECT status FROM tenant_domain WHERE id=$1', [
          domainId,
        ])
      ).rows[0].status,
      'active',
    );
    await db.query(
      "UPDATE tenant_subscription SET overrides=jsonb_set(overrides,'{domains}','false') WHERE tenant_id=$1",
      [tenant.id],
    );
    await app.get(PlatformWorkers).domains();
    const removed = JSON.parse(
      await fs.readFile(directory + '/styledesk-domains.json', 'utf8'),
    );
    assert(!removed.http.routers['styledesk-' + domainId]);
    assert.equal(
      (
        await db.query('SELECT status FROM tenant_domain WHERE id=$1', [
          domainId,
        ])
      ).rows[0].status,
      'disabled',
    );
  } finally {
    dns.resolveTxt = originalTxt;
    dns.lookup = originalLookup;
    dns.resolveCname = originalCname;
    https.get = originalGet;
    process.env.DOMAIN_WORKER = 'false';
    await db.query(
      "UPDATE tenant_subscription SET overrides=overrides-'domains' WHERE tenant_id=$1",
      [tenant.id],
    );
  }
  process.env.DOMAIN_WORKER = 'false';
  console.log(
    'Payment/database integration passed: both activation orders, idempotent concurrent settlement, invalid signatures, duplicate events, recurring renewal/grace/cancellation and out-of-order state, exact amount mismatch, provider outage retry, suspension precedence, real invoice settlement, offline checkout exclusion, concurrent customer caps/reactivation, expired reservations, trial/grace/cancellation, domain ownership conflicts, TLS retry/routing proof, revocation and atomic reconciliation.',
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    global.fetch = originalFetch;
    if (app) await app.close();
    await db.end();
  });
