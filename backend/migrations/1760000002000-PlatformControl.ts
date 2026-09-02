import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  FEATURES,
  STARTER,
  GROWTH,
  featureKeys,
  PLATFORM_RESOURCES,
  ACTIONS,
  expandLegacy,
  migratePermissions,
} from '../src/platform/features.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/role-permission/role-permission.defaults.js';
export class PlatformControl1760000002000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query(`
 CREATE TABLE platform_role (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text UNIQUE NOT NULL, permissions jsonb NOT NULL DEFAULT '[]', protected boolean NOT NULL DEFAULT false);
 CREATE TABLE platform_account (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), email text UNIQUE NOT NULL, password text NOT NULL, role_id uuid NOT NULL REFERENCES platform_role, active boolean NOT NULL DEFAULT true, token_version int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE platform_package (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), slug text UNIQUE NOT NULL, current_version int NOT NULL DEFAULT 1, published boolean NOT NULL DEFAULT false);
 CREATE TABLE platform_package_version (package_id uuid REFERENCES platform_package, version int NOT NULL, name text NOT NULL, monthly numeric(12,2) NOT NULL CHECK(monthly>=0), yearly numeric(12,2) NOT NULL CHECK(yearly>=0), currency text NOT NULL, staff_limit int NOT NULL CHECK(staff_limit>0), customer_limit int NOT NULL CHECK(customer_limit>=0), trial_days int NOT NULL DEFAULT 0 CHECK(trial_days BETWEEN 0 AND 365), features jsonb NOT NULL, demo boolean NOT NULL DEFAULT true, PRIMARY KEY(package_id,version));
 CREATE TABLE tenant_subscription (tenant_id uuid PRIMARY KEY REFERENCES tenant, package_id uuid NOT NULL, package_version int NOT NULL, interval text NOT NULL DEFAULT 'monthly' CHECK(interval IN ('monthly','yearly')), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','trial','active','past_due','expired','complimentary','cancelled')), email_verified boolean NOT NULL DEFAULT false, payment_verified boolean NOT NULL DEFAULT false, starts_at timestamptz, ends_at timestamptz, grace_until timestamptz, complimentary_until timestamptz, cancel_at_period_end boolean NOT NULL DEFAULT false, overrides jsonb NOT NULL DEFAULT '{}', staff_limit_override int CHECK(staff_limit_override>0), customer_limit_override int CHECK(customer_limit_override>=0), stripe_customer text, stripe_subscription text UNIQUE, next_package_id uuid REFERENCES platform_package, next_package_version int, next_interval text, provider_sync_revision int NOT NULL DEFAULT 0, stripe_price_sync boolean NOT NULL DEFAULT false, revision int NOT NULL DEFAULT 1, FOREIGN KEY(package_id,package_version) REFERENCES platform_package_version);
 CREATE TABLE platform_invitation (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), realm text NOT NULL CHECK(realm IN ('platform','tenant','activation','tenant-onboarding','reset')), tenant_id uuid REFERENCES tenant, email text NOT NULL, role_id uuid, branch_id uuid, token_hash text UNIQUE NOT NULL, expires_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
 CREATE INDEX invitation_seats ON platform_invitation(tenant_id,expires_at) WHERE realm='tenant' AND accepted_at IS NULL AND revoked_at IS NULL;
 CREATE TABLE platform_audit (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), actor_id uuid, tenant_id uuid REFERENCES tenant, action text NOT NULL, before_value jsonb, after_value jsonb, reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE platform_outbox (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), recipient text NOT NULL, subject text NOT NULL, body text NOT NULL, attempts int NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, last_error text);
 CREATE TABLE platform_settings (id boolean PRIMARY KEY DEFAULT true CHECK(id), value jsonb NOT NULL DEFAULT '{"trialDays":14,"graceDays":7}'); INSERT INTO platform_settings DEFAULT VALUES;
 CREATE TABLE gateway_catalog (slug text PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '', config_schema jsonb NOT NULL, enabled_for_tenants boolean NOT NULL DEFAULT false, enabled_for_platform boolean NOT NULL DEFAULT false, credentials text, sandbox boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0);
 CREATE TABLE tenant_gateway (tenant_id uuid NOT NULL REFERENCES tenant, slug text NOT NULL, credentials text, active boolean NOT NULL DEFAULT false, sandbox boolean NOT NULL DEFAULT true, PRIMARY KEY(tenant_id,slug));
 CREATE TABLE tenant_gateway_policy (tenant_id uuid NOT NULL REFERENCES tenant, slug text NOT NULL REFERENCES gateway_catalog, allowed boolean NOT NULL DEFAULT true, PRIMARY KEY(tenant_id,slug));
 CREATE TABLE payment_attempt (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tran_id text UNIQUE NOT NULL, tenant_id uuid NOT NULL REFERENCES tenant, branch_id uuid, source text NOT NULL CHECK(source IN ('subscription','invoice')), source_id uuid NOT NULL, gateway_slug text NOT NULL, amount numeric(12,2) NOT NULL CHECK(amount>0), currency text NOT NULL, status text NOT NULL DEFAULT 'init' CHECK(status IN ('init','pending','success','failed','cancelled')), credential_snapshot text NOT NULL, sandbox boolean NOT NULL, provider_id text, response jsonb NOT NULL DEFAULT '{}', validated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), next_check timestamptz NOT NULL DEFAULT now(), retry_count int NOT NULL DEFAULT 0);
 CREATE UNIQUE INDEX one_pending_payment ON payment_attempt(tenant_id,source,source_id) WHERE status IN ('init','pending');
 CREATE TABLE payment_event (gateway_slug text NOT NULL, event_id text NOT NULL, payload jsonb NOT NULL, processed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(gateway_slug,event_id));
 CREATE TABLE payment_settlement (attempt_id uuid PRIMARY KEY REFERENCES payment_attempt, tenant_id uuid NOT NULL REFERENCES tenant, source_id uuid NOT NULL, amount numeric(12,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE tenant_domain (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenant, hostname text UNIQUE NOT NULL, verification_token text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','provisioning','active','disabled','failed')), is_primary boolean NOT NULL DEFAULT false, verified_at timestamptz, last_error text, attempts int NOT NULL DEFAULT 0, next_check timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
 CREATE UNIQUE INDEX domain_primary ON tenant_domain(tenant_id) WHERE is_primary;
 CREATE TABLE tenant_custom_role (tenant_id uuid NOT NULL REFERENCES tenant, id uuid NOT NULL DEFAULT uuid_generate_v4(), name text NOT NULL, permissions jsonb NOT NULL DEFAULT '[]', branch_scope text NOT NULL DEFAULT 'home' CHECK(branch_scope IN ('home','tenant')), PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,name));
 ALTER TABLE auth ADD COLUMN active boolean NOT NULL DEFAULT true, ADD COLUMN custom_role_id uuid, ADD CONSTRAINT auth_custom_role_fk FOREIGN KEY(tenant_id,custom_role_id) REFERENCES tenant_custom_role(tenant_id,id);
 `);
    for (const t of ['tenant_gateway', 'tenant_custom_role'])
      await r.query(
        `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${t} FORCE ROW LEVEL SECURITY; CREATE POLICY tenant_scope ON ${t} USING(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)`,
      );
    for (const [slug, name, monthly, staff, customers, features, trial] of [
      ['starter', 'Starter', 1490, 5, 200, STARTER, 14],
      ['growth', 'Growth', 2990, 15, 1000, GROWTH, 0],
      ['pro', 'Pro', 5990, 50, 10000, featureKeys, 0],
      [
        'compatibility',
        'Compatibility',
        0,
        2147483647,
        2147483647,
        featureKeys,
        0,
      ],
    ] as any[]) {
      const [p] = await r.query(
        'INSERT INTO platform_package(slug,published) VALUES($1,$2) RETURNING id',
        [slug, slug !== 'compatibility'],
      );
      await r.query(
        "INSERT INTO platform_package_version(package_id,version,name,monthly,yearly,currency,staff_limit,customer_limit,trial_days,features) VALUES($1,1,$2,$3,$4,'BDT',$5,$6,$7,$8)",
        [
          p.id,
          name,
          monthly,
          monthly * 10,
          staff,
          customers,
          trial,
          JSON.stringify(features),
        ],
      );
    }
    await r.query(
      `INSERT INTO tenant_subscription(tenant_id,package_id,package_version,status,email_verified,payment_verified) SELECT t.id,p.id,1,'active',true,true FROM tenant t CROSS JOIN platform_package p WHERE p.slug='compatibility'`,
    );
    for (const [name, resources] of [
      ['Superadmin', ['*']],
      ['Operations', ['overview', 'tenants', 'domains']],
      [
        'Billing',
        ['overview', 'packages', 'subscriptions', 'payments', 'gateways'],
      ],
      ['Read-only', PLATFORM_RESOURCES],
    ] as any[])
      await r.query(
        'INSERT INTO platform_role(name,permissions,protected) VALUES($1,$2,$3)',
        [
          name,
          JSON.stringify(
            resources.includes('*')
              ? ['*']
              : resources.flatMap((s: string) =>
                  (name === 'Read-only' ? ['view'] : ACTIONS).map(
                    (a) => `${s}:${a}`,
                  ),
                ),
          ),
          name === 'Superadmin',
        ],
      );
    await r.query(
      `INSERT INTO gateway_catalog(slug,name,config_schema) VALUES ('sslcommerz','SSLCommerz','[{"key":"store_id","label":"Store ID","type":"text","required":true},{"key":"store_password","label":"Store password","type":"password","required":true}]'),('stripe','Stripe','[{"key":"publishable_key","label":"Publishable key","type":"text","required":true},{"key":"secret_key","label":"Secret key","type":"password","required":true},{"key":"webhook_secret","label":"Webhook secret","type":"password","required":true}]')`,
    );
    await r.query(
      `CREATE FUNCTION tenant_access() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT jsonb_build_object('tenantId',t.id,'slug',t.slug,'active',t.active,'status',s.status,'emailVerified',s.email_verified,'paymentVerified',s.payment_verified,'endsAt',s.ends_at,'graceUntil',s.grace_until,'complimentaryUntil',s.complimentary_until,'features',v.features,'overrides',s.overrides,'staffLimit',COALESCE(s.staff_limit_override,v.staff_limit),'customerLimit',COALESCE(s.customer_limit_override,v.customer_limit),'revision',s.revision,'package',v.name,'primaryDomain',(SELECT d.hostname FROM tenant_domain d WHERE d.tenant_id=t.id AND d.status='active' AND d.is_primary AND COALESCE((s.overrides->>'domains')::boolean,v.features ? 'domains'))) FROM tenant t JOIN tenant_subscription s ON s.tenant_id=t.id JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) WHERE t.id=NULLIF(current_setting('app.tenant_id',true),'')::uuid $$`,
    );
    await r.query(
      `CREATE FUNCTION resolve_tenant_host(h text) RETURNS TABLE(tenant_id uuid,branch_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT t.id,b.id FROM tenant t JOIN branch b ON b.tenant_id=t.id AND b.active WHERE (t.slug=h OR EXISTS(SELECT 1 FROM tenant_domain d JOIN tenant_subscription s ON s.tenant_id=d.tenant_id JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) WHERE d.tenant_id=t.id AND d.hostname=h AND d.status='active' AND COALESCE((s.overrides->>'domains')::boolean,v.features ? 'domains'))) ORDER BY b.slug LIMIT 1 $$`,
    );
    await r.query(
      `CREATE FUNCTION tenant_gateways() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT COALESCE(jsonb_agg(jsonb_build_object('slug',g.slug,'name',g.name,'description',g.description,'config_schema',g.config_schema,'allowed',g.enabled_for_tenants AND COALESCE(p.allowed,true),'active',i.active,'is_configured',i.credentials IS NOT NULL,'is_sandbox',COALESCE(i.sandbox,true)) ORDER BY g.sort_order), '[]') FROM gateway_catalog g LEFT JOIN tenant_gateway_policy p ON p.slug=g.slug AND p.tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid LEFT JOIN tenant_gateway i ON i.slug=g.slug AND i.tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid $$`,
    );
    await r.query(
      `CREATE FUNCTION platform_provision(n text,s text,e text,pw text,pid uuid,billing text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE tid uuid; bid uuid; BEGIN IF s !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(s)>63 THEN RAISE EXCEPTION 'Invalid tenant slug'; END IF; INSERT INTO tenant(name,slug) VALUES(n,s) RETURNING id INTO tid; PERFORM set_config('app.tenant_id',tid::text,true); INSERT INTO branch(tenant_id,name,slug) VALUES(tid,'Main','main') RETURNING id INTO bid; PERFORM set_config('app.branch_id',bid::text,true); INSERT INTO auth(tenant_id,useremail,password,role,branch_id) VALUES(tid,e,pw,'admin',NULL); INSERT INTO bussiness_info(tenant_id,"businessName",email) VALUES(tid,n,e); INSERT INTO appointment_setting(tenant_id,branch_id) VALUES(tid,bid); INSERT INTO invoice_setting(tenant_id,branch_id) VALUES(tid,bid); INSERT INTO tenant_subscription(tenant_id,package_id,package_version,interval) SELECT tid,id,current_version,billing FROM platform_package WHERE id=pid AND published; IF NOT FOUND THEN RAISE EXCEPTION 'Unknown package'; END IF; RETURN tid; END $$`,
    );

    await r.query(
      `CREATE FUNCTION platform_usage(tid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT jsonb_build_object('staff',(SELECT count(*) FROM auth WHERE tenant_id=tid AND active AND role::text<>'customer'),'customers',(SELECT count(*) FROM auth WHERE tenant_id=tid AND active AND role::text='customer'),'staffDisabled',(SELECT count(*) FROM auth WHERE tenant_id=tid AND NOT active AND role::text<>'customer'),'customerDisabled',(SELECT count(*) FROM auth WHERE tenant_id=tid AND NOT active AND role::text='customer'),'disabled',(SELECT count(*) FROM auth WHERE tenant_id=tid AND NOT active),'reserved',(SELECT count(*) FROM platform_invitation WHERE tenant_id=tid AND realm='tenant' AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now())) $$`,
    );
    await r.query(
      `CREATE FUNCTION platform_branches(tid uuid) RETURNS TABLE(id uuid,name text,slug text,active boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT id,name::text,slug::text,active FROM branch WHERE tenant_id=tid $$`,
    );
    await r.query(
      `CREATE FUNCTION platform_seed_tenant(tid uuid,roles jsonb,categories jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE x jsonb; BEGIN IF NOT EXISTS(SELECT 1 FROM tenant WHERE id=tid) THEN RAISE EXCEPTION 'Unknown tenant'; END IF; FOR x IN SELECT * FROM jsonb_array_elements(roles) LOOP INSERT INTO role_permission(tenant_id,role,permissions) VALUES(tid,(x->>'role')::role_permission_role_enum,x->>'permissions') ON CONFLICT DO NOTHING; END LOOP; FOR x IN SELECT * FROM jsonb_array_elements(categories) LOOP INSERT INTO finance_category(tenant_id,name,code,type,"isSystem") SELECT tid,x->>'name',x->>'code',(x->>'type')::finance_category_type_enum,true WHERE NOT EXISTS(SELECT 1 FROM finance_category WHERE tenant_id=tid AND code=x->>'code'); END LOOP; END $$`,
    );
    await r.query(
      `REVOKE ALL ON FUNCTION platform_usage(uuid),platform_branches(uuid),platform_seed_tenant(uuid,jsonb,jsonb) FROM PUBLIC`,
    );
    await r.query(
      `CREATE FUNCTION platform_accept_staff(iid uuid,pw text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE i platform_invitation; BEGIN SELECT * INTO i FROM platform_invitation WHERE id=iid AND realm='tenant' AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invitation'; END IF; UPDATE platform_invitation SET accepted_at=now() WHERE id=iid; INSERT INTO auth(tenant_id,branch_id,useremail,password,role,custom_role_id) VALUES(i.tenant_id,i.branch_id,i.email,pw,'custom',i.role_id); END $$; REVOKE ALL ON FUNCTION platform_accept_staff(uuid,text) FROM PUBLIC`,
    );

    await r.query(
      `CREATE FUNCTION platform_tenant_identity() RETURNS TABLE(id uuid,slug text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT id,slug::text FROM tenant WHERE id=NULLIF(current_setting('app.tenant_id',true),'')::uuid $$; REVOKE ALL ON FUNCTION platform_tenant_identity() FROM PUBLIC`,
    );
    for (const table of ['payment_attempt', 'payment_settlement'])
      await r.query(
        `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY; CREATE POLICY tenant_payment ON ${table} USING(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid${table === 'payment_attempt' ? " AND source='invoice'" : ''}) WITH CHECK(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid${table === 'payment_attempt' ? " AND source='invoice'" : ''})`,
      );
    await r.query(
      `CREATE FUNCTION platform_seed_roles(tid uuid,roles jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE x jsonb; BEGIN FOR x IN SELECT * FROM jsonb_array_elements(roles) LOOP INSERT INTO tenant_custom_role(tenant_id,name,permissions) VALUES(tid,x->>'name',x->'permissions') ON CONFLICT(tenant_id,name) DO NOTHING; END LOOP; END $$; REVOKE ALL ON FUNCTION platform_seed_roles(uuid,jsonb) FROM PUBLIC`,
    );
    const presets = await r.query(
      'SELECT tenant_id,role,permissions FROM role_permission',
    );
    for (const row of presets) {
      const permissions = migratePermissions(
        (row.permissions ?? '').split(',').filter(Boolean),
        row.role,
      );
      await r.query(
        'UPDATE role_permission SET permissions=$3 WHERE tenant_id=$1 AND role::text=$2',
        [row.tenant_id, row.role, permissions.join(',')],
      );
      await r.query(
        'INSERT INTO tenant_custom_role(tenant_id,name,permissions) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [
          row.tenant_id,
          row.role === 'staff' ? 'Staff' : row.role,
          JSON.stringify(permissions),
        ],
      );
    }
    for (const [name, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS))
      await r.query(
        'INSERT INTO tenant_custom_role(tenant_id,name,permissions) SELECT id,$1,$2 FROM tenant ON CONFLICT DO NOTHING',
        [
          name === 'staff' ? 'Staff' : name,
          JSON.stringify(migratePermissions(permissions, name)),
        ],
      );
    // Persisted counters are unnecessary: each creation locks the subscription then counts under privileged trigger context.
    await r.query(
      `CREATE FUNCTION enforce_account_seats() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE cap int; used int; reserved int; BEGIN IF TG_OP='DELETE' THEN IF OLD.role::text='admin' AND OLD.active THEN PERFORM 1 FROM tenant_subscription WHERE tenant_id=OLD.tenant_id FOR UPDATE; IF (SELECT count(*) FROM auth WHERE tenant_id=OLD.tenant_id AND role::text='admin' AND active)<=1 THEN RAISE EXCEPTION 'Cannot remove last tenant owner'; END IF; END IF; RETURN OLD; END IF; IF TG_OP='UPDATE' AND OLD.role::text='admin' AND OLD.active AND (NOT NEW.active OR NEW.role::text<>'admin') THEN PERFORM 1 FROM tenant_subscription WHERE tenant_id=NEW.tenant_id FOR UPDATE; IF (SELECT count(*) FROM auth WHERE tenant_id=NEW.tenant_id AND role::text='admin' AND active)<=1 THEN RAISE EXCEPTION 'Cannot demote last tenant owner'; END IF; END IF; IF NOT NEW.active OR (TG_OP='UPDATE' AND OLD.active AND (OLD.role::text='customer')=(NEW.role::text='customer')) THEN RETURN NEW; END IF; PERFORM 1 FROM tenant_subscription WHERE tenant_id=NEW.tenant_id FOR UPDATE; IF NOT FOUND THEN RETURN NEW; END IF; SELECT CASE WHEN NEW.role::text='customer' THEN COALESCE(s.customer_limit_override,v.customer_limit) ELSE COALESCE(s.staff_limit_override,v.staff_limit) END INTO cap FROM tenant_subscription s JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) WHERE s.tenant_id=NEW.tenant_id; SELECT count(*) INTO used FROM auth WHERE tenant_id=NEW.tenant_id AND active AND (role::text='customer')=(NEW.role::text='customer') AND id<>NEW.id; SELECT count(*) INTO reserved FROM platform_invitation WHERE tenant_id=NEW.tenant_id AND realm='tenant' AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now(); IF used+(CASE WHEN NEW.role::text='customer' THEN 0 ELSE reserved END)>=cap THEN RAISE EXCEPTION 'Account limit reached'; END IF; RETURN NEW; END $$; CREATE TRIGGER account_seats BEFORE INSERT OR UPDATE OR DELETE ON auth FOR EACH ROW EXECUTE FUNCTION enforce_account_seats()`,
    );

    // The runtime cannot read any control-plane tables directly.
    for (const f of [
      'tenant_access()',
      'resolve_tenant_host(text)',
      'tenant_gateways()',
      'platform_provision(text,text,text,text,uuid,text)',
    ])
      await r.query(`REVOKE ALL ON FUNCTION ${f} FROM PUBLIC`);
  }
  async down() {
    throw new Error(
      'Restore a database backup to roll back platform control tables',
    );
  }
}
