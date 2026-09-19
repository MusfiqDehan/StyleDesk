const { spawn } = require('node:child_process');
const { rmSync } = require('node:fs');
rmSync('dist', { recursive: true, force: true });
let server;
let stopping = false;
let restarting = false;
const compiler = spawn(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], { stdio: ['inherit','pipe','inherit'] });
function startServer() {
  if (stopping) return;
  server = spawn(process.execPath, [...(process.argv.includes('--debug') ? ['--inspect'] : []), 'dist/src/main.js'], { stdio:'inherit' });
  server.once('exit', () => { server = undefined; if (restarting && !stopping) { restarting = false; startServer(); } });
}
function restart() {
  if (stopping) return;
  if (restarting) return;
  if (server) { restarting = true; server.kill('SIGTERM'); }
  else startServer();
}
let output = '';
compiler.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  output += chunk.toString();
  if (/Found 0 errors\. Watching for file changes\./.test(output)) { output=''; restart(); }
  else if (output.length > 10000) output=output.slice(-10000);
});
compiler.once('exit', code => { stopping = true; server?.kill('SIGTERM'); process.exitCode=code ?? 1; });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { stopping=true; server?.kill(signal); compiler.kill(signal); });
