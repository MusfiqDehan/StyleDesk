# StyleDesk platform rollout

The platform UI, API, tenancy extension, subscription state machine, hosted gateway adapters, and domain worker live in the existing applications. This is an additive release on top of the shared-schema tenancy migrations. Existing workspace changes and legacy database volumes are retained.

## Hosts and identities

| Host | Website | Authentication | Console |
| --- | --- | --- | --- |
| styledesk.musfiqdehan.com | StyleDesk product and live package pricing | Invited platform accounts | /admin |
| client1.styledesk.musfiqdehan.com | Existing salon website | Tenant staff/customer accounts | /admin |
| Verified tenant alias | Owning salon | Same tenant accounts | /admin |

Platform accounts, role records, JWT audience/secret, and host-only `platformToken` cookies are separate from tenant identities. Tenant cookies use `accessToken` and the tenant JWT audience. Accounts are read again on each authenticated request. Platform authentication never grants business-table access. The restricted platform role has metadata/payment grants and narrow provisioning/usage functions; tenant business records remain under forced RLS.

Use `/register` on the platform host for business onboarding. Staff and platform accounts join through expiring hashed, single-use invitations. Customers use registration on the salon host. Invite and activation emails are delivered from `platform_outbox`; without SMTP they remain queued. A new owner can sign in for billing/recovery while verification or payment is pending, but business APIs remain blocked.

## Operator preparation

1. Back up the tenancy database and validate this migration chain in staging. Never apply the original fresh-schema baseline to a legacy database containing unconverted salon tables. Existing tenants in the tenancy schema receive an unpublished Compatibility package, with their access preserved and existing preset permissions converted to action permissions.
2. Create separate PostgreSQL login roles `styledesk_runtime` and `styledesk_platform`, both non-owners with `NOSUPERUSER NOBYPASSRLS`. Give each a distinct password. Only the operator/migration role owns tables and functions.
3. Set runtime variables from `.env.example`: `DATABASE_URL`, `PLATFORM_DATABASE_URL`, independent `JWT_SECRET` and `PLATFORM_JWT_SECRET` (platform secret at least 24 characters), a durable 64-hex `PAYMENT_ENCRYPTION_KEY`, Redis, host/origin variables, and SMTP when available. Generate the encryption key with `openssl rand -hex 32`; keep it with backups. Rotating it requires re-encrypting stored gateway credentials and retained attempt snapshots.
4. Build, migrate with the operator connection, and apply explicit grants:

```sh
npm run build
# Export operator-only MIGRATION_DATABASE_URL for this shell/command.
RUNTIME_DATABASE_ROLE=styledesk_runtime PLATFORM_DATABASE_ROLE=styledesk_platform npm run db:migrate
# Export PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD (12+ characters).
npm run platform:bootstrap
```

`platform:bootstrap` is repeatable and preserves existing credentials. Migration and bootstrap credentials are never passed to application or domain-worker containers. Both application database connections fail startup when their role owns tables or has SUPERUSER/BYPASSRLS.

## Explicit development demos

Run against a development/test database, after migrations and grants:

```sh
NODE_ENV=development npm run seed:demo
```

The command requires the operator connection in its shell. It refuses `NODE_ENV=production`, never runs automatically at startup, and preserves existing account passwords. It creates two Pro demo tenants with 30 days of complimentary access. Repeating the command explicitly renews the demo complimentary period.

| Host | Email | Password |
| --- | --- | --- |
| localhost:3000 | superadmin@styledesk.test | StyleDeskDemo!2026 |
| client1.localhost:3000 | admin@client1.test | StyleDeskDemo!2026 |
| client2.localhost:3000 | admin@client2.test | StyleDeskDemo!2026 |

Set `PLATFORM_HOST=localhost`, `TENANT_BASE_DOMAIN=localhost`, `PLATFORM_PUBLIC_URL=http://localhost:3000`, `PUBLIC_URL_SCHEME=http`, and `PUBLIC_URL_PORT=3000`. Frontend `PLATFORM_HOST` and build-time `NEXT_PUBLIC_PLATFORM_HOST` must agree. Do not reuse demo passwords in production.

## Packages and access

