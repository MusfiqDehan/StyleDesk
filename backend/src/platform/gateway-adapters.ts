import { BadGatewayException, BadRequestException } from '@nestjs/common';
export type GatewayTransaction = {
  tran_id: string;
  amount: string;
  currency: string;
  email: string;
  name: string;
  phone: string;
  subscription?: boolean;
  interval?: string;
};
export type GatewayUrls = {
  success_url: string;
  fail_url: string;
  cancel_url: string;
  ipn_url: string;
};
export interface GatewayAdapter {
  initiate(
    tx: GatewayTransaction,
    urls: GatewayUrls,
  ): Promise<{ gateway_url: string; raw: any }>;
  validate(
    id: string,
    session?: boolean,
  ): Promise<{
    status: 'VALID' | 'PENDING' | 'FAILED';
    amount: string;
    currency: string;
    tran_id: string;
    raw: any;
  }>;
}
const ZERO = new Set(
  'BIF CLP DJF GNF JPY KMF KRW MGA PYG RWF UGX VND VUV XAF XOF XPF'.split(' '),
);
export function minorUnits(amount: string, currency: string): number {
  const v = Number(amount);
  const units = ZERO.has(currency.toUpperCase()) ? v : v * 100;
  if (
    !Number.isFinite(v) ||
    v <= 0 ||
    Math.abs(units - Math.round(units)) > 0.000001
  )
    throw new BadRequestException('Invalid payment amount');
  return Math.round(units);
}
export function majorUnits(amount: number, currency: string): string {
  return (ZERO.has(currency.toUpperCase()) ? amount : amount / 100).toFixed(
    ZERO.has(currency.toUpperCase()) ? 0 : 2,
  );
}
async function json(url: string, options: RequestInit = {}) {
  const r = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(35000),
  });
  const data = await r.json();
  if (!r.ok) throw new BadGatewayException('Payment provider request failed');
  return data as any;
}
export class StripeAdapter implements GatewayAdapter {
  constructor(
    readonly credentials: any,
    readonly sandbox: boolean,
  ) {}
  async request(
    path: string,
    method = 'GET',
    fields: Record<string, string> = {},
  ) {
    return json('https://api.stripe.com/v1/' + path, {
      method,
      headers: {
        authorization: `Bearer ${this.credentials.secret_key}`,
        'content-type': 'application/x-www-form-urlencoded',
        'Stripe-Version': process.env.STRIPE_API_VERSION ?? '2024-06-20',
      },
      ...(method !== 'GET'
        ? { body: new URLSearchParams(fields).toString() }
        : {}),
    });
  }
  async initiate(tx: GatewayTransaction, u: GatewayUrls) {
    const f: Record<string, string> = {
      mode: tx.subscription ? 'subscription' : 'payment',
      success_url: `${u.success_url}?tran_id=${tx.tran_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${u.cancel_url}?tran_id=${tx.tran_id}`,
      client_reference_id: tx.tran_id,
      'metadata[tran_id]': tx.tran_id,
      customer_email: tx.email,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': tx.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(
        minorUnits(tx.amount, tx.currency),
      ),
      'line_items[0][price_data][product_data][name]': tx.name,
    };
    if (tx.subscription) {
      f['line_items[0][price_data][recurring][interval]'] =
        tx.interval === 'yearly' ? 'year' : 'month';
      f['subscription_data[metadata][tran_id]'] = tx.tran_id;
    } else f['payment_intent_data[metadata][tran_id]'] = tx.tran_id;
    const raw = await this.request('checkout/sessions', 'POST', f);
    if (!raw.url) throw new BadGatewayException('Checkout URL missing');
    return {
      gateway_url: raw.url,
      raw: { id: raw.id, url: raw.url, subscription: raw.subscription },
    };
  }
  async validate(id: string) {
    const raw = await this.request(
      'checkout/sessions/' + encodeURIComponent(id),
    );
    return {
      status: (raw.payment_status === 'paid'
        ? 'VALID'
        : raw.status === 'expired'
          ? 'FAILED'
          : 'PENDING') as 'VALID' | 'FAILED' | 'PENDING',
      amount: majorUnits(raw.amount_total, raw.currency),
      currency: String(raw.currency).toUpperCase(),
      tran_id: raw.client_reference_id ?? raw.metadata?.tran_id,
      raw: {
        id: raw.id,
        subscription: raw.subscription,
        customer: raw.customer,
        payment_status: raw.payment_status,
      },
    };
  }
}
export class SSLCommerzAdapter implements GatewayAdapter {
  constructor(
    private credentials: any,
    private sandbox: boolean,
  ) {}
  private base() {
    return this.sandbox
      ? 'https://sandbox.sslcommerz.com'
      : 'https://securepay.sslcommerz.com';
  }
  async initiate(tx: GatewayTransaction, u: GatewayUrls) {
    const raw = await json(this.base() + '/gwprocess/v4/api.php', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        store_id: this.credentials.store_id,
        store_passwd: this.credentials.store_password,
        total_amount: tx.amount,
        currency: tx.currency,
        tran_id: tx.tran_id,
        ...u,
        cus_name: tx.name,
        cus_email: tx.email,
        cus_phone: tx.phone,
        cus_add1: 'Bangladesh',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
        shipping_method: 'NO',
        product_name: tx.name,
        product_category: 'service',
        product_profile: 'service',
      }).toString(),
    });
    if (raw.status !== 'SUCCESS' || !raw.GatewayPageURL)
      throw new BadGatewayException('SSLCommerz could not create checkout');
    return {
      gateway_url: raw.GatewayPageURL,
      raw: { sessionkey: raw.sessionkey, url: raw.GatewayPageURL },
    };
  }
  async validate(id: string, session = false) {
    if (session) {
      const q = await json(
        this.base() +
          '/validator/api/merchantTransIDvalidationAPI.php?' +
          new URLSearchParams({
            sessionkey: id,
            store_id: this.credentials.store_id,
            store_passwd: this.credentials.store_password,
            format: 'json',
          }),
      );
      if (q.val_id && ['VALID', 'VALIDATED'].includes(q.status))
        return this.validate(q.val_id);
      return {
        status: (['FAILED', 'CANCELLED', 'EXPIRED'].includes(q.status)
          ? 'FAILED'
          : 'PENDING') as 'FAILED' | 'PENDING',
        amount: '0',
        currency: 'BDT',
        tran_id: q.tran_id ?? '',
        raw: { status: q.status },
      };
    }
    const raw = await json(
      this.base() +
        '/validator/api/validationserverAPI.php?' +
        new URLSearchParams({
          val_id: id,
          store_id: this.credentials.store_id,
          store_passwd: this.credentials.store_password,
          format: 'json',
        }),
    );
    return {
      status: (['VALID', 'VALIDATED'].includes(raw.status) &&
      Number(raw.risk_level ?? 0) !== 1
        ? 'VALID'
        : 'FAILED') as 'VALID' | 'FAILED',
      amount: String(raw.currency_amount ?? raw.amount),
      currency: raw.currency_type ?? raw.currency,
      tran_id: raw.tran_id,
      raw: { val_id: raw.val_id, status: raw.status, tran_id: raw.tran_id },
    };
  }
}
export function gateway(
  slug: string,
  credentials: any,
  sandbox: boolean,
): GatewayAdapter {
  if (slug === 'stripe') return new StripeAdapter(credentials, sandbox);
  if (slug === 'sslcommerz') return new SSLCommerzAdapter(credentials, sandbox);
  throw new BadRequestException('Unknown gateway slug');
}
export function missingFields(schema: any[], credentials: any): string[] {
  return schema
    .filter(
      (f) =>
        f.required &&
        (!credentials[f.key] || typeof credentials[f.key] !== 'string'),
    )
    .map((f) => f.key);
}
