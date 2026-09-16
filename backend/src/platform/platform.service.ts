import { cursorRequest } from '../common/pagination/cursor.js';
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PlatformDb } from './platform-db.js';
import { hashToken } from './crypto.js';
import {
  FEATURES,
  featureKeys,
  ACTIONS,
  PLATFORM_RESOURCES,
  DEPENDENCIES,
  effectiveFeatures,
  migratePermissions,
} from './features.js';
import {
  email,
  password,
  required,
  uuid,
  integer,
  list,
} from './validation.js';
import type { EntityManager } from 'typeorm';
export const platformOrigin = () =>
  process.env.PLATFORM_PUBLIC_URL ??
  `https://${process.env.PLATFORM_HOST ?? 'styledesk.musfiqdehan.com'}`;
export const tenantOrigin = (slug: string) =>
  `${process.env.PUBLIC_URL_SCHEME ?? 'https'}://${slug}.${process.env.TENANT_BASE_DOMAIN ?? 'styledesk.musfiqdehan.com'}${process.env.PUBLIC_URL_PORT ? `:${process.env.PUBLIC_URL_PORT}` : ''}`;
@Injectable()
export class PlatformService {
  constructor(
    readonly db: PlatformDb,
    private jwt: JwtService,
  ) {}
  async audit(
    m: EntityManager,
    actor: string | null,
    tenant: string | null,
    action: string,
    before: any,
    after: any,
    reason = '',
  ) {
    await m.query(
      'INSERT INTO platform_audit(actor_id,tenant_id,action,before_value,after_value,reason) VALUES($1,$2,$3,$4,$5,$6)',
      [
        actor,
        tenant,
        action,
        JSON.stringify(before),
        JSON.stringify(after),
        reason,
      ],
    );
  }
  async link(
    m: EntityManager,
    realm: string,
    to: string,
    tenant: string | null,
    role: string | null = null,
    branch: string | null = null,
    payload: any = {},
  ) {
    const token = randomBytes(32).toString('hex');
    const [i] = await m.query(
      "INSERT INTO platform_invitation(realm,email,tenant_id,role_id,branch_id,token_hash,expires_at,payload) VALUES($1,$2,$3,$4,$5,$6,now()+interval '48 hours',$7) RETURNING id",
      [
        realm,
        to,
        tenant,
        role,
        branch,
        hashToken(token),
        JSON.stringify(payload),
      ],
    );
    const slug = tenant
      ? (await m.query('SELECT slug FROM tenant WHERE id=$1', [tenant]))[0]
          ?.slug
      : null;
    const origin = realm === 'tenant' ? tenantOrigin(slug) : platformOrigin();
    const url = `${origin}/accept-invitation?token=${token}&kind=${realm}`;
    await m.query(
      'INSERT INTO platform_outbox(recipient,subject,body) VALUES($1,$2,$3)',
      [
        to,
        realm === 'activation'
          ? 'Activate your StyleDesk business'
          : 'Your StyleDesk invitation',
        `Open this single-use link within 48 hours: ${url}`,
      ],
    );
    return i;
  }
  async login(body: any) {
    const [u] = await this.db.query(
      'SELECT a.*,r.name AS role,r.permissions FROM platform_account a JOIN platform_role r ON r.id=a.role_id WHERE a.email=$1',
      [email(body.email)],
    );
    if (
      !u?.active ||
      !(await bcrypt.compare(
        required(body.password, 'password', 128),
        u.password,
      ))
    )
      throw new UnauthorizedException('Invalid email or password');
    return {
      user: {
        id: u.id,
        email: u.email,
        role: u.role,
        permissions: u.permissions,
      },
      token: this.jwt.sign(
        { id: u.id, version: u.token_version },
        {
          secret: process.env.PLATFORM_JWT_SECRET,
          audience: 'styledesk-platform',
          expiresIn: '1d',
        },
      ),
    };
  }
  async packages(published = false) {
    return this.db.query(
      `SELECT p.id,p.slug,p.published,v.* FROM platform_package p JOIN platform_package_version v ON(v.package_id,v.version)=(p.id,p.current_version) ${published ? 'WHERE p.published' : ''} ORDER BY v.monthly`,
    );
  }
  async onboard(body: any) {
    const slug = required(body.slug, 'slug', 63).toLowerCase();
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      ['www', 'admin', 'api', 'mail', 'platform'].includes(slug)
    )
      throw new BadRequestException('Invalid or reserved subdomain');
    const e = email(body.email),
      pw = await bcrypt.hash(password(body.password), 12);
    const interval = body.interval === 'yearly' ? 'yearly' : 'monthly';
    return this.db.transaction(async (m) => {
      const [result] = await m.query(
        'SELECT platform_provision($1,$2,$3,$4,$5,$6) AS id',
        [
          required(body.name, 'business name'),
          slug,
          e,
          pw,
          uuid(body.package_id),
          interval,
        ],
      );
      await this.seedRoles(m, result.id);
      const invite = await this.link(m, 'activation', e, result.id);
      await this.audit(m, null, result.id, 'tenant.onboard', null, {
        slug,
        packageId: body.package_id,
      });
      return {
        tenant_id: result.id,
        activation_id: invite.id,
        message: 'Check your email to activate your business',
      };
    });
  }
  async seedRoles(m: EntityManager, tenant: string) {
    const { DEFAULT_ROLE_PERMISSIONS } =
      await import('../role-permission/role-permission.defaults.js');
    const { SYSTEM_FINANCE_CATEGORIES } =
      await import('../finance/finance-categories.js');
    await m.query('SELECT platform_seed_tenant($1,$2,$3)', [
      tenant,
      JSON.stringify(
        Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, p]) => ({
          role,
          permissions: migratePermissions(p, role).join(','),
        })),
      ),
      JSON.stringify(SYSTEM_FINANCE_CATEGORIES),
    ]);
    await m.query('SELECT platform_seed_roles($1,$2)', [
      tenant,
      JSON.stringify(
        Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([name, p]) => ({
          name: name === 'staff' ? 'Staff' : name,
          permissions: (
            require('./features.js') as typeof import('./features.js')
          ).migratePermissions(p, name),
        })),
      ),
    ]);
  }
  async activate(token: string) {
    return this.db.transaction(async (m) => {
      const [i] = await m.query(
        "SELECT * FROM platform_invitation WHERE token_hash=$1 AND realm='activation' AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE",
        [hashToken(required(token, 'token', 128))],
      );
      if (!i)
        throw new BadRequestException('Invalid or expired activation link');
      await m.query(
        'UPDATE platform_invitation SET accepted_at=now() WHERE id=$1',
        [i.id],
      );
      await m.query(
        'UPDATE tenant_subscription SET email_verified=true,revision=revision+1 WHERE tenant_id=$1',
        [i.tenant_id],
      );
      await this.activateSubscription(m, i.tenant_id);
      return {
        message: 'Email verified',
        login_url:
          tenantOrigin(
            (
              await m.query('SELECT slug FROM tenant WHERE id=$1', [
                i.tenant_id,
              ])
            )[0].slug,
          ) + '/login',
      };
    });
  }
  async activateSubscription(m: EntityManager, tenant: string) {
    const [s] = await m.query(
      'SELECT s.*,v.trial_days FROM tenant_subscription s JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) WHERE tenant_id=$1 FOR UPDATE OF s',
      [tenant],
    );
    if (!s.email_verified) return;
    if (s.status !== 'pending') return;
    if (s.payment_verified)
      await m.query(
        "UPDATE tenant_subscription SET status='active',starts_at=now(),ends_at=COALESCE(ends_at,now()+CASE WHEN interval='yearly' THEN interval '1 year' ELSE interval '1 month' END),revision=revision+1 WHERE tenant_id=$1",
        [tenant],
      );
    else if (s.trial_days > 0)
      await m.query(
        "UPDATE tenant_subscription SET status='trial',starts_at=now(),ends_at=now()+make_interval(days=>$2),revision=revision+1 WHERE tenant_id=$1",
        [tenant, s.trial_days],
      );
  }
  async tenants(search = '') {
    const tenants = await this.db.query(
      `SELECT t.*,s.status,s.interval,s.ends_at,s.grace_until,s.revision,v.name AS package,v.staff_limit,v.customer_limit,s.staff_limit_override,s.customer_limit_override,platform_usage(t.id) AS usage FROM tenant t JOIN tenant_subscription s ON s.tenant_id=t.id JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) WHERE t.name ILIKE $1 OR t.slug ILIKE $1 ORDER BY t."createdAt" DESC ${cursorRequest() ? '' : 'LIMIT 200'}`,
      [`%${search.slice(0, 100)}%`],
    );
    if (!cursorRequest()) return tenants;
    const invitations = await this.db.query(
      `SELECT i.id, i.email AS name, i.email, 'invitation' AS record_type, 'invited' AS status,
       false AS active, i.created_at AS "createdAt", i.expires_at,
       CASE WHEN i.expires_at > now() THEN 'pending' ELSE 'expired' END AS invitation_status,
       v.name AS package FROM platform_invitation i
       LEFT JOIN platform_package p ON p.id::text=i.payload->>'package_id'
       LEFT JOIN platform_package_version v ON v.package_id=p.id AND v.version=p.current_version
       WHERE i.realm='tenant-onboarding' AND i.accepted_at IS NULL AND i.revoked_at IS NULL
       ORDER BY i.created_at DESC`,
    );
    return [...tenants.map(row => ({ ...row, record_type: 'tenant' })), ...invitations];
  }

  async detail(id: string) {
    uuid(id);
    const [t] = await this.db.query(
      'SELECT t.*,row_to_json(s) AS subscription,row_to_json(v) AS terms,platform_usage(t.id) AS usage FROM tenant t JOIN tenant_subscription s ON s.tenant_id=t.id JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) WHERE t.id=$1',
      [id],
    );
    if (!t) throw new NotFoundException();
    return {
      ...t,
      invitations: await this.db.query(
        'SELECT id,realm,email,expires_at,accepted_at,revoked_at FROM platform_invitation WHERE tenant_id=$1 ORDER BY created_at DESC',
        [id],
      ),
      domains: await this.db.query(
        'SELECT * FROM tenant_domain WHERE tenant_id=$1',
        [id],
      ),
      branches: await this.db.query('SELECT * FROM platform_branches($1)', [
        id,
      ]),
      audit: await this.db.query(
        'SELECT * FROM platform_audit WHERE tenant_id=$1 ORDER BY created_at DESC' + (cursorRequest() ? '' : ' LIMIT 100'),
        [id],
      ),
    };
  }
  async updateTenant(id: string, b: any, actor: string) {
    uuid(id);
    const reason = required(b.reason, 'reason', 1000);
    return this.db.transaction(async (m) => {
      const [old] = await m.query(
        'SELECT * FROM tenant WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!old) throw new NotFoundException();
      if (b.name !== undefined)
        await m.query('UPDATE tenant SET name=$2 WHERE id=$1', [
          id,
          required(b.name, 'name'),
        ]);
      if (b.active !== undefined) {
        if (typeof b.active !== 'boolean')
          throw new BadRequestException('active must be boolean');
        await m.query('UPDATE tenant SET active=$2 WHERE id=$1', [
          id,
          b.active,
        ]);
      }
      const [s] = await m.query(
        'SELECT * FROM tenant_subscription WHERE tenant_id=$1 FOR UPDATE',
        [id],
      );
      const overrides = { ...s.overrides };
      if (b.overrides) {
        for (const [k, v] of Object.entries(b.overrides)) {
          if (
            !featureKeys.includes(k) ||
            (v !== null && typeof v !== 'boolean')
          )
            throw new BadRequestException('Unknown feature override');
          if (v === null) delete overrides[k];
          else overrides[k] = v;
        }
        for (const [k, v] of Object.entries(overrides))
          if (
            v === true &&
            (DEPENDENCIES[k] ?? []).some((d) => overrides[d] === false)
          )
            throw new BadRequestException(`Contradictory dependency for ${k}`);
      }
      const [version] = await m.query(
        'SELECT features FROM platform_package_version WHERE package_id=$1 AND version=$2',
        [
          b.package_id ?? s.package_id,
          b.package_id
            ? (
                await m.query(
                  'SELECT current_version FROM platform_package WHERE id=$1',
                  [uuid(b.package_id)],
                )
              )[0]?.current_version
            : s.package_version,
        ],
      );
      if (!version) throw new BadRequestException('Unknown package');
      const finalFeatures = effectiveFeatures(version.features, overrides);
      for (const [k, v] of Object.entries(overrides))
        if (v === true && !finalFeatures.includes(k))
          throw new BadRequestException(`Missing dependency for ${k}`);
      const staff =
        b.staff_limit === null
          ? null
          : b.staff_limit === undefined
            ? s.staff_limit_override
            : integer(b.staff_limit, 1);
      const customer =
        b.customer_limit === null
          ? null
          : b.customer_limit === undefined
            ? s.customer_limit_override
            : integer(b.customer_limit);
      await m.query(
        'UPDATE tenant_subscription SET overrides=$2,staff_limit_override=$3,customer_limit_override=$4,revision=revision+1 WHERE tenant_id=$1',
        [id, JSON.stringify(overrides), staff, customer],
      );
      if (b.package_id && b.package_id !== s.package_id)
        await m.query(
          'UPDATE tenant_subscription SET package_id=p.id,package_version=p.current_version,stripe_price_sync=(stripe_subscription IS NOT NULL),next_package_id=NULL,next_package_version=NULL,next_interval=NULL FROM platform_package p WHERE tenant_id=$1 AND p.id=$2',
          [id, uuid(b.package_id)],
        );
      if (b.complimentary_until) {
        const date = new Date(b.complimentary_until);
        if (!Number.isFinite(date.getTime()) || date <= new Date())
          throw new BadRequestException(
            'Complimentary expiry must be in the future',
          );
        await m.query(
          "UPDATE tenant_subscription SET status='complimentary',complimentary_until=$2,email_verified=true WHERE tenant_id=$1",
          [id, date],
        );
      }
      await this.audit(
        m,
        actor,
        id,
        'tenant.update',
        { tenant: old, subscription: s },
        b,
        reason,
      );
      return { message: 'Tenant updated' };
    });
  }
  async savePackage(id: string | null, b: any, actor: string) {
    const features = list(b.features, featureKeys);
    for (const k of features)
      if ((DEPENDENCIES[k] ?? []).some((d) => !features.includes(d)))
        throw new BadRequestException(`Missing dependency for ${k}`);
    const name = required(b.name, 'name');
    const monthly = Number(b.monthly),
      yearly = Number(b.yearly);
    if (
      !Number.isFinite(monthly) ||
      !Number.isFinite(yearly) ||
      monthly < 0 ||
      yearly < 0
    )
      throw new BadRequestException('Invalid prices');
    if(b.published===true&&(monthly<=0||yearly<=0))throw new BadRequestException('Published package prices must be positive');
    const currency = required(b.currency, 'currency', 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency))
      throw new BadRequestException('Invalid currency');
    return this.db.transaction(async (m) => {
      let p: any;
      if (id)
        [p] = await m.query(
          'SELECT * FROM platform_package WHERE id=$1 FOR UPDATE',
          [uuid(id)],
        );
      else
        [p] = await m.query(
          'INSERT INTO platform_package(slug) VALUES($1) RETURNING *',
          [required(b.slug, 'slug', 63)],
        );
      if (!p) throw new NotFoundException();
      const version = id ? p.current_version + 1 : 1;
      await m.query(
        'INSERT INTO platform_package_version(package_id,version,name,monthly,yearly,currency,staff_limit,customer_limit,trial_days,features,demo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [
          p.id,
          version,
          name,
          monthly,
          yearly,
          currency,
          integer(b.staff_limit, 1),
          integer(b.customer_limit),
          integer(b.trial_days ?? 0, 0, 365),
          JSON.stringify(features),
          b.demo !== false,
        ],
      );
      await m.query(
        'UPDATE platform_package SET current_version=$2,published=$3 WHERE id=$1',
        [p.id, version, b.published === true],
      );
      await this.audit(m, actor, null, 'package.version', p, { ...b, version });
      return { id: p.id, version };
    });
  }
  async stats() {
    const [counts] = await this.db.query(
      `SELECT count(*)::int AS total,count(*) FILTER(WHERE t.active)::int AS active,count(*) FILTER(WHERE NOT t.active)::int AS suspended,count(*) FILTER(WHERE s.status='trial')::int AS trials,count(*) FILTER(WHERE s.status='trial' AND s.ends_at<now()+interval '7 days')::int AS expiring_trials,count(*) FILTER(WHERE s.status='past_due')::int AS overdue FROM tenant t JOIN tenant_subscription s ON s.tenant_id=t.id`,
    );
    return {
      counts,
      signup_trends: await this.db.query(
        `SELECT date_trunc('month',"createdAt") AS month,count(*)::int AS tenants FROM tenant GROUP BY 1 ORDER BY 1`,
      ),
      distribution: await this.db.query(
        'SELECT v.name,count(*)::int AS tenants FROM tenant_subscription s JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) GROUP BY v.name',
      ),
      revenue: await this.db.query(
        "SELECT currency,sum(amount) AS collected,count(*)::int AS payments FROM payment_attempt WHERE source='subscription' AND status='success' GROUP BY currency",
      ),
      revenue_trends: await this.db.query(
        "SELECT date_trunc('month',created_at) AS month,currency,sum(amount) AS collected,count(*)::int AS payments FROM payment_attempt WHERE source='subscription' AND status='success' GROUP BY 1,currency ORDER BY 1",
      ),
      mrr: await this.db.query(
        "SELECT v.currency,sum(CASE WHEN s.interval='yearly' THEN v.yearly/12 ELSE v.monthly END) AS amount FROM tenant_subscription s JOIN tenant t ON t.id=s.tenant_id JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) WHERE t.active AND s.status='active' AND s.payment_verified AND (s.ends_at IS NULL OR s.ends_at>now()) GROUP BY v.currency",
      ),
      failures: await this.db.query(
        "SELECT (SELECT count(*) FROM payment_attempt WHERE source='subscription' AND status='failed')::int AS payments,(SELECT count(*) FROM tenant_domain WHERE status='failed')::int AS domains",
      ),
    };
  }
  async invite(b: any, actor: string) {
    const realm =
      b.realm === 'tenant-onboarding' ? 'tenant-onboarding' : 'platform';
    const role = realm === 'platform' ? uuid(b.role_id) : null;
    return this.db.transaction(async (m) => {
      if (role) {
        const [r] = await m.query(
          'SELECT protected FROM platform_role WHERE id=$1',
          [role],
        );
        if (!r) throw new BadRequestException('Unknown role');
        const [actorRole] = await m.query(
          'SELECT r.permissions,r.protected FROM platform_account a JOIN platform_role r ON r.id=a.role_id WHERE a.id=$1',
          [actor],
        );
        const [targetRole] = await m.query(
          'SELECT permissions FROM platform_role WHERE id=$1',
          [role],
        );
        if (
          !actorRole?.protected &&
          targetRole.permissions.some(
            (p: string) => !actorRole?.permissions.includes(p),
          )
        )
          throw new ForbiddenException(
            'Cannot grant a role beyond your permissions',
          );
      }
      const result = await this.link(
        m,
        realm,
        email(b.email),
        null,
        role,
        null,
        realm === 'tenant-onboarding' ? { package_id: uuid(b.package_id) } : {},
      );
      await this.audit(m, actor, null, 'invite.create', null, {
        ...b,
        email: email(b.email),
      });
      return result;
    });
  }
  async accept(b: any) {
    return this.db.transaction(async (m) => {
      const [i] = await m.query(
        'SELECT * FROM platform_invitation WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE',
        [hashToken(required(b.token, 'token', 128))],
      );
      if (!i || !['platform', 'tenant-onboarding'].includes(i.realm))
        throw new BadRequestException('Invalid platform invitation');
      if (i.realm === 'tenant-onboarding') {
        const slug = required(b.slug, 'slug', 63);
        const [t] = await m.query(
          'SELECT platform_provision($1,$2,$3,$4,$5,$6) AS id',
          [
            required(b.name, 'business name'),
            slug,
            i.email,
            await bcrypt.hash(password(b.password), 12),
            i.payload.package_id,
            b.interval === 'yearly' ? 'yearly' : 'monthly',
          ],
        );
        await this.seedRoles(m, t.id);
        await this.link(m, 'activation', i.email, t.id);
        await m.query(
          'UPDATE platform_invitation SET accepted_at=now() WHERE id=$1',
          [i.id],
        );
        return {
          message: 'Verify your email to activate your business',
          tenant_id: t.id,
        };
      }
      await m.query(
        'INSERT INTO platform_account(email,password,role_id) VALUES($1,$2,$3)',
        [i.email, await bcrypt.hash(password(b.password), 12), i.role_id],
      );
      await m.query(
        'UPDATE platform_invitation SET accepted_at=now() WHERE id=$1',
        [i.id],
      );
      return { message: 'Account ready. Sign in.' };
    });
  }
  async roles() {
    return this.db.query(
      'SELECT * FROM platform_role ORDER BY protected DESC,name',
    );
  }
  async saveRole(id: string | null, b: any, actor: string) {
    const allowed = PLATFORM_RESOURCES.flatMap((r) =>
      ACTIONS.map((a) => `${r}:${a}`),
    );
    const permissions = list(b.permissions, allowed);
    return this.db.transaction(async (m) => {
      const [grantor] = await m.query(
        'SELECT r.permissions,r.protected FROM platform_account a JOIN platform_role r ON r.id=a.role_id WHERE a.id=$1',
        [actor],
      );
      if (
        !grantor?.protected &&
        permissions.some((p) => !grantor?.permissions.includes(p))
      )
        throw new ForbiddenException(
          'Cannot grant permissions you do not hold',
        );
      let old: any = null;
      if (id) {
        [old] = await m.query(
          'SELECT * FROM platform_role WHERE id=$1 FOR UPDATE',
          [uuid(id)],
        );
        if (!old) throw new NotFoundException();
        if (old.protected)
          throw new ForbiddenException('Protected superadmin role');
        await m.query(
          'UPDATE platform_role SET name=$2,permissions=$3 WHERE id=$1',
          [id, required(b.name, 'name'), JSON.stringify(permissions)],
        );
      } else {
        const [r] = await m.query(
          'INSERT INTO platform_role(name,permissions) VALUES($1,$2) RETURNING id',
          [required(b.name, 'name'), JSON.stringify(permissions)],
        );
        id = r.id;
      }
      await this.audit(m, actor, null, 'role.save', old, b);
      return { id };
    });
  }
  async users() {
    return this.db.query(
      'SELECT a.id,a.email,a.active,a.role_id,a.created_at,r.name AS role FROM platform_account a JOIN platform_role r ON r.id=a.role_id ORDER BY a.created_at DESC',
    );
  }
  async updateUser(id: string, b: any, actor: string) {
    return this.db.transaction(async (m) => {
      await m.query('SELECT id FROM platform_account ORDER BY id FOR UPDATE');
      const [u] = await m.query(
        'SELECT a.*,r.protected FROM platform_account a JOIN platform_role r ON r.id=a.role_id WHERE a.id=$1',
        [uuid(id)],
      );
      if (!u) throw new NotFoundException();
      if (u.protected) {
        const [c] = await m.query(
          'SELECT count(*)::int AS n FROM platform_account a JOIN platform_role r ON r.id=a.role_id WHERE a.active AND r.protected',
        );
        if (
          c.n <= 1 &&
          (b.active === false || (b.role_id && b.role_id !== u.role_id))
        )
          throw new ForbiddenException('Cannot remove last superadmin');
      }
      if (b.role_id) {
        const [target] = await m.query(
          'SELECT permissions,protected FROM platform_role WHERE id=$1',
          [uuid(b.role_id)],
        );
        const [grantor] = await m.query(
          'SELECT r.permissions,r.protected FROM platform_account a JOIN platform_role r ON r.id=a.role_id WHERE a.id=$1',
          [actor],
        );
        if (
          !target ||
          (!grantor?.protected &&
            (target.protected ||
              target.permissions.some(
                (p: string) => !grantor?.permissions.includes(p),
              )))
        )
          throw new ForbiddenException('Cannot grant elevated role');
      }
      if (b.active !== undefined && typeof b.active !== 'boolean')
        throw new BadRequestException('Invalid active state');
      await m.query(
        'UPDATE platform_account SET active=$2,role_id=$3,token_version=token_version+1 WHERE id=$1',
        [id, b.active ?? u.active, b.role_id ? uuid(b.role_id) : u.role_id],
      );
      await this.audit(
        m,
        actor,
        null,
        'user.update',
        { id, active: u.active, role_id: u.role_id },
        b,
      );
      return { message: 'User updated' };
    });
  }
  async resetRequest(b: any) {
    const e = email(b.email);
    await this.db.transaction(async (m) => {
      const [u] = await m.query(
        'SELECT id FROM platform_account WHERE email=$1 AND active',
        [e],
      );
      if (u)
        await this.link(m, 'reset', e, null, null, null, { account_id: u.id });
    });
    return { message: 'If the account exists, a reset link has been sent' };
  }
  async resetConfirm(b: any) {
    return this.db.transaction(async (m) => {
      const [i] = await m.query(
        "SELECT * FROM platform_invitation WHERE token_hash=$1 AND realm='reset' AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE",
        [hashToken(required(b.token, 'token', 128))],
      );
      if (!i) throw new BadRequestException('Invalid reset link');
      await m.query(
        'UPDATE platform_account SET password=$2,token_version=token_version+1 WHERE id=$1',
        [i.payload.account_id, await bcrypt.hash(password(b.password), 12)],
      );
      await m.query(
        'UPDATE platform_invitation SET accepted_at=now() WHERE id=$1',
        [i.id],
      );
      return { message: 'Password updated' };
    });
  }
  async resend(id: string, actor: string) {
    return this.db.transaction(async (m) => {
      const [i] = await m.query(
        'SELECT * FROM platform_invitation WHERE id=$1 AND accepted_at IS NULL FOR UPDATE',
        [uuid(id)],
      );
      if (!i) throw new NotFoundException();
      if (i.realm === 'tenant') {
        const [s] = await m.query(
          'SELECT s.tenant_id,COALESCE(s.staff_limit_override,v.staff_limit) AS cap FROM tenant_subscription s JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) WHERE tenant_id=$1 FOR UPDATE OF s',
          [i.tenant_id],
        );
        const [u] = await m.query('SELECT platform_usage($1) AS usage', [
          i.tenant_id,
        ]);
        if (
          Number(u.usage.staff) +
            Number(u.usage.reserved) -
            (i.revoked_at === null && new Date(i.expires_at) > new Date()
              ? 1
              : 0) >=
          s.cap
        )
          throw new BadRequestException('Staff seat limit reached');
      }
      await m.query(
        'UPDATE platform_invitation SET revoked_at=now() WHERE id=$1',
        [id],
      );
      const result = await this.link(
        m,
        i.realm,
        i.email,
        i.tenant_id,
        i.role_id,
        i.branch_id,
        i.payload,
      );
      await this.audit(m, actor, i.tenant_id, 'invite.resend', null, { id });
      return result;
    });
  }
  catalog() {
    return {
      features: FEATURES.map(([key, label, path]) => ({
        key,
        label,
        path,
        dependencies: DEPENDENCIES[key] ?? [],
      })),
      actions: ACTIONS,
      platformResources: PLATFORM_RESOURCES,
    };
  }
}