Published demo prices are Starter BDT 1,490/14,900, Growth 2,990/29,900, and Pro 5,990/59,900, monthly/yearly. Staff/customer caps are 5/200, 15/1,000, and 50/10,000. Starter has a configurable 14-day trial. Prices, currencies, caps, trials, and entitlements are edited through Packages; saving creates immutable versions. Existing agreements keep their version. Tenant-requested changes freeze a version and apply at the next billing boundary without proration. Platform adjustments require an audit reason.

`src/platform/features.ts` is the entitlement/action registry. Owners require entitlements too. Package defaults and explicit grant/block overrides are resolved with prerequisite suppression. Unknown business API modules fail closed. `/access/bootstrap` supplies live permissions, effective features, limits, and revision to navigation and route guards. Clients refresh on focus and every 15 seconds; sockets revalidate at the same interval. Backend changes apply to the next request. Disabled websites redirect marketing routes to login while account, recovery, invitation, billing, and callbacks remain accessible.

Active login accounts consume seats, not employee/client records alone. Owners consume staff seats; live invitations reserve seats. PostgreSQL locks serialize reservations, acceptance, registration, and reactivation. Expired/revoked invitations free seats. A limit downgrade preserves accounts and blocks additional seats. Last-owner and last-superadmin safeguards are enforced separately.

Administrative suspension controls `tenant.active` and takes precedence over subscription payment. Trial/complimentary expiry and seven-day renewal grace are checked on every business request; workers also persist status changes. Global grace is editable in Settings; package trials are edited in Packages. Owners retain `/billing` for renewal and cancellation management.

## Gateways and reconciliation

Both catalog entries start disabled. Supply actual merchant credentials through Gateways and tenant payment settings. Secret fields are write-only, blank updates preserve stored values, and each attempt retains its encrypted credential snapshot. Global platform subscription availability and tenant availability are independent; per-tenant policies can additionally block a gateway.

Configure Stripe subscription events on the platform endpoint:

```
https://styledesk.musfiqdehan.com/api/backend/platform/payments/webhooks/stripe
```

For each entitled tenant merchant instance, use the stable subdomain endpoint:

```
https://client1.styledesk.musfiqdehan.com/api/backend/payments/webhooks/stripe
```

Enable `checkout.session.completed`, async checkout success/failure, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, and relevant refund/dispute events. Configure the signing secret belonging to that endpoint. Stripe API version defaults to `2024-06-20`; test any version change before rollout. Next forwards untouched raw body bytes and the Stripe signature header. Browser redirects never authorize settlement by themselves.

Stripe platform checkout creates automatic subscriptions. SSLCommerz uses hosted checkout plus explicit renewal reminders and server validation, including session status queries for missed callbacks. Stable callbacks never depend on a removable custom domain. Payment disabling stops new attempts while retained attempts continue validation. Recurring cancellation is a separate subscription action.

Invoice checkout derives the outstanding balance/currency server-side and verifies customer ownership or staff action permissions. Invoice and attempt locks serialize online/offline changes and FIFO due collection. Settlement calls the existing invoice service and commission handling, inserts one settlement, and commits atomically. Provider outages retain pending attempts for reconciliation. Refund/dispute events are retained and audited for operator review; automated refunds are outside this release.

The payment integration suite mocks provider responses while exercising real PostgreSQL, forced RLS, and business settlement. Actual Stripe/SSLCommerz sandbox merchant checkout remains a staging requirement with deployment credentials.

## Production routing and automatic custom domains

Use these settings in both application compose projects:

```
PLATFORM_HOST=styledesk.musfiqdehan.com
NEXT_PUBLIC_PLATFORM_HOST=styledesk.musfiqdehan.com
TENANT_BASE_DOMAIN=styledesk.musfiqdehan.com
PLATFORM_PUBLIC_URL=https://styledesk.musfiqdehan.com
PUBLIC_URL_SCHEME=https
PUBLIC_URL_PORT=
TENANT_HOST_RULE=Host(`styledesk.musfiqdehan.com`) || HostRegexp(`^[a-z0-9-]+\.styledesk\.musfiqdehan\.com$`)
DOMAIN_CNAME_TARGET=styledesk.musfiqdehan.com
DOMAIN_PUBLIC_IP=<public proxy IPv4 for apex A records>
```

