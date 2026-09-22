# StyleDesk frontend

Next.js 16 / React 19 frontend with business subdomain and branch selection. AI chat and knowledge administration have been removed.

Use Node.js 22 and `pnpm@9.15.0`. Copy `.env.example` to `.env.local`, set the private `INTERNAL_API_BASE_URL`, then run `pnpm install` and `pnpm dev`. Open a provisioned salon URL such as `http://salon-a.localhost:3000`. Provisioning and database instructions are in [the backend README](../makeover-server/README.md).

All browser API requests use the current origin's `/api/backend` proxy. SSR, metadata, sitemap and branding preserve the salon host. Public service/package booking includes branch selection. Staff use their home branch; admins can switch branches and manage active branches under `/admin/branches`. The All branches option applies only to dashboard/report reads. Branch switches clear branch-dependent client state and reload.

For production use the wildcard host rule in `.env.example`, wildcard DNS/TLS, and the private backend address. Traefik should send `/api/backend/*` to Next.js; only socket/device paths route directly to the backend. Do not use fixed public API URLs. `docker-compose.prod.yml` and the Dockerfile use Node.js 22 and reproducible locked dependencies.

Run `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm build` (or `pnpm exec next build --webpack` if Turbopack is blocked by the environment). Production builds enforce TypeScript errors. See [the verification runbook](../DOCKER_VERIFICATION_PLAN.md) for the deployment and browser acceptance checks.
