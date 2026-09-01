# StyleDesk API

NestJS, TypeORM and PostgreSQL 16. One tenant is a business; each tenant has one or more branches. Browser requests use the salon subdomain. Unknown or inactive salons return 404. AI chat, knowledge management, embeddings and their schema/dependencies have been removed.

## Fresh installation

Use Node.js 22. Copy `.env.example` to `.env`, replace secrets and run `npm ci --legacy-peer-deps` and `npm run build`. Schema synchronization is disabled in every environment. The baseline migration deliberately refuses an existing application schema; deploy to a new database without deleting the legacy database or volume.

Start PostgreSQL and Redis with `docker compose -f docker-compose.local.yml up -d StyleDesk-postgres-dev StyleDesk-redis-dev` after creating the shared `StyleDesk-dev` network. Compose uses a new `styledesk_tenancy_pg16_dev` volume by default. Operator database credentials belong only to PostgreSQL and explicit operator commands; the running API receives restricted runtime credentials.

Using an operator connection, create the runtime role (choose a unique password):

```sql
CREATE ROLE styledesk_runtime LOGIN PASSWORD 'replace-runtime-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
```

Export `MIGRATION_DATABASE_URL` for the new database and `RUNTIME_DATABASE_ROLE=styledesk_runtime` in an operator shell. Then (build first; operator commands also run directly in the compiled Docker image):

```sh
npm run db:migrate
# Export TENANT_ADMIN_PASSWORD (at least 12 characters) in this operator shell.
npm run tenant:provision -- --slug salon-a --name 'Salon A' --email owner@example.test
npm run tenant:provision -- --slug salon-a --name 'Salon A' --branch second --branch-name 'Second Branch'
npm run tenant:provision -- --slug salon-b --name 'Salon B' --email owner@example.test
```

Use `DATABASE_URL` with the restricted role to start the API (`npm run start:prod`; use `npm run start:dev` for TypeScript watch/restart) and `INTERNAL_API_BASE_URL=http://localhost:4000` to start the frontend. Local tenant URLs are `http://salon-a.localhost:3000` and `http://salon-b.localhost:3000`. There is no default account, default tenant or self-service business registration. `/health` does not require a tenant host.

## Security and operation

Read [the tenancy architecture](docs/architecture-audit.md) and [verification runbook](../DOCKER_VERIFICATION_PLAN.md). Runtime startup rejects a superuser, a role with BYPASSRLS or an owner of business tables. The migration account must own its security-definer directory functions and have the privilege to provision businesses under forced RLS; it must never be used by the API.

Public catalog, clients and branding are business-wide. Appointments, invoices, financial entries, inventory, payroll, attendance and settings belong to a branch. Staff and managers can use only their home branch. Business admins select an active branch and may request all-branch GET dashboard/report aggregates; writes always use one branch. Account emails and customer phone numbers can repeat in different businesses. Invoice numbers are unique within a business.

The application derives tenant identity from `TENANT_BASE_DOMAIN` and the request host. Only exact addresses in `TRUSTED_PROXY_IPS` may supply forwarded hosts. Tokens must match the resolved tenant and current account/token version. Never trust an incoming tenant ID. Keep the API private behind Next.js/reverse-proxy routing except authenticated device endpoints. Host-only branch cookies and authentication storage stay on the salon origin.

### Devices

Register each device with the operator provisioning command, selecting its tenant and branch:

```sh
# Export DEVICE_SECRET (at least 24 characters), then:
npm run tenant:provision -- --slug salon-a --name 'Salon A' --device DEVICE-SERIAL --device-host 192.0.2.10
```

`--device-host` is optional and enables direct TCP polling at port 4370. For push-only devices omit it. Authentication requires the registration secret in `X-Iclock-Key`/`X-Punch-Key`, or a separately registered exact source IP (`--device-ip`). A serial number alone never authenticates a device. For firmware without custom headers, use a restricted device proxy that injects the device-specific secret; prohibit public callers from reaching that proxy. Protect plaintext device traffic using network restrictions/VPN where TLS is unsupported. No subnet discovery runs. Device PINs, queues, connectivity and attendance are scoped to the registration.

### Seeds and maintenance

Seeds require a runtime database connection and explicit tenant/branch UUIDs; never use an operator role:

```sh
node scripts/seed-services-packages.mjs --tenant TENANT_UUID --branch BRANCH_UUID
node scripts/seed-inventory.mjs --tenant TENANT_UUID --branch BRANCH_UUID
node scripts/fix-service-name-whitespace.mjs --tenant TENANT_UUID --branch BRANCH_UUID
```

### Production

Configure wildcard DNS and wildcard TLS before release. Set `TENANT_BASE_DOMAIN`, the matching `TENANT_HOST_RULE` Traefik expression and explicit trusted proxy addresses. Frontend routes `/api/backend/*` through Next.js, preserving the salon host; Traefik forwards only `/api/socket.io` and device traffic directly to Nest. Never route all `/api/*` directly to Nest. Set `INTERNAL_API_BASE_URL` to the API's private address. Use a dedicated new database/volume and run migrations/provisioning explicitly before starting runtime containers. Existing databases are neither migrated nor deleted by this rollout.

### Checks

```sh
npm test -- --runInBand
npm run build
npx tsc --noEmit
# Disposable database, separate operator/runtime roles:
node scripts/test-tenancy.cjs
# Running API with provisioned salon-a/salon-b and at least two branches in salon-a:
node scripts/test-api-tenancy.cjs
```

Integration tests require `TEST_OPERATOR_DATABASE_URL`, `TEST_DATABASE_URL`, and API tests require `TEST_ADMIN_PASSWORD`. See the root verification runbook for the recorded checks and remaining deployment/hardware checks.


## Platform administration release

Use the [platform rollout runbook](docs/platform-rollout.md) for separate account realms, subscriptions, encrypted hosted gateways, custom domains, restricted grants, and explicit demo seeding. The platform host is `styledesk.musfiqdehan.com`; each tenant retains its subdomain and existing salon UI. Operators run `platform:bootstrap` or development/test-only `seed:demo` after migrations; applications never bootstrap accounts automatically. Both runtime database URLs and independent JWT secrets are now required.
