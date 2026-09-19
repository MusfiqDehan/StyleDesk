/** Seeds are explicit tenant/branch operations; no legacy global UUID fixtures. */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const args = process.argv.slice(2);
if (!args.includes('--tenant') || !args.includes('--branch')) throw new Error('--tenant and --branch are required');
for (const file of ['seed-services-packages.mjs', 'seed-inventory.mjs']) {
  execFileSync(process.execPath, [join(process.cwd(), 'scripts', file), ...args], { stdio: 'inherit' });
}
