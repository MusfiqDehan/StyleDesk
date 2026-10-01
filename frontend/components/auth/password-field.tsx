"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import styles from "./auth.module.css";

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "new-password",
  hint,
  invalid = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: "current-password" | "new-password";
  hint?: string;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputWrap}>
        <LockKeyhole size={17} />
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          required
          minLength={autoComplete === "new-password" ? 6 : undefined}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            autoComplete === "current-password"
              ? "e.g. Maple!River27 (use your own)"
              : "e.g. Maple!River27 (at least 6 characters)"
          }
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setVisible(!visible)}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
