export interface User {
  branchScope?: string;
  tenantId: string;
  branchId?: string | null;
  useremail: string;
  role: "admin" | "storeManager" | "staff" | "stylist" | "custom" | "customer" | "superadmin";
  id: string;
  permissions: string[];
  features?: string[];
  operational?: boolean;
  catalog?: { key: string; label: string; path: string }[];
  employeeId?: string | null;
  employeeName?: string | null;
  name?: string | null;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  // 1. Try LocalStorage (highest priority for SPA)
  const localToken = localStorage.getItem("accessToken");
  if (localToken) return localToken;

  // 2. Try Cookies (fallback)
  // Check common names: accessToken, access_token, token
  const cookieNames = ["accessToken"];
  for (const name of cookieNames) {
    const match = document.cookie.match(
      new RegExp("(^| )" + name + "=([^;]+)"),
    );
    if (match) {
      return match[2];
    }
  }

  return null;
}

export function decodeToken(
  token: string,
): (User & { exp?: number; iat?: number }) | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

    // Support both browser (atob) and Node (Buffer)
    const jsonPayload =
      typeof window !== "undefined"
        ? decodeURIComponent(
            atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join(""),
          )
        : Buffer.from(base64, "base64").toString();

    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

/** `exp` is seconds-since-epoch per JWT spec (vs. Date.now()'s milliseconds). */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return false; // no exp claim — can't tell, let the server be the source of truth
  return decoded.exp * 1000 <= Date.now();
}

/**
 * The server issues a JWT with a 1-day `exp` claim but stores it in a cookie/localStorage
 * for 10 days (see auth.controller.ts). Without this check, a page reload during that
 * 9-day gap would decode the stale token and render the UI as "logged in" (with
 * potentially outdated role/permissions) until the first API call 401s.
 */
export function getUserFromToken(token: string): User | null {
  const decoded = decodeToken(token);
  if (!decoded) return null;
  if (isTokenExpired(token)) {
    clearStoredToken();
    return null;
  }
  return decoded;
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("accessToken");
  } catch {}
  try {
    document.cookie = "accessToken=; Max-Age=0; path=/";
  } catch {}
}

export function hasPermission(
  user: User | null,
  permission: string,
  action = "view",
): boolean {
  if (!user || !user.operational) return false;
  const key =
    permission === "makeover-packages" ? "StyleDesk-packages" : permission;
  return (
    !!user.features?.includes(key) &&
    (user.permissions.includes("*") ||
      user.permissions.includes(`${key}:${action}`))
  );
}
export function accessKeyForPath(
  user: User | null,
  path: string,
): string | undefined {
  if (path === "/admin/forbidden" || path === "/admin/update-password")
    return "update-password";
  const aliases: Record<string, string> = {
    "/admin/unlinked-users": "attendance",
    "/admin/billing": "invoice",
    "/admin/dashboard": "dashboard",
    "/admin/settings/roles": "roles",
    "/admin/settings/invitations": "user-management",
    "/admin/settings/domains": "domains",
    "/admin/settings/payments": "online-payments",
  };
  const entry = user?.catalog
    ?.filter(
      (r) =>
        r.path &&
        (path === r.path ||
          (r.path !== "/admin" && path.startsWith(r.path + "/"))),
    )
    .sort((a, b) => b.path.length - a.path.length)[0];
  const key = aliases[path] ?? entry?.key;
  return key;
}

export function canAccessPath(user: User | null, path: string): boolean {
  if (!user || user.role === "customer") return false;
  if (path === "/admin/forbidden" || path === "/admin/update-password")
    return true;
  const key = accessKeyForPath(user, path);
  return !!key && hasPermission(user, key);
}
