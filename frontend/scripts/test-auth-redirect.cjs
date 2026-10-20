const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const context = { exports: {}, URLSearchParams, require: name => dependencies[name] };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return context.exports;
}
const authUtils = load('app/admin/lib/auth-utils.ts');
const { postLoginPath, safeNextPath, permittedLoginPath, loginPathFor } = load('lib/auth-redirect.ts', {'@/app/admin/lib/auth-utils':authUtils});
assert.equal(postLoginPath('customer'),'/customer-dashboard');
assert.equal(postLoginPath('customer','/pay-invoice'),'/pay-invoice');
assert.equal(postLoginPath('customer','/admin'),'/customer-dashboard');
assert.equal(postLoginPath('staff','/pay-invoice'),'/admin/staff');
assert.equal(postLoginPath('admin','/admin/settings/domains'),'/admin/settings/domains');
for(const target of ['//evil.example','/\\evil.example','https://evil.example','/login?next=/','/reset-password']) assert.equal(safeNextPath(target),null);
console.log('PASS: customer account recovery destination, role-specific redirects and open-redirect prevention');

const catalog = [{key:'dashboard',path:'/admin'},{key:'staff-dashboard',path:'/admin/staff'},{key:'pos',path:'/admin/pos'},{key:'clients',path:'/admin/clients'}];
const custom = {role:'custom',operational:true,permissions:['pos:view'],features:['dashboard','pos','clients'],catalog};
assert.equal(permittedLoginPath(custom),'/admin/pos');
assert.equal(permittedLoginPath(custom,'/admin/clients'),'/admin/pos');
assert.equal(permittedLoginPath({...custom,permissions:['clients:view']},'/admin/clients/123'),'/admin/clients/123');
assert.equal(permittedLoginPath({...custom,features:[]}),'/admin/update-password');
assert.equal(permittedLoginPath({...custom,role:'staff',permissions:['staff-dashboard:view','pos:view'],features:['staff-dashboard','pos']}),'/admin/staff');
assert.equal(permittedLoginPath({...custom,role:'customer'},'/admin/pos'),'/customer-dashboard');
assert.equal(authUtils.canAccessPath({...custom,role:'customer'},'/admin/update-password'),false);
assert.equal(permittedLoginPath({...custom,role:'admin',operational:false}),'/billing');
assert.equal(loginPathFor('/admin/clients',true),'/login?next=%2Fadmin%2Fclients');
assert.equal(loginPathFor(null,true),'/login');
console.log('PASS: live permission landing pages, denied next paths, entitlement fallback, customer isolation and normal login URLs');
