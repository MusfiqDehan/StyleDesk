const { randomBytes, createHash } = require('node:crypto');
const bcrypt = require('bcrypt');
const { migrationDataSource: ds } = require('../dist/src/database/data-source.js');
const { Tenant } = require('../dist/src/tenancy/entities/tenant.entity.js');
const { Branch } = require('../dist/src/tenancy/entities/branch.entity.js');
const { RegisteredDevice } = require('../dist/src/tenancy/entities/device.entity.js');
const { Auth } = require('../dist/src/auth/entities/auth.entity.js');
const { BussinessInfo } = require('../dist/src/bussiness-info/entities/bussiness-info.entity.js');
const { AppointmentSetting } = require('../dist/src/appointment-setting/entities/appointment-setting.entity.js');
const { InvoiceSetting } = require('../dist/src/invoice-setting/entities/invoice-setting.entity.js');
const { RolePermission } = require('../dist/src/role-permission/entities/role-permission.entity.js');
const { DEFAULT_ROLE_PERMISSIONS, EDITABLE_ROLES } = require('../dist/src/role-permission/role-permission.defaults.js');
const { FinanceCategory } = require('../dist/src/finance/entities/finance-category.entity.js');
const { SYSTEM_FINANCE_CATEGORIES } = require('../dist/src/finance/finance-categories.js');
const args = Object.fromEntries(process.argv.slice(2).map((v, i, a) => v.startsWith('--') ? [v.slice(2),a[i+1]] : []).filter(x => x.length));
(async () => {
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required');
  if (!args.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug ?? '')) throw new Error('--name and --slug are required');
  const branchSlug = args.branch ?? 'main';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branchSlug)) throw new Error('Invalid branch slug');
  await ds.initialize();
  await ds.transaction(async m => {
    let tenant = await m.findOneBy(Tenant, { slug: args.slug });
    const fresh = !tenant;
    if (!tenant) {
      if (!args.email || !process.env.TENANT_ADMIN_PASSWORD || process.env.TENANT_ADMIN_PASSWORD.length < 12) throw new Error('New tenant requires --email and TENANT_ADMIN_PASSWORD of at least 12 characters');
      tenant = await m.save(Tenant,m.create(Tenant,{ name:args.name,slug:args.slug }));
    }
    await m.query("SELECT set_config('app.tenant_id',$1,true)",[tenant.id]);
    let branch = await m.findOneBy(Branch,{ tenantId:tenant.id,slug:branchSlug });
    if (!branch) {
      branch = await m.save(Branch,m.create(Branch,{ tenantId:tenant.id,name:args['branch-name'] ?? branchSlug,slug:branchSlug }));
      await m.query("SELECT set_config('app.branch_id',$1,true)",[branch.id]);
      await m.save(AppointmentSetting,m.create(AppointmentSetting,{tenantId:tenant.id,branchId:branch.id}));
      await m.save(InvoiceSetting,m.create(InvoiceSetting,{tenantId:tenant.id,branchId:branch.id}));
    }
    if (fresh) {
      await m.query("INSERT INTO tenant_subscription(tenant_id,package_id,package_version,status,email_verified,payment_verified) SELECT $1,id,current_version,'active',true,true FROM platform_package WHERE slug='compatibility' ON CONFLICT DO NOTHING",[tenant.id]);
      await m.save(Auth,m.create(Auth,{tenantId:tenant.id,branchId:null,useremail:args.email.trim().toLowerCase(),password:await bcrypt.hash(process.env.TENANT_ADMIN_PASSWORD,10),role:'admin'}));
      await m.save(BussinessInfo,m.create(BussinessInfo,{tenantId:tenant.id,businessName:args.name}));
      for (const role of EDITABLE_ROLES) await m.save(RolePermission,m.create(RolePermission,{tenantId:tenant.id,role,permissions:require('../dist/src/platform/features.js').migratePermissions(DEFAULT_ROLE_PERMISSIONS[role],role)}));
      const {migratePermissions}=require('../dist/src/platform/features.js');
      await m.query('SELECT platform_seed_roles($1,$2)',[tenant.id,JSON.stringify(EDITABLE_ROLES.map(role=>({name:role==='staff'?'Staff':role,permissions:migratePermissions(DEFAULT_ROLE_PERMISSIONS[role],role)})))]);
      for (const category of SYSTEM_FINANCE_CATEGORIES) await m.save(FinanceCategory,m.create(FinanceCategory,{tenantId:tenant.id,name:category.name,code:category.code,type:category.type,isSystem:true}));
    }
    if (args.device) {
      if (!/^[A-Z0-9-]{1,64}$/i.test(args.device)) throw new Error('Invalid device serial');
      const secret = process.env.DEVICE_SECRET;
      if (!secret || secret.length < 24) throw new Error('Set DEVICE_SECRET to at least 24 characters (injected by the trusted device proxy)');
      await m.save(RegisteredDevice,m.create(RegisteredDevice,{tenantId:tenant.id,branchId:branch.id,serial:args.device.toUpperCase(),secretHash:createHash('sha256').update(secret).digest('hex'),allowedIp:args['device-ip'] ?? null,host:args['device-host'] ?? null}));
    }
    console.log(JSON.stringify({tenantId:tenant.id,branchId:branch.id,slug:tenant.slug}));
  });
  await ds.destroy();
})().catch(e => { console.error(e.message); process.exit(1); });
