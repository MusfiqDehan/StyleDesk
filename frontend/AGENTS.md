# StyleDesk frontend

Next.js 16 App Router and React 19. Use Node.js 22 and the packageManager version (`pnpm@9.15.0`). Backend is the sibling `makeover-server` repository.

## Development

Install with `pnpm install`. `pnpm dev` starts port 3000 using Webpack. Turbopack's development HMR has produced a repeating internal subscription error in this workspace, causing continuous browser refreshes; keep Webpack for development. `pnpm build` runs image conversion and the production build; `pnpm lint` checks ESLint. Also run `pnpm exec tsc --noEmit`. TypeScript build errors are enforced.

Set `INTERNAL_API_BASE_URL=http://localhost:4000` locally. Browser requests use `/api/backend` on the current salon origin, preserving host and selected branch. Do not hardcode a shared public API host or add cross-tenant caching. For tenant URLs use `http://salon-a.localhost:3000` after operator provisioning. There are no seeded default credentials.

Branch switching clears branch-dependent browser state. Backend permissions remain authoritative. Upload URLs use the current origin. Production requires matching wildcard DNS/TLS and `TENANT_HOST_RULE` routing; only socket/device routes bypass the Next.js backend proxy.

## Verification

Start the backend with the restricted runtime database role. Verify the provisioned tenant's login, dashboard, branch selection and management, booking branch selection, and unknown-subdomain rejection. Check UI changes in a browser when one is connected. Never commit environment files. Follow the root Docker verification runbook.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
