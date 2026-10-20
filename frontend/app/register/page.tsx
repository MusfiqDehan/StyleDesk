"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Loader2,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import api from "@admin/api/base";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { authErrorMessage } from "@/lib/auth-errors";
import styles from "@/components/auth/auth.module.css";

const BD_PHONE = /^(?:(?:\+?88)?01[3-9]\d{8}|1[3-9]\d{8})$/;

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setPhoneError("");
    if (!name.trim()) {
      setError("Please tell us your name.");
      return;
    }
    if (!BD_PHONE.test(phone.trim())) {
      setPhoneError(
        "Enter a valid Bangladeshi mobile number, such as 01712345678.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Your passwords don’t match yet. Please check them.");
      return;
    }
    setSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await api.post(
        "/auth/send-signup-code",
        { email: normalizedEmail, phone: phone.trim() },
        { timeout: 15000 },
      );
      sessionStorage.setItem(
        "pendingSignup",
        JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          phone: phone.trim(),
          password,
        }),
      );
      router.push(
        `/register/verify-otp?email=${encodeURIComponent(normalizedEmail)}`,
      );
    } catch (error) {
      setError(
        authErrorMessage(
          error,
          "We couldn’t send your verification code. Please try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell mode="register">
      <p className={styles.eyebrow}>YOUR SELF-CARE STARTS HERE</p>
      <h1>
        Join the good side.
        <span className={styles.headingSpark} aria-hidden="true">
          ✳
        </span>
      </h1>
      <p className={styles.intro}>
        A few details now. More time for yourself later.
        <br />
        Create your account to start planning your next visit.
      </p>
      <div className={styles.progress}>
        <span className={styles.currentStep}>
          1 <b>Your details</b>
        </span>
        <i />
        <span>
          2 <b>Verify email</b>
        </span>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className={styles.form}
        aria-busy={submitting}
      >
        <div className={styles.field}>
          <label htmlFor="name">Full name</label>
          <div className={styles.inputWrap}>
            <UserRound size={17} />
            <input
              id="name"
              name="name"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Alex Rahman"
            />
          </div>
        </div>
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
        <div className={styles.field}>
          <label htmlFor="phone">Mobile number</label>
          <div className={styles.inputWrap}>
            <Phone size={17} />
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setPhoneError("");
              }}
              placeholder="01712345678"
              aria-invalid={!!phoneError || undefined}
              aria-describedby="phone-hint"
            />
          </div>
          <small
            id="phone-hint"
            className={phoneError ? styles.fieldError : undefined}
          >
            {phoneError ||
              "For your appointment details. Use a Bangladeshi mobile number."}
          </small>
        </div>
        <div className={styles.passwordRow}>
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
          />
          <PasswordField
            id="confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            invalid={!!confirmPassword && password !== confirmPassword}
          />
        </div>
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 size={18} className={styles.spinner} /> Sending your
              code…
            </>
          ) : (
            <>
              Create my account <ArrowUpRight size={19} />
            </>
          )}
        </button>
        <p className={styles.formHint}>
          <Check size={13} /> We’ll verify your email before creating your
          account.
        </p>
      </form>
      <p className={styles.switch}>
        Already part of the club?{" "}
        <Link href="/login">
          Welcome back <ArrowUpRight size={13} />
        </Link>
      </p>
    </AuthShell>
  );
}
