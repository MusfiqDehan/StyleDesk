const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
let tick, timerStarts = 0, timerStops = 0
const context = { exports: {}, setInterval: fn => { tick = fn; timerStarts++; return 1 }, clearInterval: () => timerStops++ }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/admin/lib/auth-store.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
const { createAuthStore } = context.exports
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
async function main() {
  let scope = 'account-a/branch-a', visible = true, calls = 0, events, cleanups = 0, pending
  const store = createAuthStore({ getScope: () => scope, loadUser: () => { calls++; pending = deferred(); return pending.promise }, isVisible: () => visible, listen: refresh => { events = refresh; return () => cleanups++ } })
  const unsubscribe = Array.from({ length: 4 }, () => store.subscribe(() => {}))
  assert.equal(calls, 1)
  assert.equal(timerStarts, 1)
  const first = store.refresh()
  pending.resolve({ id: 'a', permissions: ['clients:view'] })
  await first
  const stable = store.getSnapshot()
  const second = store.refresh()
  pending.resolve({ id: 'a', permissions: ['clients:view'] })
  await second
  assert.equal(store.getSnapshot(), stable, 'unchanged bootstrap must preserve snapshot and user identity')
  const update = store.refresh()
  pending.resolve({ id: 'a', permissions: [] })
  await update
  assert.notEqual(store.getSnapshot(), stable, 'permission changes must publish immediately')
  const stale = store.refresh(), oldRequest = pending
  scope = 'account-b/branch-b'
  const newRequest = store.refresh()
  assert.equal(store.getSnapshot().user, null, 'clear previous account while the new scope loads')
  pending.resolve({ id: 'b', permissions: [] })
  await newRequest
  oldRequest.resolve({ id: 'a', permissions: ['*'] })
  await stale
  assert.equal(store.getSnapshot().user.id, 'b', 'stale responses cannot restore a previous account')
  visible = false
  const before = calls
  tick()
  assert.equal(calls, before, 'hidden tabs must not poll')
  visible = true
  events()
  const failed = store.refresh()
  pending.reject(new Error('Access revoked'))
  await failed
  assert.equal(store.getSnapshot().user, null, 'failed authorization must clear protected user state')
  scope = null
  await store.refresh()
  assert.equal(store.getSnapshot().loading, false)
  unsubscribe.forEach(stop => stop())
  assert.equal(timerStops, 1)
  assert.equal(cleanups, 1)
  console.log('PASS: shared polling, stable identity, permission refresh, account isolation, hidden tabs, failure and cleanup')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
