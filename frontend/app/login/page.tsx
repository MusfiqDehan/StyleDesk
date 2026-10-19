"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import api from "@admin/api/base";
import type { User } from "@admin/lib/auth-utils";
import { consoleApi } from "@/lib/console-api";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { authErrorMessage } from "@/lib/auth-errors";
import { permittedLoginPath, safeNextPath } from "@/lib/auth-redirect";
import styles from "@/components/auth/auth.module.css";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const next = searchParams.get("next");
  useEffect(() => {
    let active = true;
    // The server validates cookies/tokens and resolves the current role on every bootstrap.
    consoleApi('/access/bootstrap').then(data => {
      if (active) window.location.replace(permittedLoginPath({ ...data.user, permissions:data.permissions, features:data.features, catalog:data.catalog, operational:data.operational } as User, next));
    }).catch(() => {});
    return () => { active = false; };
  }, [next]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      let data: any;
      try {
        const res = await api.post(
          "/auth/public-login",
          { email: normalizedEmail, password },
          { timeout: 15000 },
        );
        data = res.data;
      } catch (publicErr) {
        // Fallback: Check if this is a platform admin/superadmin login
        try {
          const platformUser = await consoleApi("/platform/login", "POST", {
            email: normalizedEmail,
            password,
          });
          if (platformUser) {
            window.location.href = safeNextPath(next) ?? "/platform-ui/admin";
            return;
          }
        } catch {
          // If platform login also fails, throw original public login error
          throw publicErr;
        }
      }

      const token = data?.accessToken;
      if (typeof token !== "string" || !token) {
        setError("We couldn’t complete sign-in. Please try again.");
        return;
      }
      const account = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (account.branchId) document.cookie = `branchId=${account.branchId}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      sessionStorage.clear();
      localStorage.setItem("accessToken", token);
      document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; max-age=${10 * 24 * 60 * 60}; samesite=strict`;
      if (data.user?.phone) localStorage.setItem("userPhone", data.user.phone);
      else localStorage.removeItem("userPhone");
      const access = await consoleApi('/access/bootstrap');
      window.location.href = permittedLoginPath({ ...access.user, permissions:access.permissions, features:access.features, catalog:access.catalog, operational:access.operational } as User, next);
    } catch (error) {
      setError(
        authErrorMessage(
          error,
          "That email and password don’t match. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <p className={styles.eyebrow}>
        YOUR ACCOUNT. YOUR WORKSPACE.
      </p>
      <h1>
        Welcome back.
        <span className={styles.headingSpark} aria-hidden="true">
          ✳
        </span>
      </h1>
      <p className={styles.intro}>
        Sign in to book a visit or open your workspace. Your account permissions decide what you can access.
      </p>
      {searchParams.get("registered") === "true" && (
        <div className={styles.success} role="status">
          <CheckCircle2 size={18} /> You’re all set! Sign in to book your first
          visit.
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      <form method="post" onSubmit={handleSubmit} className={styles.form} aria-busy={loading}>
        <div className={styles.field}>
          <label htmlFor="email">Email address</label>
          <div className={styles.inputWrap}>
            <Mail size={17} />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </div>
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <Link className={styles.forgot} href="/forgot-password">
          Forgot your password?
        </Link>
        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={18} className={styles.spinner} /> Signing you in…
            </>
          ) : (
            <>
              Sign in <ArrowUpRight size={19} />
            </>
          )}
        </button>
      </form>
      <p className={styles.switch}>
        New around here?{" "}
        <Link href="/register">
          Make yourself at home <ArrowUpRight size={13} />
        </Link>
      </p>
      <p className={styles.switch} style={{ marginTop: 8 }}>
        Platform administrator?{" "}
        <Link href="/platform-ui/login">
          Sign in to Platform Console <ArrowUpRight size={13} />
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.loading} role="status">
          <Loader2 className={styles.spinner} /> Loading sign-in…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
