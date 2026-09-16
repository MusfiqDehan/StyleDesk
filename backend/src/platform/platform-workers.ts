import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { promises as dns } from 'node:dns';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import * as https from 'node:https';
import { PlatformDb } from './platform-db.js';
import { PaymentsService } from './payments.service.js';
import { effectiveFeatures } from './features.js';
import { subscriptionOpen } from './access.service.js';
import { StripeAdapter } from './gateway-adapters.js';
import { decrypt } from './crypto.js';
export function publicAddress(ip: string): boolean {
  if (ip.includes(':')) return /^[23]/i.test(ip) && !/^2001:db8:/i.test(ip);
  const p = ip.split('.').map(Number);
  return (
    p.length === 4 &&
    p.every((x) => Number.isInteger(x) && x >= 0 && x <= 255) &&
    ![0, 10, 127].includes(p[0]) &&
    !(p[0] === 169 && p[1] === 254) &&
    !(p[0] === 172 && p[1] >= 16 && p[1] <= 31) &&
    !(p[0] === 192 && (p[1] === 168 || p[1] === 0)) &&
    !(p[0] === 198 && (p[1] === 18 || p[1] === 19 || p[1] === 51)) &&
    !(p[0] === 203 && p[1] === 0 && p[2] === 113) &&
    !(p[0] === 100 && p[1] >= 64 && p[1] <= 127) &&
    p[0] < 224
  );
}
@Injectable()
export class PlatformWorkers {
  private log = new Logger(PlatformWorkers.name);
  constructor(
    private db: PlatformDb,
    private payments: PaymentsService,
  ) {}
  @Cron('*/30 * * * * *') async run() {
    await this.db.transaction(async (m) => {
      const [l] = await m.query(
        "SELECT pg_try_advisory_xact_lock(hashtext('styledesk-platform-worker')) AS locked",
      );
      if (!l.locked) return;
      await this.mail(m);
      await this.billing(m);
    });
    await this.payments.reconcile();
  }
  private async mail(m: any) {
    if (!process.env.MAIL_HOST) return;
    const mail = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT ?? 465),
      secure: process.env.MAIL_SECURE === 'true',
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });
    const rows = await m.query(
      'SELECT * FROM platform_outbox WHERE sent_at IS NULL AND next_attempt<=now() ORDER BY next_attempt LIMIT 10 FOR UPDATE SKIP LOCKED',
    );
    for (const r of rows) {
      try {
        await mail.sendMail({
          from: process.env.MAIL_FROM,
          to: r.recipient,
          subject: r.subject,
          text: r.body,
          messageId: `<${r.id}@styledesk>`,
        });
        await m.query(
          'UPDATE platform_outbox SET sent_at=now(),last_error=NULL WHERE id=$1',
          [r.id],
        );
      } catch {
        await m.query(
          "UPDATE platform_outbox SET attempts=attempts+1,next_attempt=now()+make_interval(secs=>LEAST(3600,30*power(2,LEAST(attempts,7))::int)),last_error='Mail delivery failed' WHERE id=$1",
          [r.id],
        );
      }
    }
  }
  private async billing(m: any) {
    const [cfg] = await m.query('SELECT value FROM platform_settings');
    const grace = cfg.value.graceDays ?? 7;
    await m.query(
      "UPDATE tenant_subscription SET status='past_due',grace_until=ends_at+make_interval(days=>$1),revision=revision+1 WHERE status='active' AND ends_at<=now() AND stripe_subscription IS NULL AND NOT cancel_at_period_end",
      [grace],
    );
    await m.query(
      "UPDATE tenant_subscription SET status='expired',revision=revision+1 WHERE (status='trial' AND ends_at<=now()) OR (status='complimentary' AND complimentary_until<=now()) OR (status='past_due' AND grace_until<=now())",
    );
    const rows = await m.query(
      "SELECT s.*,a.credential_snapshot,a.sandbox,a.id AS attempt_id FROM tenant_subscription s LEFT JOIN LATERAL(SELECT * FROM payment_attempt WHERE tenant_id=s.tenant_id AND gateway_slug='stripe' AND source='subscription' AND status='success' ORDER BY created_at DESC LIMIT 1)a ON true WHERE (s.stripe_subscription IS NOT NULL AND s.provider_sync_revision<>s.revision) OR s.cancel_at_period_end OR s.next_package_id IS NOT NULL OR s.stripe_price_sync",
    );
    for (const s of rows) {
      if (s.stripe_subscription && s.credential_snapshot) {
        try {
          const adapter = new StripeAdapter(
            decrypt(s.credential_snapshot),
            s.sandbox,
          );
          const liveState = await adapter.request(
            'subscriptions/' + encodeURIComponent(s.stripe_subscription),
          );
          if (liveState.cancel_at_period_end !== s.cancel_at_period_end)
            await adapter.request(
              'subscriptions/' + encodeURIComponent(s.stripe_subscription),
              'POST',
              { cancel_at_period_end: String(s.cancel_at_period_end) },
            );
          if (s.stripe_price_sync) {
            const [v] = await m.query(
              'SELECT * FROM platform_package_version WHERE package_id=$1 AND version=$2',
              [s.package_id, s.package_version],
            );
            if (liveState.schedule)
              await adapter.request(
                'subscription_schedules/' + liveState.schedule + '/release',
                'POST',
              );
            const price = await adapter.request('prices', 'POST', {
              currency: v.currency.toLowerCase(),
              unit_amount: String(
                (await import('./gateway-adapters.js')).minorUnits(
                  String(s.interval === 'yearly' ? v.yearly : v.monthly),
                  v.currency,
                ),
              ),
              'recurring[interval]': s.interval === 'yearly' ? 'year' : 'month',
              'product_data[name]': v.name,
            });
            await adapter.request(
              'subscriptions/' + encodeURIComponent(s.stripe_subscription),
              'POST',
              {
                'items[0][id]': liveState.items.data[0].id,
                'items[0][price]': price.id,
                proration_behavior: 'none',
                'metadata[package_id]': v.package_id,
                'metadata[package_version]': String(v.version),
                'metadata[interval]': s.interval,
              },
            );
            await m.query(
              'UPDATE tenant_subscription SET stripe_price_sync=false WHERE tenant_id=$1',
              [s.tenant_id],
            );
          }
          if (s.next_package_id) {
            const [v] = await m.query(
              'SELECT v.* FROM platform_package_version v WHERE v.package_id=$1 AND v.version=$2',
              [s.next_package_id, s.next_package_version],
            );
            const live = await adapter.request(
              'subscriptions/' + encodeURIComponent(s.stripe_subscription),
            );
            const price = await adapter.request('prices', 'POST', {
              currency: v.currency.toLowerCase(),
              unit_amount: String(
                (await import('./gateway-adapters.js')).minorUnits(
                  String(s.next_interval === 'yearly' ? v.yearly : v.monthly),
                  v.currency,
                ),
              ),
              'recurring[interval]':
                s.next_interval === 'yearly' ? 'year' : 'month',
              'product_data[name]': v.name,
            });
            let schedule = live.schedule;
            if (!schedule)
              schedule = (
                await adapter.request('subscription_schedules', 'POST', {
                  from_subscription: live.id,
                })
              ).id;
            const current = live.items.data[0];
            await adapter.request(
              'subscription_schedules/' + schedule,
              'POST',
              {
                end_behavior: 'release',
                'phases[0][start_date]': String(
                  live.current_period_start ?? current.current_period_start,
                ),
                'phases[0][end_date]': String(
                  live.current_period_end ?? current.current_period_end,
                ),
                'phases[0][items][0][price]': current.price.id,
                'phases[0][items][0][quantity]': '1',
                'phases[1][items][0][price]': price.id,
                'phases[1][items][0][quantity]': '1',
                'phases[1][metadata][package_id]': v.package_id,
                'phases[1][metadata][package_version]': String(v.version),
                'phases[1][metadata][interval]': s.next_interval,
              },
            );
            await m.query(
              'UPDATE tenant_subscription SET next_package_id=NULL,next_package_version=NULL,next_interval=NULL WHERE tenant_id=$1',
              [s.tenant_id],
            );
          }
          await m.query(
            'UPDATE tenant_subscription SET provider_sync_revision=revision WHERE tenant_id=$1',
            [s.tenant_id],
          );
        } catch {
          this.log.warn('Subscription provider update will retry');
        }
      } else if (s.ends_at && new Date(s.ends_at) <= new Date()) {
        if (s.cancel_at_period_end)
          await m.query(
            "UPDATE tenant_subscription SET status='cancelled',cancel_at_period_end=false,revision=revision+1 WHERE tenant_id=$1",
            [s.tenant_id],
          );
        else if (s.next_package_id)
          await m.query(
            'UPDATE tenant_subscription s SET package_id=p.id,package_version=s.next_package_version,interval=s.next_interval,next_package_id=NULL,next_package_version=NULL,next_interval=NULL,revision=revision+1 FROM platform_package p WHERE tenant_id=$1 AND p.id=s.next_package_id',
            [s.tenant_id],
          );
      }
    }
    // One reminder per tenant and period, independent of process restarts.
    await m.query(
      `INSERT INTO platform_outbox(id,recipient,subject,body) SELECT md5(s.tenant_id::text||s.ends_at::text||'renewal')::uuid,i.email,'StyleDesk renewal reminder','Your subscription or trial is ending. Open your tenant workspace billing page to renew.' FROM tenant_subscription s JOIN LATERAL(SELECT email FROM platform_invitation WHERE tenant_id=s.tenant_id AND realm='activation' LIMIT 1)i ON true WHERE s.ends_at BETWEEN now() AND now()+interval '3 days' ON CONFLICT DO NOTHING`,
    );
  }
  @Cron('*/30 * * * * *') async domains() {
    if (process.env.DOMAIN_WORKER !== 'true') return;
    const directory = process.env.STYLEDESK_TRAEFIK_DIR;
    if (!directory) {
      this.log.error('STYLEDESK_TRAEFIK_DIR is required for automatic domains');
      return;
    }
    await this.db.transaction(async (m) => {
      const [l] = await m.query(
        "SELECT pg_try_advisory_xact_lock(hashtext('styledesk-domains')) AS locked",
      );
      if (!l.locked) return;
      const rows = await m.query(
        `SELECT d.*,t.active,s.status AS subscription_status,s.email_verified,s.ends_at,s.grace_until,s.complimentary_until,v.features,s.overrides FROM tenant_domain d JOIN tenant t ON t.id=d.tenant_id JOIN tenant_subscription s ON s.tenant_id=d.tenant_id JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version)`,
      );
      for (const d of rows) {
        const allowed =
          effectiveFeatures(d.features, d.overrides).includes('domains') &&
          subscriptionOpen({
            active: d.active,
            emailVerified: d.email_verified,
            status: d.subscription_status,
            endsAt: d.ends_at,
            graceUntil: d.grace_until,
            complimentaryUntil: d.complimentary_until,
          });
        if (!allowed) {
          await m.query(
            "UPDATE tenant_domain SET status='disabled',is_primary=false WHERE id=$1",
            [d.id],
          );
          d.status = 'disabled';
          continue;
        }
        if (d.status === 'disabled' || new Date(d.next_check) > new Date())
          continue;
        try {
          const txt = (await dns.resolveTxt(`_styledesk.${d.hostname}`)).map(
            (v) => v.join(''),
          );
          if (!txt.includes(d.verification_token))
            throw new Error('TXT ownership verification pending');
          const addresses = await dns.lookup(d.hostname, { all: true });
          if (
            !addresses.length ||
            addresses.some((a) => !publicAddress(a.address))
          )
            throw new Error('Domain resolves to an internal address');
          const target =
            process.env.DOMAIN_CNAME_TARGET ?? process.env.PLATFORM_HOST!;
          const targets = await dns.lookup(target, { all: true });
          let cname: string[] = [];
          try {
            cname = await dns.resolveCname(d.hostname);
          } catch {}
          if (
            !cname.some((v) => v.replace(/\.$/, '') === target) &&
            !addresses.some(
              (a) =>
                a.address === process.env.DOMAIN_PUBLIC_IP ||
                targets.some((t) => t.address === a.address),
            )
          )
            throw new Error('DNS must point to the StyleDesk proxy');
          d.status = 'provisioning';
          await m.query(
            "UPDATE tenant_domain SET status='provisioning',verified_at=COALESCE(verified_at,now()),last_error=NULL WHERE id=$1",
            [d.id],
          );
        } catch (e: any) {
          d.status = 'failed';
          await m.query(
            "UPDATE tenant_domain SET status='failed',attempts=attempts+1,next_check=now()+make_interval(secs=>LEAST(3600,30*power(2,LEAST(attempts,7))::int)),last_error=$2 WHERE id=$1",
            [d.id, String(e.message).slice(0, 300)],
          );
        }
      }
      const routers: any = {};
      for (const d of rows.filter((d) =>
        ['active', 'provisioning'].includes(d.status),
      )) {
        const key = 'styledesk-' + d.id;
        routers[key] = {
          rule: `Host(\`${d.hostname}\`)`,
          entryPoints: ['websecure'],
          service: 'StyleDesk-client@docker',
          priority: 80,
          tls: { certResolver: 'customdomains' },
        };
        routers[key + '-http'] = {
          rule: `Host(\`${d.hostname}\`) && !PathPrefix(\`/.well-known/acme-challenge/\`)`,
          entryPoints: ['web'],
          service: 'redirect-noop@file',
          middlewares: ['redirect-to-https@file'],
          priority: 80,
        };
        routers[key + '-socket'] = {
          rule: `Host(\`${d.hostname}\`) && PathPrefix(\`/api/socket.io\`)`,
          entryPoints: ['websecure'],
          service: 'StyleDesk-api@docker',
          middlewares: ['StyleDesk-api-stripprefix@docker'],
          priority: 100,
          tls: { certResolver: 'customdomains' },
        };
      }
      await fs.mkdir(directory, { recursive: true });
      const file = join(directory, 'styledesk-domains.json'),
        tmp = join(directory, 'styledesk-domains.tmp');
      await fs.writeFile(tmp, JSON.stringify({ http: { routers } }, null, 2), {
        mode: 0o600,
      });
      await fs.rename(tmp, file);
      for (const d of rows.filter(
        (d) =>
          d.status === 'provisioning' && new Date(d.next_check) <= new Date(),
      )) {
        try {
          const pinned = (await dns.lookup(d.hostname, { all: true })).filter(
            (a) => publicAddress(a.address),
          );
          if (!pinned.length) throw new Error('No public routing address');
          await new Promise<void>((resolve, reject) => {
            const req = https.get(
              `https://${d.hostname}/api/backend/domain-proof?token=${encodeURIComponent(d.verification_token)}`,
              {
                timeout: 10000,
                lookup: ((_host: any, _options: any, callback: any) =>
                  callback(null, pinned[0].address, pinned[0].family)) as any,
              },
              (res) => {
                let body = '';
                res.on('data', (chunk) => {
                  body += chunk;
                  if (body.length > 4096)
                    req.destroy(new Error('Invalid routing proof'));
                });
                res.on('end', () => {
                  try {
                    if (
                      res.statusCode !== 200 ||
                      JSON.parse(body).tenantId !== d.tenant_id
                    )
                      throw new Error('Tenant routing proof unavailable');
                    resolve();
                  } catch (error) {
                    reject(error);
                  }
                });
              },
            );
            req.on('error', reject);
            req.on('timeout', () =>
              req.destroy(new Error('TLS provisioning pending')),
            );
          });
          await m.query(
            "UPDATE tenant_domain SET status='active',attempts=0,last_error=NULL,next_check=now()+interval '1 hour' WHERE id=$1",
            [d.id],
          );
        } catch {
          await m.query(
            "UPDATE tenant_domain SET attempts=attempts+1,next_check=now()+make_interval(secs=>LEAST(3600,30*power(2,LEAST(attempts,7))::int)),last_error='Waiting for routing proof and TLS certificate' WHERE id=$1",
            [d.id],
          );
        }
      }
    });
  }
}
