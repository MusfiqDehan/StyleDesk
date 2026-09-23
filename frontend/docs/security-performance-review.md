# Security and performance review — 2026-09-23

This is a targeted code review and remediation pass, not a penetration test or load certification. Existing unrelated workspace changes were preserved.

## Fixed

- JWT validation rejects deleted users, changed roles and invalid token versions. Password changes and resets increment tokenVersion, revoking prior HTTP sessions.
- JWT validation selects only account verification fields and disables eager employee/client relations, reducing database work on each authenticated request.
- Signup cannot claim an existing customer record based only on their phone number: the verified signup email must match the existing record.
- Public login, email/code verification and reset endpoints now use runtime DTO validation. OTP generation uses Node crypto.randomInt instead of Math.random.
- Production startup no longer creates an administrator with public development credentials. Production login cookies always require HTTPS.
- WebSocket handshakes enforce configured origins, check current account role/version, and disconnect at token expiry. HTTP and WebSocket origin policies now share one implementation.
- Admin API data no longer persists in localStorage or replays through the response cache. Old aci:* entries are removed. This intentionally trades cached admin navigation for account isolation; endpoint-specific caching should be reintroduced only with explicit session scoping.
- The 401 handler uses a separate Axios request for logout, avoiding recursive interceptor calls. API calls have bounded timeouts.
- Rate limiting runs before JWT database validation.
- Dashboard low-stock lookup filters and selects fields in SQL instead of loading all inventory.
- Image uploads have byte/pixel limits and asynchronous directory creation.
- Next image optimization accepts only API uploads and explicitly configured extra origins. Security response headers were added. Mutable public assets no longer have a one-year immutable policy.
- Updated vulnerable frontend/backend dependencies and both frontend lockfiles. Pinned Nest's transitive Multer to the patched 2.3.x range via an override, avoiding a Nest major upgrade.

## Verification

- Six targeted authentication regression tests passed (`npm test -- --runInBand security-regression.spec.ts` in the server).
- Client cache isolation test passed (`node scripts/security-cache-check.cjs`).
- Server and frontend production builds passed. Next still skips TypeScript validation per the existing configuration.
- Separate frontend typecheck reports 23 existing errors, primarily admin typings and Nest files under the client. No errors point to the modified API client.
- Production dependency audits: frontend 0 known vulnerabilities; backend 0 known vulnerabilities, as reported by the package registries during this review. This is not a guarantee of vulnerability-free software.
- Live API: malformed login 400, unauthenticated /auth/me 401, local admin login succeeds, authenticated /auth/me 200.
- Browser login reached /admin and rendered the dashboard. Existing chart requests return 404; these need frontend/backend endpoint alignment.
- Untrusted external image optimizer request returned 400; login response included the new security headers.

## Deployment notes and remaining work

- Rebuild/redeploy both applications and use HTTPS in production. Review any already-existing default administrator account; this change does not delete or rotate existing credentials.
- Provision production administrators explicitly. Development bootstrap behavior is retained.
- Set CLIENT_URL/CORS_ORIGIN to exact allowed origins, including www separately if needed. Localhost is allowed automatically only outside production.
- Set IMAGE_ALLOWED_ORIGINS in the frontend build environment for additional trusted image hosts (comma-separated origins). API /uploads is already allowed.
- TypeORM synchronize and startup compatibility DDL still need migration-based deployment before production hardening is complete. Changing this without a tested baseline migration could prevent existing deployments from starting.
- Browser JWTs are still stored in localStorage by the existing auth flow. Moving to cookie-only sessions requires a coordinated frontend/backend migration.
- OTP verification state and throttling are currently process-local; multi-replica deployments need shared storage and atomic attempt/consumption handling. Existing WebSocket connections also need immediate revocation on account changes, beyond the new reconnect and expiry checks.
- Dashboard aggregates still load historical datasets; profile with representative data, move remaining aggregates to SQL, and add pagination/indexes based on EXPLAIN results. No production workload was available for a measured latency comparison.

Reference: Next.js recommends explicit remote image patterns: https://nextjs.org/docs/app/api-reference/components/image#remotepatterns
