// End-to-end HTTP proxy checks. Requires explicit disposable database and demo seed.
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID, createHmac } = require('node:crypto');
const { Client } = require('pg');
const { encrypt } = require('../dist/src/platform/crypto.js');
const url = process.env.TEST_OPERATOR_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Use explicit disposable _test database');
const port = Number(process.env.TEST_FRONTEND_PORT || 3417);
const db = new Client({ connectionString: url });
function request(host, path, body, cookie, method, headers = {}) {
  const payload =
    body == null
      ? undefined
      : Buffer.isBuffer(body)
        ? body
        : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: method || (payload ? 'POST' : 'GET'),
        headers: {
          host,
          ...(payload
            ? {
                'content-type': 'application/json',
                'content-length': payload.length,
              }
            : {}),
          ...(cookie ? { cookie } : {}),
          ...headers,
        },
      },
      (res) => {
        let text = '';
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => {
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}
let platformCookie, tenantId;
(async () => {
  await db.connect();
  const platformRoot = await request('localhost', '/');
  assert.equal(platformRoot.status, 200);
  assert.match(platformRoot.data, /StyleDesk/);
  for (const host of ['client1.localhost', 'client2.localhost']) {
    const root = await request(host, '/');
    assert.equal(root.status, 200);
    assert(
      /Demo client[12]/.test(root.data),
      'Tenant-specific branding missing',
    );
  }
  assert.equal((await request('unregistered.localhost', '/')).status, 404);
  assert.equal((await request('localhost', '/platform-ui/admin')).status, 404);
  const p = await request('localhost', '/api/backend/platform/login', {
    email: 'superadmin@styledesk.test',
    password: 'StyleDeskDemo!2026',
  });
  assert.equal(p.status, 201);
  assert(!p.headers['set-cookie'][0].includes('Domain='));
  platformCookie = p.headers['set-cookie'][0].split(';')[0];
  const t = await request('client1.localhost', '/api/backend/auth/login', {
    useremail: 'admin@client1.test',
    password: 'StyleDeskDemo!2026',
  });
  assert.equal(t.status, 201);
  assert(!t.headers['set-cookie'][0].includes('Domain='));
  tenantId = t.data.user.tenantId;
  const tenantCookie = t.headers['set-cookie'][0].split(';')[0];
  assert.equal(
    (await request('localhost', '/api/backend/platform/me', null, tenantCookie))
      .status,
    401,
  );
  assert.equal(
    (
      await request(
        'client2.localhost',
        '/api/backend/access/bootstrap',
        null,
        tenantCookie,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        'client1.localhost',
        '/api/backend/access/bootstrap',
        null,
        platformCookie,
      )
    ).status,
    401,
  );
  assert.equal(
    (await request('localhost', '/admin', null, platformCookie)).status,
    200,
  );
  const changed = await request(
    'localhost',
    '/api/backend/platform/tenants/' + tenantId,
    { reason: 'HTTP website gate test', overrides: { 'landing-page': false } },
    platformCookie,
    'PATCH',
  );
  assert.equal(changed.status, 200);
  // Visibility caches last at most five seconds; the API rejects immediately.
  await new Promise((resolve) => setTimeout(resolve, 5500));
  const hidden = await request('client1.localhost', '/');
  assert.equal(hidden.status, 307);
  assert.match(hidden.headers.location, /\/login(?:\?|$)/);
  assert.equal(
    (await request('client1.localhost', hidden.headers.location)).status,
    200,
  );
  assert.equal((await request('client1.localhost', '/register')).status, 200);
  assert.equal(
    (await request('client1.localhost', '/billing', null, tenantCookie)).status,
    200,
  );
  // Whitespace and trailing newline must survive Next's webhook proxy unchanged.
  const tran = 'HTTP-' + randomUUID();
  await db.query(
    "INSERT INTO payment_attempt(tran_id,tenant_id,source,source_id,gateway_slug,amount,currency,status,credential_snapshot,sandbox) VALUES($1,$2,'subscription',$2,'stripe',2990,'BDT','failed',$3,true)",
    [
      tran,
      tenantId,
      encrypt({ secret_key: 'sk_test', webhook_secret: 'whsec_proxy_test' }),
    ],
  );
  const bytes = Buffer.from(
    JSON.stringify(
      {
        id: 'evt_' + randomUUID(),
        type: 'charge.refunded',
        data: { object: { metadata: { tran_id: tran } } },
      },
      null,
      2,
    ) + '\n',
  );
  const stamp = Math.floor(Date.now() / 1000);
  const signature =
    't=' +
    stamp +
    ',v1=' +
    createHmac('sha256', 'whsec_proxy_test')
      .update(stamp + '.')
      .update(bytes)
      .digest('hex');
  const invalid = await request(
    'localhost',
    '/api/backend/platform/payments/webhooks/stripe',
    bytes,
    null,
    'POST',
    { 'stripe-signature': 't=' + stamp + ',v1=00' },
  );
  assert.equal(invalid.status, 400);
  const valid = await request(
    'localhost',
    '/api/backend/platform/payments/webhooks/stripe',
    bytes,
    null,
    'POST',
    { 'stripe-signature': signature },
  );
  assert.equal(valid.status, 201, JSON.stringify(valid.data));
  assert(
    (
      await db.query(
        'SELECT processed_at FROM payment_event WHERE event_id=$1',
        [JSON.parse(bytes).id],
      )
    ).rows[0].processed_at,
  );
  const host = 'proof-' + randomUUID().slice(0, 8) + '.example.org',
    proof = randomUUID();
  await db.query(
    "INSERT INTO tenant_domain(tenant_id,hostname,verification_token,status,verified_at) VALUES($1,$2,$3,'provisioning',now())",
    [tenantId, host, proof],
  );
  const probe = await request(host, '/api/backend/domain-proof?token=' + proof);
  assert.equal(probe.status, 200);
  assert.equal(probe.data.tenantId, tenantId);
  assert.equal(
    (await request(host, '/api/backend/domain-proof?token=wrong')).status,
    404,
  );
  assert.equal((await request(host, '/api/backend/access/public')).status, 404);
  console.log(
    'PASS: platform/two-tenant host routing, unknown hosts, host-only cookies, realm rejection, protected panel, website redirect/recovery, and raw Stripe webhook signature through Next proxy',
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (platformCookie && tenantId)
      await request(
        'localhost',
        '/api/backend/platform/tenants/' + tenantId,
        {
          reason: 'Restore HTTP test feature',
          overrides: { 'landing-page': null },
        },
        platformCookie,
        'PATCH',
      );
    await db.end();
  });