Traefik `dynamic/nested-platforms.yml` includes the platform and its nested wildcard under the existing Cloudflare DNS-01 resolver. Set Cloudflare DNS records and DNS API access as deployment inputs. Preserve the existing biometric HTTP routers and HTTP-01 ACME challenge access. Frontend router priority 50 takes precedence over the certificate bootstrap router.

The production backend compose includes a dedicated `StyleDesk-domain-worker`. It has no Docker socket and writes only `styledesk-domains.json` into the shared `styledesk_traefik_generated` volume. Traefik mounts this volume read-only beneath its watched dynamic directory. Start the Traefik stack first to create the named volume, then the application stacks. The current backend image runs as root; if deploying it under a non-root UID, give that UID write access only to this dedicated volume and uploads.

DNS instructions appear in tenant Settings / Domains. The worker checks the exact TXT token, public routing addresses, the proxy target, and HTTPS validation before activating a domain. It then requires the expected tenant ID from `/api/backend/domain-proof` through the generated route; this token-bound probe exposes no business APIs while the host is provisioning. It uses atomic file replacement, retries with backoff, and reconciles after restart. Tenant aliases are uniquely reserved; the initial platform slug stays stable. Owners can select one active primary alias; metadata/canonical URLs use it. Feature revocation immediately prevents host resolution; generated routes are removed on the next worker cycle (30 seconds). Standard subdomain billing remains accessible. Configure trusted proxy IPs explicitly; forwarded host headers from other peers are ignored.

Live DNS propagation, ACME issuance/renewal, Cloudflare permissions, SMTP delivery, and real biometric hardware require staging inputs and cannot be established by local mocked tests.

## Verification and rollout gate

From the backend, against an isolated disposable database whose name ends in `_test`:

```sh
npm run build
npm test -- --runInBand
npx tsc --noEmit
# Set TEST_DATABASE_URL (runtime), TEST_PLATFORM_DATABASE_URL, TEST_OPERATOR_DATABASE_URL.
npm run test:tenancy
# Seed demos explicitly; start API with PLATFORM_HOST/TENANT_BASE_DOMAIN=localhost.
TEST_API_URL=http://127.0.0.1:4417 npm run test:platform
npm run test:platform:payments
# Set TEST_FRONTEND_PORT and the test PAYMENT_ENCRYPTION_KEY; start Next proxy.
npm run test:platform:http
# Provision salon-a (two branches) / salon-b, then run regression fixtures.
TEST_ADMIN_PASSWORD=StyleDeskDemo!2026 TEST_API_URL=http://127.0.0.1:4417 npm run test:tenancy:api
```

Frontend checks are `npm run lint`, `npx tsc --noEmit`, `npm run build -- --webpack`, and `node scripts/test-auth-redirect.cjs`. Lint currently has warnings but no errors. Check platform and both tenants in a connected browser at desktop/mobile sizes; test pricing interval switching, login realms, invitation screens, disabled menus/direct URLs, owner billing recovery, own invoice checkout, and DNS settings. See the root `DOCKER_VERIFICATION_PLAN.md` for container smoke checks.

Do not switch production host routing until staging has passed the external gateway, mail, DNS/TLS, browser, and device checks. Back up before migration. Roll back application routing first; restore the database backup to undo platform schema changes (the migration intentionally has no destructive down operation).

## Workspace demonstration recorded on 2026-10-03

An explicitly seeded clean database (`styledesk_platform_demo`) is separate from the disposable test fixtures and the pre-existing workspace database. The local application preview uses frontend port 3417 and API port 4417. Logins were verified through the frontend proxy:

| Console | URL | Login | Password |
| --- | --- | --- | --- |
| Platform | http://localhost:3417/login | superadmin@styledesk.test | StyleDeskDemo!2026 |
| Tenant 1 | http://client1.localhost:3417/login | admin@client1.test | StyleDeskDemo!2026 |
| Tenant 2 | http://client2.localhost:3417/login | admin@client2.test | StyleDeskDemo!2026 |

These are workspace preview processes, not a production deployment. The PostgreSQL test/demo container is `styledesk-platform-test-pg` on localhost port 55439. Build and test records are summarized in the root Docker verification plan. No demo identities are inserted on application startup.
