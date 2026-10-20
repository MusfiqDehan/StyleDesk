"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import api from "@admin/api/base";
import { AuthShell } from "@/components/auth/auth-shell";
import { authErrorMessage } from "@/lib/auth-errors";
import styles from "@/components/auth/auth.module.css";

type PendingSignup = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

function VerifyOtpContent() {
  const router = useRouter();
  const params = useSearchParams();
  const emailFromQuery = params.get("email") || "";
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(
    null,
  );
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    try {
      const pending = JSON.parse(
        sessionStorage.getItem("pendingSignup") || "null",
      );
      if (
        !pending ||
        ![pending.name, pending.email, pending.phone, pending.password].every(
          (value) => typeof value === "string" && value.length > 0,
        ) ||
        (emailFromQuery && pending.email !== emailFromQuery)
      ) {
        router.replace("/register");
        return;
      }
      setPendingSignup(pending);
    } catch {
      router.replace("/register");
    }
  }, [emailFromQuery, router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingSignup || loading || resending) return;
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the six-digit code from your email.");
      return;
    }
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await api.post(
        "/auth/verify-signup-code",
        { email: pendingSignup.email, code: otp },
        { timeout: 15000 },
      );
      await api.post("/auth/customer-signup", pendingSignup, {
        timeout: 15000,
      });
      sessionStorage.removeItem("pendingSignup");
      router.push("/login?registered=true");
    } catch (error) {
      setError(
        authErrorMessage(
          error,
          "We couldn’t verify that code. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!pendingSignup || countdown > 0 || resending || loading) return;
    setError("");
    setInfo("");
    setResending(true);
    try {
      await api.post(
        "/auth/send-signup-code",
        { email: pendingSignup.email, phone: pendingSignup.phone },
        { timeout: 15000 },
      );
      setInfo("A fresh code is on its way. Check your inbox and spam folder.");
      setCountdown(60);
    } catch (error) {
      setError(
        authErrorMessage(
          error,
          "We couldn’t send a new code. Please try again.",
        ),
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell mode="verify">
      <p className={styles.eyebrow}>ONE LAST LITTLE STEP</p>
      <h1>
        Check your inbox.
        <span className={styles.headingSpark} aria-hidden="true">
          ✳
        </span>
      </h1>
      <p className={styles.intro}>
        We sent a six-digit code to
        <br />
        <span className={styles.email}>
          {pendingSignup?.email || "your email address"}
        </span>
        . Enter it below to finish creating your salon account.
      </p>
      <div className={styles.progress}>
        <span>
          <CheckCircle2 size={14} /> <b>Your details</b>
        </span>
        <i />
        <span className={styles.currentStep}>
          2 <b>Verify email</b>
        </span>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {info && (
        <div className={styles.success} role="status">
          {info}
        </div>
      )}
      <form onSubmit={handleVerify} className={styles.form} aria-busy={loading}>
        <div className={styles.field}>
          <label htmlFor="verification-code">Verification code</label>
          <input
            id="verification-code"
            name="code"
            className={styles.code}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={otp}
            onChange={(event) =>
              setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000000"
          />
          <small>The code is in the email we just sent you.</small>
        </div>
        <button
          className={styles.submit}
          disabled={loading || resending || !pendingSignup}
          type="submit"
        >
          {loading ? (
            <>
              <Loader2 size={18} className={styles.spinner} /> Finishing up…
            </>
          ) : (
            <>
              Verify & join <ArrowUpRight size={19} />
            </>
          )}
        </button>
      </form>
      <p className={styles.switch}>
        No email yet?{" "}
        <button
          className={styles.resend}
          onClick={handleResend}
          disabled={countdown > 0 || resending || loading || !pendingSignup}
        >
          {resending
            ? "Sending…"
            : countdown > 0
              ? `Resend in ${countdown}s`
              : "Send a new code"}
        </button>
      </p>
      <p className={styles.switch}>
        <Link href="/register">
          <ArrowLeft size={14} /> Change your details
        </Link>
      </p>
    </AuthShell>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.loading} role="status">
          <Loader2 className={styles.spinner} /> Preparing verification…
        </div>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
