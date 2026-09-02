# Shared database tenancy architecture

## Request and data flow

The Next.js same-origin `/api/backend` proxy and server-only `tenantFetch` preserve the request host and selected branch, use a fixed internal API destination and disable cross-tenant SSR data caching. Metadata, sitemap, branding and sidebar visibility use the salon host. Socket.IO uses the salon origin. Uploads use tenant UUID directories; deletion must match the current tenant. Public marketing files remain readable.

Nest middleware resolves an active business via a narrow security-definer directory function. Unregistered hosts fail closed. Exact configured reverse proxy addresses may supply forwarded host headers; direct caller tenant IDs are ignored. A request gets a transaction-bound AsyncLocalStorage scope. JWT authentication validates the current tenant, account, role and token version, and resolves permissions from the current scoped account/role template instead of stale token claims. Staff home branches are authoritative. Admin aggregate access is limited to dashboard/report GETs.

`ScopedOrmModule` preserves existing injected repository tokens while routing operations through the scoped transaction manager. `ScopedDataSource` scopes query builders, raw SQL and nested transactions. PostgreSQL transaction-local settings hold tenant, branch, device and authenticated account identity. Owned tables have ENABLE/FORCE RLS read/write policies. Missing context exposes no owned rows and forbids writes. Composite foreign keys reject cross-tenant and cross-branch relationships. The runtime role has no ownership, superuser or BYPASSRLS rights. Operator migration/provisioning credentials are separate.

## Ownership

Business-owned: accounts, clients, services/packages, role templates, finance categories, branding, testimonials, marketing, newsletter subscribers and legacy users. Branch-owned: employees, appointments, invoices, inventory, finance entries, attendance/logs, payroll, leaves, announcements, appointment/invoice settings and device data. Device-owned records additionally require the selected registered device. Tenant directory records are platform-owned and not directly readable by runtime repositories.

Catalog prices and customer identities are shared; booking/tax settings and customer dues are branch-specific. Customer account history is visible across that business. Staff have one home branch; business admins have no required home branch. Join tables inherit tenant ownership, and ownership-aware foreign keys guard relationships. Existing embedded names and JSON represent historical snapshots; live referenced entities are validated in scoped services.

## Effects and background work

Redis/cache keys include tenant and branch. Notifications use authenticated tenant/branch socket rooms and publish after commit. Mail dispatch occurs after commit. These effects are currently best-effort: failures are logged; there is no durable outbox/retry guarantee. Physical biometric mutations commit database work before dispatch because hardware changes cannot roll back.

Scheduled payroll, attendance and device sync iterate active scopes with advisory locks. Device state and command queues are per registration; explicit endpoints replace shared discovery. Delayed enrollment callbacks open fresh device transactions. Push authentication uses the registered secret or exact permitted source IP, never a serial alone. TCP access must use protected network paths.

## Fresh schema and operator lifecycle

The checked-in baseline schema is generated from TypeORM metadata and applied by `SharedTenancy1760000000000`, which also creates constraints, policies and directory functions. `NullableBranchReferences1760000001000` adds independent tenant foreign keys wherever nullable account branches would otherwise bypass a composite relationship check. Synchronization is always disabled. `scripts/database.cjs` applies migrations and grants the restricted runtime role access. `scripts/provision-tenant.cjs` creates tenant/branch defaults, role templates, categories and initial administrator in one transaction. Seeds require tenant/branch UUIDs and reject privileged roles.

Do not regenerate the baseline against a database with business data. Future schema changes need reviewed migrations preserving policies and composite constraints; plain generated ID-only relationships must not replace ownership-aware keys. Down-migration deliberately refuses destructive rollback.

AI code, endpoints, dependencies, schema objects and vector extension requirements have been removed. No ORM replacement is part of this change. Production rollout uses a new database, explicit provisioning and wildcard DNS/TLS. Legacy data migration, employee transfers, multi-branch staff membership, self-service tenant signup and platform admin UI are outside scope.
