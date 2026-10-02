"use client";
import { SecretInput } from "@/components/ui/secret-input";
import { ModernSelect } from "@/components/ui/modern-select";
import { useEffect, useState } from "react";
import Link from "next/link";
import authStyles from "@/components/auth/auth.module.css";
import { BackToWebsite } from "@/components/auth/back-to-website";
import { consoleApi } from "@/lib/console-api";
import { PlatformBrand } from "./landing";
import "./platform.css";
export function PlatformLogin() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reset, setReset] = useState(false),
    [message, setMessage] = useState("");
  return (
    <main className="platform-app">
      <div className="platform-wrap">
        <header className={`platform-top ${authStyles.returnHeader}`}>
          <PlatformBrand />
          <BackToWebsite />
        </header>
        <section className="platform-card platform-auth">
          <span className="platform-eyebrow">Platform workspace</span>
          <h1 style={{ fontSize: 32, margin: "15px 0" }}>Welcome back.</h1>
          <p className="platform-muted">
            Sign in with your invited platform account.
          </p>
          {error && (
            <p className="platform-error" role="alert">
              {error}
            </p>
          )}
          {message && <p className="platform-success">{message}</p>}
          <form
            className="platform-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                if (reset)
                  setMessage(
                    (
                      await consoleApi("/platform/reset/request", "POST", {
                        email: f.get("email"),
                      })
                    ).message,
                  );
                else {
                  await consoleApi("/platform/login", "POST", {
                    email: f.get("email"),
                    password: f.get("password"),
                  });
                  location.assign("/platform-ui/admin");
                }
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email
              <input placeholder="e.g. alex@example.com"
                type="email"
                name="email"
                autoComplete="username"
                required
              />
            </label>
            {!reset && (
              <label>
                Password
                <SecretInput placeholder="e.g. Maple!River27 (use your own)"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                />
              </label>
            )}
            <button className="platform-btn primary" disabled={busy}>
              {busy ? "Please wait…" : reset ? "Send reset link" : "Sign in"}
            </button>
            <button
              type="button"
              className="platform-btn"
              onClick={() => {
                setReset(!reset);
                setMessage("");
              }}
            >
              {reset ? "Back to sign in" : "Forgot password?"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
export function PlatformRegister() {
  const [packages, setPackages] = useState<any[]>([]),
    [selection, setSelection] = useState(""),
    [interval, setInterval] = useState("monthly"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<any>(null),
    [gateways, setGateways] = useState<any[]>([]),
    [gateway, setGateway] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setInterval(q.get("interval") === "yearly" ? "yearly" : "monthly");
    consoleApi("/platform/packages/public")
      .then((p) => {
        setPackages(p);
        setSelection(q.get("package") ?? p[0]?.id ?? "");
      })
      .catch((e) => setError(e.message));
    consoleApi("/platform/payments/available-gateways")
      .then(setGateways)
      .catch(() => {});
  }, []);
  return (
    <main className="platform-app">
      <div className="platform-wrap">
        <header className="platform-top">
          <PlatformBrand />
          <Link href="/login">Platform sign in</Link>
        </header>
        <section
          className="platform-card platform-auth"
          style={{ maxWidth: 640 }}
        >
          <span className="platform-eyebrow">
            Make room for your next chapter
          </span>
          <h1 style={{ fontSize: 32, margin: "16px 0" }}>
            Create your business.
          </h1>
          {error && (
            <p className="platform-error" role="alert">
              {error}
            </p>
          )}
          {result ? (
            <>
              <p className="platform-success">
                Your business is reserved. Follow the activation link in your
                email.
              </p>
              <p className="platform-muted">
                Starter activates a trial after email verification. Paid
                packages also need confirmed payment.
              </p>
              {packages.find((p) => p.id === selection)?.trial_days === 0 && (
                <div className="platform-form">
                  <GatewayPicker
                    gateways={gateways}
                    value={gateway}
                    onChange={setGateway}
                  />
                  <button
                    className="platform-btn primary"
                    disabled={busy || !gateway}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const r = await consoleApi(
                          "/platform/payments/onboarding",
                          "POST",
                          {
                            activation_id: result.activation_id,
                            gateway_slug: gateway,
                          },
                        );
                        location.assign(r.gateway_url);
                      } catch (e: any) {
                        setError(e.message);
                        setBusy(false);
                      }
                    }}
                  >
                    Continue to checkout
                  </button>
                </div>
              )}
              <Link className="platform-btn" href="/">
                Back to StyleDesk
              </Link>
            </>
          ) : (
            <form
              className="platform-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  const r = await consoleApi("/platform/onboard", "POST", {
                    name: f.get("name"),
                    slug: f.get("slug"),
                    email: f.get("email"),
                    password: f.get("password"),
                    package_id: selection,
                    interval,
                  });
                  setResult(r);
                  sessionStorage.setItem(
                    "styledesk-onboarding",
                    JSON.stringify(r),
                  );
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Business name
                <input placeholder="e.g. Glow Studio" name="name" required maxLength={200} />
              </label>
              <label>
                Business subdomain
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={63}
                  placeholder="e.g. glow-studio"
                />
                <span className="platform-muted">
                  your-salon.styledesk.musfiqdehan.com
                </span>
              </label>
              <div className="platform-form-grid">
                <label>
                  Owner email
                  <input placeholder="e.g. alex@example.com"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </label>
                <label>
                  Password
                  <SecretInput placeholder="e.g. Maple!River27 (use your own)"
                    name="password"
                    type="password"
                    minLength={12}
                    required
                    autoComplete="new-password"
                  />
                </label>
              </div>
              <div className="platform-form-grid">
                <label>
                  Package
                  <ModernSelect
                    value={selection}
                    onChange={(e) => setSelection(e.target.value)}
                  >
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.demo ? " · Demo pricing" : ""}
                      </option>
                    ))}
                  </ModernSelect>
                </label>
                <label>
                  Billing
                  <ModernSelect
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </ModernSelect>
                </label>
              </div>
              <button
                className="platform-btn primary"
                disabled={busy || !selection}
              >
                {busy ? "Creating…" : "Create business"}
              </button>
              <p className="platform-muted">
                Platform users join by invitation. This creates a new salon
                owner account.
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
export function GatewayPicker({
  gateways,
  value,
  onChange,
}: {
  gateways: any[];
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <fieldset style={{ border: 0, padding: 0 }}>
      <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
        Payment method
      </legend>
      {!gateways.length && (
        <p className="platform-muted">
          No payment gateways are configured. Contact the platform
          administrator.
        </p>
      )}
      {gateways.map((g) => (
        <label className="check" key={g.slug}>
          <input
            type="radio"
            name="gateway"
            checked={value === g.slug}
            onChange={() => onChange(g.slug)}
          />
          {g.name}{" "}
          {g.is_sandbox && (
            <span className="platform-badge warning">Sandbox</span>
          )}
        </label>
      ))}
    </fieldset>
  );
}
export function InvitationPage() {
  const [token, setToken] = useState(""),
    [kind, setKind] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [activated, setActivated] = useState(false),
    [login, setLogin] = useState("/login");
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setToken(q.get("token") ?? "");
    setKind(q.get("kind") ?? "tenant");
  }, []);
  return (
    <main className="platform-app">
      <div className="platform-wrap">
        <header className="platform-top">
          <PlatformBrand />
        </header>
        <section className="platform-card platform-auth">
          <h1>
            {kind === "activation"
              ? "Activate your business"
              : kind === "reset"
                ? "Reset your password"
                : "Accept your invitation"}
          </h1>
          {error && <p className="platform-error">{error}</p>}
          {message && <p className="platform-success">{message}</p>}
          {activated ? (
            <Link className="platform-btn primary" href={login}>
              Continue to sign in
            </Link>
          ) : (
            <form
              className="platform-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                const f = new FormData(e.currentTarget);
                try {
                  let r;
                  if (kind === "activation")
                    r = await consoleApi("/platform/activate", "POST", {
                      token,
                    });
                  else
                    r = await consoleApi(
                      kind === "tenant"
                        ? "/tenant-console/accept"
                        : kind === "reset"
                          ? "/platform/reset/confirm"
                          : "/platform/invite/accept",
                      "POST",
                      {
                        token,
                        password: f.get("password"),
                        name: f.get("name"),
                        slug: f.get("slug"),
                      },
                    );
                  setMessage(r.message);
                  setLogin(r.login_url ?? "/login");
                  setActivated(true);
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {kind === "tenant-onboarding" && (
                <>
                  <label>
                    Business name
                    <input placeholder="e.g. Glow Studio" name="name" required />
                  </label>
                  <label>
                    Subdomain
                    <input placeholder="e.g. glow-studio"
                      name="slug"
                      required
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    />
                  </label>
                </>
              )}
              {kind !== "activation" && (
                <label>
                  Choose a password
                  <SecretInput placeholder="e.g. Maple!River27 (use your own)"
                    name="password"
                    type="password"
                    minLength={12}
                    required
                    autoComplete="new-password"
                  />
                </label>
              )}
              <button
                disabled={busy || !token}
                className="platform-btn primary"
              >
                {busy
                  ? "Please wait…"
                  : kind === "activation"
                    ? "Verify email and activate"
                    : "Continue"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
export function PaymentResult() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const tran = q.get("tran_id");
    if (!tran) {
      setError("Missing transaction reference");
      return;
    }
    let live = true;
    const load = () =>
      consoleApi(
        (location.hostname ===
        (process.env.NEXT_PUBLIC_PLATFORM_HOST ?? "localhost")
          ? "/platform"
          : "") +
          "/payments/status?tran_id=" +
          encodeURIComponent(tran),
      )
        .then((r) => {
          if (live) setData(r);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    load();
    const timer = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <main className="platform-app">
      <section className="platform-card platform-auth">
        <PlatformBrand />
        <h1>Payment {data?.status ?? "confirmation"}</h1>
        {error && <p className="platform-error">{error}</p>}
        <p className="platform-muted">
          {data?.status === "success"
            ? "Your payment has been verified. Business activation also requires verified email."
            : data?.status === "failed"
              ? "The payment could not be confirmed. Contact support before retrying."
              : "We are waiting for the payment provider to confirm your payment. You can safely leave this page."}
        </p>
        <Link className="platform-btn primary" href="/login">
          Continue to sign in
        </Link>
      </section>
    </main>
  );
}
