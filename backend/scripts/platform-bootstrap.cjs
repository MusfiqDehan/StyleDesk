require('dotenv').config();
const bcrypt = require('bcrypt');
const {
  migrationDataSource: db,
} = require('../dist/src/database/data-source.js');
(async () => {
  if (!process.env.MIGRATION_DATABASE_URL)
    throw new Error('MIGRATION_DATABASE_URL required');
  const demo = process.argv.includes('--demo');
  const allowProdDemo =
    process.env.ALLOW_PROD_DEMO === 'true' ||
    process.argv.includes('--force-prod');
  if (demo && process.env.NODE_ENV === 'production' && !allowProdDemo)
    throw new Error('Demo seed is development/test only (pass --force-prod to override)');
  const email = demo
    ? 'superadmin@styledesk.test'
    : process.env.PLATFORM_ADMIN_EMAIL;
  const password = demo
    ? 'StyleDeskDemo!2026'
    : process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error(
      'Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD (12+ characters)',
    );
  await db.initialize();
  await db.transaction(async (m) => {
    const [role] = await m.query(
      'SELECT id FROM platform_role WHERE protected',
    );
    const superadminPw = await bcrypt.hash(password, 12);
    await m.query(
      'INSERT INTO platform_account(email,password,role_id) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET password=EXCLUDED.password, role_id=EXCLUDED.role_id',
      [email, superadminPw, role.id],
    );
    if (demo) {
      const {
        featureKeys,
        migratePermissions,
      } = require('../dist/src/platform/features.js');
      const {
        DEFAULT_ROLE_PERMISSIONS,
      } = require('../dist/src/role-permission/role-permission.defaults.js');
      const {
        SYSTEM_FINANCE_CATEGORIES,
      } = require('../dist/src/finance/finance-categories.js');
      const demoPw = await bcrypt.hash('StyleDeskDemo!2026', 12);

      for (const slug of ['client1', 'client2']) {
        let [t] = await m.query('SELECT id FROM tenant WHERE slug=$1', [slug]);
        const tenantName = slug === 'client1' ? 'Aurora Luxury Salon' : 'Demo ' + slug;
        if (!t) {
          const [p] = await m.query(
            "SELECT id FROM platform_package WHERE slug='pro'",
          );
          [t] = await m.query(
            'SELECT platform_provision($1,$2,$3,$4,$5,$6) AS id',
            [
              tenantName,
              slug,
              'admin@' + slug + '.test',
              demoPw,
              p.id,
              'monthly',
            ],
          );
        } else {
          await m.query('UPDATE tenant SET name=$1 WHERE id=$2', [tenantName, t.id]);
        }
        await m.query(
          "UPDATE tenant_subscription SET email_verified=true,payment_verified=true,status='complimentary',complimentary_until=now()+interval '30 days' WHERE tenant_id=$1",
          [t.id],
        );
        await m.query('SELECT platform_seed_tenant($1,$2,$3)', [
          t.id,
          JSON.stringify(
            Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, p]) => ({
              role,
              permissions: migratePermissions(p, role).join(','),
            })),
          ),
          JSON.stringify(SYSTEM_FINANCE_CATEGORIES),
        ]);
        for (const [name, p] of Object.entries(DEFAULT_ROLE_PERMISSIONS))
          await m.query(
            "INSERT INTO tenant_custom_role(tenant_id,name,permissions,branch_scope) VALUES($1,$2,$3,'home') ON CONFLICT(tenant_id,name) DO NOTHING",
            [
              t.id,
              name === 'staff' ? 'Staff' : name,
              JSON.stringify(migratePermissions(p, name)),
            ],
          );

        const [branch] = await m.query(
          'SELECT id FROM branch WHERE tenant_id=$1 AND active ORDER BY slug LIMIT 1',
          [t.id],
        );
        const branchId = branch?.id || null;

        // Seed RBAC demo accounts for tenant
        const accounts = [
          {
            email: 'admin@' + slug + '.test',
            role: 'admin',
            name: 'Alexander Stone (Admin)',
            phone: slug === 'client1' ? '01711000000' : '01722000000',
            type: 'client',
          },
          {
            email: 'manager@' + slug + '.test',
            role: 'storeManager',
            name: 'Elena Vance (Manager)',
            phone: slug === 'client1' ? '01711000001' : '01722000001',
            type: 'employee',
            empRole: 'Manager',
          },
          {
            email: 'staff@' + slug + '.test',
            role: 'staff',
            name: 'Sarah Jenkins (Staff)',
            phone: slug === 'client1' ? '01711000002' : '01722000002',
            type: 'employee',
            empRole: 'Receptionist',
          },
          {
            email: 'stylist@' + slug + '.test',
            role: 'stylist',
            name: 'Aria Montgomery (Stylist)',
            phone: slug === 'client1' ? '01711000003' : '01722000003',
            type: 'employee',
            empRole: 'Stylist',
          },
          {
            email: 'customer@' + slug + '.test',
            role: 'customer',
            name: 'Sophia Taylor (Customer)',
            phone: slug === 'client1' ? '01711000004' : '01722000004',
            type: 'client',
          },
        ];

        for (const acc of accounts) {
          let empId = null;
          let clientId = null;

          if (acc.type === 'employee') {
            let [emp] = await m.query(
              'SELECT id FROM employee WHERE tenant_id=$1 AND phone=$2',
              [t.id, acc.phone],
            );
            if (!emp) {
              [emp] = await m.query(
                `INSERT INTO employee(tenant_id,branch_id,name,role,phone,email,salary,shift,experience,"joinDate",status,"employmentType","createdAt","updatedAt")
                 VALUES($1,$2,$3,$4,$5,$6,35000,'Morning',3,CURRENT_DATE,'ACTIVE','FULL_TIME',NOW(),NOW()) RETURNING id`,
                [t.id, branchId, acc.name, acc.empRole, acc.phone, acc.email],
              );
            }
            empId = emp.id;
          } else {
            let [cli] = await m.query(
              'SELECT id FROM client WHERE tenant_id=$1 AND phone=$2',
              [t.id, acc.phone],
            );
            if (!cli) {
              [cli] = await m.query(
                `INSERT INTO client(tenant_id,name,phone,email,"createdAt","updatedAt")
                 VALUES($1,$2,$3,$4,NOW(),NOW()) RETURNING id`,
                [t.id, acc.name, acc.phone, acc.email],
              );
            }
            clientId = cli.id;
          }

          let [existingAuth] = await m.query(
            'SELECT id FROM auth WHERE tenant_id=$1 AND useremail=$2',
            [t.id, acc.email],
          );

          if (existingAuth) {
            await m.query(
              `UPDATE auth SET password=$1, role=$2, branch_id=$3, "employeeId"=$4, "clientId"=$5, active=true, "updatedAt"=NOW() WHERE id=$6`,
              [demoPw, acc.role, branchId, empId, clientId, existingAuth.id],
            );
          } else {
            await m.query(
              `INSERT INTO auth(tenant_id,branch_id,useremail,password,role,"employeeId","clientId",active,"createdAt","updatedAt")
               VALUES($1,$2,$3,$4,$5,$6,$7,true,NOW(),NOW())`,
              [t.id, branchId, acc.email, demoPw, acc.role, empId, clientId],
            );
          }
        }
      }
    }
  });
  await db.destroy();
  console.log(
    demo
      ? 'Demo ready:\n  Platform Superadmin: superadmin@styledesk.test\n  Tenant client1 (Aurora Luxury Salon):\n    - Admin: admin@client1.test\n    - Store Manager: manager@client1.test\n    - Staff: staff@client1.test\n    - Stylist: stylist@client1.test\n    - Customer: customer@client1.test\n  Default password: StyleDeskDemo!2026'
      : 'Platform superadmin bootstrapped without changing existing credentials',
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
