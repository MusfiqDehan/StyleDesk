import { createHmac } from 'node:crypto';
import {
  effectiveFeatures,
  featureForRoute,
  featureKeys,
  expandLegacy,
  can,
} from './features.js';
import { subscriptionOpen, AccessService } from './access.service.js';
import { encrypt, decrypt, verifyStripe } from './crypto.js';
import {
  StripeAdapter,
  SSLCommerzAdapter,
  minorUnits,
} from './gateway-adapters.js';
import { tenantStorage } from '../tenancy/tenant-context.js';
import { publicAddress } from './platform-workers.js';

describe('Platform security and entitlements', () => {
  afterEach(() => tenantStorage.disable());
  it('suppresses transitive dependencies and never expands action permissions', () => {
    expect(
      effectiveFeatures(featureKeys, {
        employee: false,
        'landing-page': false,
      }),
    ).not.toEqual(
      expect.arrayContaining([
        'attendance',
        'hr-payroll',
        'website.testimonials',
      ]),
    );
    expect(expandLegacy(['invoice:view'])).toEqual(['invoice:view']);
    expect(can(expandLegacy(['invoice:view']), 'finance', 'edit')).toBe(false);
  });
  it('classifies independent sidebar capabilities and denies unknown routes', () => {
    expect(featureForRoute('/pos/invoices', 'POST')).toBe('pos');
    expect(featureForRoute('/invoice', 'GET')).toBe('invoice');
    expect(featureForRoute('/finance/categories', 'GET')).toBe(
      'finance-categories',
    );
    expect(featureForRoute('/invoice-setting', 'PATCH')).toBe(
      'settings.invoice',
    );
    expect(featureForRoute('/future-unclassified', 'GET')).toBe(
      '__unclassified__',
    );
  });
  it('requires email, respects expiry/grace, and suspension always wins', () => {
    const now = Date.now(),
      future = new Date(now + 60000).toISOString(),
      past = new Date(now - 60000).toISOString();
    const s = {
      active: true,
      emailVerified: true,
      status: 'active',
      endsAt: future,
    };
    expect(subscriptionOpen(s, now)).toBe(true);
    expect(subscriptionOpen({ ...s, emailVerified: false }, now)).toBe(false);
    expect(
      subscriptionOpen(
        {
          ...s,
          active: false,
          status: 'complimentary',
          complimentaryUntil: future,
        },
        now,
      ),
    ).toBe(false);
    expect(subscriptionOpen({ ...s, status: 'trial', endsAt: past }, now)).toBe(
      false,
    );
    expect(
      subscriptionOpen({ ...s, status: 'past_due', graceUntil: future }, now),
    ).toBe(true);
    expect(
      subscriptionOpen({ ...s, status: 'past_due', graceUntil: past }, now),
    ).toBe(false);
  });
  it('enforces features even for the owner and rejects missing action grants', async () => {
    const service = new AccessService();
    const state = {
      active: true,
      emailVerified: true,
      status: 'active',
      features: ['invoice'],
      overrides: {},
      staffLimit: 5,
    };
    await tenantStorage.run(
      {
        tenantId: 'tenant',
        branchId: 'branch',
        runner: { isReleased: false, query: async () => [{ state }] } as any,
        afterCommit: [],
      },
      async () => {
        await expect(
          service.require('finance', 'view', { role: 'admin' }),
        ).rejects.toThrow();
        await expect(
          service.require('invoice', 'edit', {
            role: 'custom',
            permissions: ['invoice:view'],
          }),
        ).rejects.toThrow();
        await expect(
          service.require('invoice', 'view', {
            role: 'custom',
            permissions: ['invoice:view'],
          }),
        ).resolves.toBeUndefined();
      },
    );
  });
  it('encrypts credentials with authenticated randomized encryption', () => {
    process.env.PAYMENT_ENCRYPTION_KEY = '12'.repeat(32);
    const secret = { secret_key: 'merchant-secret' };
    const encrypted = encrypt(secret);
    expect(encrypted).not.toContain(secret.secret_key);
    expect(encrypt(secret)).not.toBe(encrypted);
    expect(decrypt(encrypted)).toEqual(secret);
    const parts = encrypted.split('.');
    parts[1] = '00'.repeat(16);
    expect(() => decrypt(parts.join('.'))).toThrow();
  });
  it('verifies exact raw webhook bytes, multiple signatures, and timestamp tolerance', () => {
    const raw = Buffer.from('{ "id": "evt_test" }'),
      t = Math.floor(Date.now() / 1000),
      secret = 'whsec_test';
    const sig = createHmac('sha256', secret)
      .update(`${t}.`)
      .update(raw)
      .digest('hex');
    expect(verifyStripe(raw, `t=${t},v1=bad,v1=${sig}`, secret, t * 1000)).toBe(
      true,
    );
    expect(
      verifyStripe(
        Buffer.from('{"id":"evt_test"}'),
        `t=${t},v1=${sig}`,
        secret,
        t * 1000,
      ),
    ).toBe(false);
    expect(
      verifyStripe(raw, `t=${t},v1=${sig}`, secret, (t + 301) * 1000),
    ).toBe(false);
  });
  it('rejects incorrect minor-unit precision and internal routing addresses', () => {
    expect(minorUnits('1490.00', 'BDT')).toBe(149000);
    expect(minorUnits('100', 'JPY')).toBe(100);
    expect(() => minorUnits('100.01', 'JPY')).toThrow();
    expect(() => minorUnits('-10', 'BDT')).toThrow();
    for (const ip of [
      '127.0.0.1',
      '10.0.0.1',
      '169.254.169.254',
      '192.168.1.1',
      '::1',
      'fd00::1',
      '::ffff:127.0.0.1',
    ])
      expect(publicAddress(ip)).toBe(false);
    expect(publicAddress('1.1.1.1')).toBe(true);
  });
});
describe('Hosted payment adapters', () => {
  const realFetch = global.fetch;
  afterEach(() => (global.fetch = realFetch));
  it('selects Stripe subscription mode and derives currency-adjusted amounts', async () => {
    global.fetch = jest.fn(async (_url, options: any) => {
      const fields = new URLSearchParams(options.body);
      expect(fields.get('mode')).toBe('subscription');
      expect(fields.get('line_items[0][price_data][unit_amount]')).toBe(
        '299000',
      );
      expect(fields.get('line_items[0][price_data][recurring][interval]')).toBe(
        'year',
      );
      return {
        ok: true,
        json: async () => ({
          id: 'cs_test',
          url: 'https://checkout.stripe.com/test',
        }),
      } as any;
    });
    const adapter = new StripeAdapter({ secret_key: 'sk_test' }, true);
    await expect(
      adapter.initiate(
        {
          tran_id: 'TXN-test',
          amount: '2990',
          currency: 'BDT',
          name: 'Growth',
          email: 'owner@test.example',
          phone: '01700000000',
          subscription: true,
          interval: 'yearly',
        },
        {
          success_url: 'https://platform.example/success',
          cancel_url: 'https://platform.example/cancel',
          fail_url: '',
          ipn_url: '',
        },
      ),
    ).resolves.toMatchObject({
      gateway_url: 'https://checkout.stripe.com/test',
    });
  });
  it('queries SSLCommerz sessions before validating and preserves original currency amounts', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: any) => {
      urls.push(String(url));
      return {
        ok: true,
        json: async () =>
          urls.length === 1
            ? { status: 'VALID', val_id: 'val_verified' }
            : {
                status: 'VALIDATED',
                tran_id: 'TXN-test',
                amount: '1090',
                currency: 'BDT',
                currency_amount: '10.00',
                currency_type: 'USD',
                risk_level: 0,
              },
      } as any;
    });
    const adapter = new SSLCommerzAdapter(
      { store_id: 'merchant', store_password: 'password' },
      true,
    );
    await expect(adapter.validate('session', true)).resolves.toMatchObject({
      status: 'VALID',
      currency: 'USD',
      amount: '10.00',
      tran_id: 'TXN-test',
    });
    expect(urls[0]).toContain('merchantTransIDvalidationAPI.php');
    expect(urls[1]).toContain('val_id=val_verified');
  });
  it('keeps provider outages distinct from failed/paid validation', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('Provider unavailable');
    });
    await expect(
      new StripeAdapter({ secret_key: 'sk_test' }, true).validate('cs_test'),
    ).rejects.toThrow('Provider unavailable');
  });
});
