import "server-only";
import { isPlatformHostname } from "./platform-host";
import { internalTenantFetch } from "./internal-tenant-fetch";
import { headers, cookies } from "next/headers";
import { cache } from "react";
export async function tenantFetch(
  url: string | URL | Request,
  options: RequestInit = {},
): Promise<Response> {
  const incoming = await headers();
  const outgoing = new Headers(options.headers);
  outgoing.set("host", incoming.get("host") || "");
  const branch = (await cookies()).get("branchId")?.value;
  if (branch) outgoing.set("x-branch-id", branch);
  // Each request belongs to one host; avoid shared server cache entries entirely.
  const rest = { ...options } as RequestInit & { next?: unknown };
  delete rest.next;
  return internalTenantFetch(url, {
    ...rest,
    headers: outgoing,
    cache: "no-store",
  });
}
export const tenantOrigin = cache(async () => {
  const incoming = await headers();
  const host = incoming.get("host") || "";
  let canonical = host;
  if (!isPlatformHostname(host)) {
    try {
      const res = await tenantFetch(
        (process.env.INTERNAL_API_BASE_URL ?? "http://localhost:4000") +
          "/access/public",
        { cache: "no-store" },
      );
      if (res.ok) {
        const access = await res.json();
        if (access.canonicalHost)
          canonical =
            access.canonicalHost +
            (process.env.NODE_ENV !== "production" && host.includes(":")
              ? ":" + host.split(":").pop()
              : "");
      }
    } catch {}
  }
  return `${process.env.NODE_ENV === "production" ? "https" : "http"}://${canonical}`;
});
