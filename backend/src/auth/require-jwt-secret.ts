/** Require a real JWT signing secret in every environment (no silent fallback). */
export function requireJwtSecret(secret: string | undefined | null): string {
  const value = (secret ?? '').trim();
  if (!value) {
    throw new Error(
      'JWT_SECRET environment variable is required. Generate one with: openssl rand -base64 48',
    );
  }
  return value;
}
