// Explicit destructive-fixture tests: only a dedicated *_test database is accepted.
const assert = require('node:assert/strict');
const http = require('node:http');
const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const base = new URL(process.env.TEST_API_URL || 'http://127.0.0.1:4417');
const connection = process.env.TEST_OPERATOR_DATABASE_URL;
if (!connection || !new URL(connection).pathname.endsWith('_test'))
  throw new Error(
    'Use a dedicated _test database and TEST_OPERATOR_DATABASE_URL',
  );
for (const name of ['TEST_DATABASE_URL', 'TEST_PLATFORM_DATABASE_URL']) {
  if (!process.env[name]) throw new Error('Set ' + name + ' for the disposable test database');
}
const db = new Client({ connectionString: connection });
const password = 'StyleDeskDemo!2026';
function api(host, path, body, token, method, branch) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: base.hostname,
        port: base.port,
        path,
        method: method || (body ? 'POST' : 'GET'),
        headers: {
          host,
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: 'Bearer ' + token } : {}),
          ...(branch ? { 'x-branch-id': branch } : {}),
        },
      },
      (res) => {
        let t = '';
        res.on('data', (c) => (t += c));
        res.on('end', () => {
          let data;
          try {
            data = JSON.parse(t);
          } catch {
            data = t;
          }
          resolve({
            status: res.statusCode,
            data,
            cookie: res.headers['set-cookie']?.join(';'),
          });
        });
      },
    );
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
function ok(r, status = 200) {
  assert.equal(r.status, status, JSON.stringify(r.data));
  return r.data;
}
async function tokenFor(recipient) {
  const { rows } = await db.query(
    'SELECT body FROM platform_outbox WHERE recipient=$1 ORDER BY next_attempt DESC LIMIT 1',
    [recipient],
  );
  return rows[0].body.match(/token=([a-f0-9]+)/)[1];
}
(async () => {
  await db.connect();
  const p = await api('localhost', '/platform/login', {
    email: 'superadmin@styledesk.test',
    password,
  });
  ok(p, 201);
  const platformToken = p.cookie.match(/platformToken=([^;]+)/)[1];
  const a = ok(
    await api('client1.localhost', '/auth/login', {
      useremail: 'admin@client1.test',
      password,
    }),
    201,
  );
  const b = ok(
    await api('client2.localhost', '/auth/login', {
      useremail: 'admin@client2.test',
      password,
    }),
    201,
  );
  const tenantId = a.user.tenantId,
    owner = a.accessToken;
  ok(await api('localhost', '/platform/me', null, platformToken));
  assert.equal(
    (await api('localhost', '/platform/me', null, owner)).status,
    401,
  );
  assert.equal(
    (await api('client1.localhost', '/access/bootstrap', null, platformToken))
      .status,
    401,
  );
  assert.equal(
    (await api('client2.localhost', '/access/bootstrap', null, owner)).status,
    401,
  );
  assert.equal(
    (await api('client1.localhost', '/platform/packages/public')).status,
    404,
  );
  assert.equal(
    (
      await api('localhost', '/auth/login', {
        useremail: 'admin@client1.test',
        password,
      })
    ).status,
    404,
  );
  assert.equal((await api('unknown.localhost', '/access/public')).status, 404);
  assert.equal(
    (await api('unknown.example.net', '/access/public')).status,
    404,
  );
  assert.equal(
    (
      await api(
        'client1.localhost',
        '/auth/register',
        { useremail: 'unauthorized@test.example', password, role: 'staff' },
        owner,
      )
    ).status,
    403,
  );
  const staffBefore = (
    await db.query(
      "SELECT count(*)::int AS n FROM auth WHERE tenant_id=$1 AND active AND role::text<>'customer'",
      [tenantId],
    )
  ).rows[0].n;
  const initial = ok(
    await api('client1.localhost', '/access/bootstrap', null, owner),
  );
  assert(initial.features.includes('finance'));
  ok(
    await api(
      'localhost',
      `/platform/tenants/${tenantId}`,
      {
        reason: 'Integration feature revocation',
        overrides: { finance: false, 'landing-page': false, domains: false },
      },
      platformToken,
      'PATCH',
    ),
  );
  assert.equal(
    (await api('client1.localhost', '/finance', null, owner)).status,
    403,
  );
  assert.equal(
    ok(await api('client1.localhost', '/access/public')).landingPage,
    false,
  );
  assert.equal(
    (await api('client1.localhost', '/tenant-console/domains', null, owner))
      .status,
    403,
  );
  assert.equal(
    ok(
      await api('client1.localhost', '/access/bootstrap', null, owner),
    ).features.includes('finance'),
    false,
  );
  ok(
    await api('client1.localhost', '/tenant-console/subscription', null, owner),
  );
  ok(
    await api(
      'localhost',
      `/platform/tenants/${tenantId}`,
      {
        reason: 'Restore test features',
        overrides: { finance: null, 'landing-page': null, domains: null },
        staff_limit:
          (
            await db.query(
              "SELECT count(*)::int AS n FROM auth WHERE tenant_id=$1 AND active AND role::text<>'customer'",
              [tenantId],
            )
          ).rows[0].n + 1,
      },
      platformToken,
      'PATCH',
    ),
  );
  const invites = await Promise.all(
    [1, 2].map((n) =>
      api(
        'client1.localhost',
        '/tenant-console/invitations',
        { email: `staff-${randomUUID()}@styledesk.test` },
        owner,
      ),
    ),
  );
  assert.equal(
    invites.filter((r) => r.status === 201).length,
    1,
    JSON.stringify(invites),
  );
  assert.equal(invites.filter((r) => r.status === 400).length, 1);
  const {
    rows: [invite],
  } = await db.query(
    "SELECT * FROM platform_invitation WHERE tenant_id=$1 AND realm='tenant' AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1",
    [tenantId],
  );
  const invitation = await tokenFor(invite.email);
  assert.notEqual(invite.token_hash, invitation);
  ok(
    await api('client1.localhost', '/tenant-console/accept', {
      token: invitation,
      password,
    }),
    201,
  );
  assert.equal(
    (
      await api('client1.localhost', '/tenant-console/accept', {
        token: invitation,
        password,
      })
    ).status,
    400,
  );
  const usage = ok(
    await api('client1.localhost', '/tenant-console/usage', null, owner),
  );
  assert.equal(Number(usage.staff), staffBefore + 1);
  assert.equal(Number(usage.reserved), 0);
  ok(
    await api(
      'localhost',
      `/platform/tenants/${tenantId}`,
      { reason: 'Downgrade does not delete users', staff_limit: 1 },
      platformToken,
      'PATCH',
    ),
  );
  assert.equal(
    Number(
      ok(await api('client1.localhost', '/tenant-console/usage', null, owner))
        .staff,
    ),
    staffBefore + 1,
  );
  assert.equal(
    (
      await api(
        'client1.localhost',
        '/tenant-console/invitations',
        { email: 'over-limit@styledesk.test' },
        owner,
      )
    ).status,
    400,
  );
  const {
    rows: [ownerRow],
  } = await db.query(
    "SELECT id FROM auth WHERE tenant_id=$1 AND role='admin'",
    [tenantId],
  );
  await assert.rejects(
    db.query('UPDATE auth SET active=false WHERE id=$1', [ownerRow.id]),
    /last tenant owner/,
  );
  assert.equal(
    (
      await api(
        'localhost',
        `/platform/users/${p.data.id}`,
        { active: false },
        platformToken,
        'PATCH',
      )
    ).status,
    403,
  );
  const readOnly = ok(
    await api(
      'client1.localhost',
      '/tenant-console/roles',
      {
        name: 'Invoices read-only ' + randomUUID().slice(0, 6),
        branch_scope: 'home',
        permissions: ['invoice:view', 'roles:view', 'roles:manage', 'user-management:view', 'user-management:edit', 'user-management:manage', 'user-management:invite'],
      },
      owner,
    ),
    201,
  );
  const {
    rows: [staff],
  } = await db.query(
    'SELECT id FROM auth WHERE tenant_id=$1 AND useremail=$2',
    [tenantId, invite.email],
  );
  ok(
    await api(
      'client1.localhost',
      `/tenant-console/users/${staff.id}`,
      { role_id: readOnly.id },
      owner,
      'PATCH',
    ),
  );
  const staffLogin = ok(
    await api('client1.localhost', '/auth/login', {
      useremail: invite.email,
      password,
    }),
    201,
  );
  assert.equal(
    (
      await api(
        'client1.localhost',
        '/tenant-console/roles',
        {
          name: 'Escalated',
          permissions: ['finance:delete'],
          branch_scope: 'home',
        },
        staffLogin.accessToken,
      )
    ).status,
    403,
  );
  assert.equal(
    (await api('client1.localhost', '/invoice', {}, staffLogin.accessToken))
      .status,
    403,
  );
  assert.equal((await api('client1.localhost', '/user-management/'+ownerRow.id, {password:'MaliciousReset!2026'}, staffLogin.accessToken, 'PATCH')).status,403);
  assert.equal((await api('client1.localhost', '/user-management/'+staff.id, {role:'storeManager'}, staffLogin.accessToken, 'PATCH')).status,403);
  const tenantWide = ok(await api('client1.localhost','/tenant-console/roles',{
    name:'Tenant-wide limited '+randomUUID().slice(0,6),branch_scope:'tenant',permissions:['invoice:view']
  },owner),201);
  assert.equal((await api('client1.localhost','/tenant-console/invitations',{email:'escalated-'+randomUUID()+'@example.test',role_id:tenantWide.id},staffLogin.accessToken)).status,403);
  assert.equal((await api('client1.localhost','/tenant-console/users/'+staff.id,{role_id:tenantWide.id},staffLogin.accessToken,'PATCH')).status,403);
  const visibleUsers = ok(await api('client1.localhost','/user-management',null,staffLogin.accessToken));
  assert(visibleUsers.some(u=>u.id===staff.id));assert(!visibleUsers.some(u=>u.id===ownerRow.id));
  const packages = ok(await api('localhost', '/platform/packages/public'));
  const starter = packages.find((p) => p.slug === 'starter'),
    growth = packages.find((p) => p.slug === 'growth');
  for (const pkg of [starter, growth]) {
    const slug = 'verify-' + randomUUID().slice(0, 8),
      email = slug + '@styledesk.test';
    const created = ok(
      await api('localhost', '/platform/onboard', {
        name: slug,
        slug,
        email,
        password,
        package_id: pkg.package_id,
        interval: 'monthly',
      }),
      201,
    );
    const emailToken = await tokenFor(email);
    ok(
      await api('localhost', '/platform/activate', { token: emailToken }),
      201,
    );
    const {
      rows: [sub],
    } = await db.query('SELECT * FROM tenant_subscription WHERE tenant_id=$1', [
      created.tenant_id,
    ]);
    assert.equal(sub.email_verified, true);
    assert.equal(sub.status, pkg.slug === 'starter' ? 'trial' : 'pending');
    assert.equal(
      (await api('localhost', '/platform/activate', { token: emailToken }))
        .status,
      400,
    );
  }
  // Custom hosts disappear on entitlement revocation; tenant subdomain survives.
  const custom = 'domain-' + randomUUID().slice(0, 8) + '.example.org';
  await db.query(
    "INSERT INTO tenant_domain(tenant_id,hostname,verification_token,status) VALUES($1,$2,'verified-test','active')",
    [tenantId, custom],
  );
  ok(await api(custom, '/access/public'));
  ok(
    await api(
      'localhost',
      `/platform/tenants/${tenantId}`,
      { reason: 'Domain revocation', overrides: { domains: false } },
      platformToken,
      'PATCH',
    ),
  );
  assert.equal((await api(custom, '/access/public')).status, 404);
  ok(await api('client1.localhost', '/access/public'));
  // Restricted connections cannot read tenant records or execute operator functions.
  for (const [env, sql] of [
    ['TEST_PLATFORM_DATABASE_URL', 'SELECT * FROM invoice'],
    ['TEST_DATABASE_URL', 'SELECT * FROM platform_account'],
    [
      'TEST_DATABASE_URL',
      "SELECT platform_provision('x','x','x@test.example','hash',gen_random_uuid(),'monthly')",
    ],
  ]) {
    const client = new Client({ connectionString: process.env[env] });
    await client.connect();
    try {
      await assert.rejects(client.query(sql), /permission denied/);
    } finally {
      await client.end();
    }
  }
  // Restore the explicit demo package limits and feature flags; test accounts remain visible.
  ok(
    await api(
      'localhost',
      `/platform/tenants/${tenantId}`,
      {
        reason: 'Restore demo defaults',
        staff_limit: null,
        overrides: { domains: null },
      },
      platformToken,
      'PATCH',
    ),
  );
  console.log(
    'Platform API integration passed: realm/host separation, owner feature enforcement, concurrent reservations, single-use links, seat downgrade, RBAC escalation, last owners, onboarding, domains, restricted database grants.',
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());
