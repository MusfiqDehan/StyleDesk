"use client";

import { AdminAccessContext } from "@admin/lib/access-context";
import { useAuth } from "@admin/hooks/use-auth";
import { hasPermission, canAccessPath, User } from "@admin/lib/auth-utils";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { loginPathFor, permittedLoginPath } from "@/lib/auth-redirect";

import { useBusiness } from "@/context/BusinessContext";

export function AuthGuard({
  children,
}: {
  children: React.ReactNode;
  initialUser?: User | null;
}) {
  const { businessName } = useBusiness();
  // Route access must use the live bootstrap, which includes current entitlements.
  // A decoded server token has no feature catalog and cannot authorize a route.
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const isAllowedForPath = (u: User) => canAccessPath(u, pathname);

  useEffect(() => {
    if (!mounted || loading || !user) return;
    if (user.role === 'customer') {
      router.replace('/customer-dashboard');
      return;
    }
    if (!user.operational) return;
    if (pathname === '/admin' || pathname === '/admin/dashboard') {
      const destination = permittedLoginPath(user);
      if (destination !== pathname) router.replace(destination);
      return;
    }
    if (!canAccessPath(user, pathname) && pathname !== '/admin/forbidden') router.replace('/admin/forbidden');
  }, [user, loading, pathname, router, mounted]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading) {
      if (!user && pathname !== "/admin/login") {
        router.replace(loginPathFor(pathname, true));
      }
    }
  }, [user, loading, pathname, router, mounted]);

  // Fix hydration mismatch by only rendering after mount
  if (!mounted) return null;

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            </div>
          </div>
          <div className="space-y-1 text-center">
            <h3 className="text-lg font-medium text-foreground tracking-tight">
              {businessName}
            </h3>
            <p className="text-xs text-muted-foreground tracking-[0.2em] uppercase">
              Authenticating...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user && pathname !== "/admin/login") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Secure Session Required
          </p>
          <button
            onClick={() => router.push(loginPathFor(pathname, true))}
            className="text-xs py-2 px-4 bg-primary text-primary-foreground rounded-lg"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // If on login page, just show children
  if (pathname === "/admin/login") return children;

  if (user?.role === "customer") return null;

  if (user && !user.operational)
    return (
      <div className="p-8">
        <h1>Business access is unavailable</h1>
        <p>Contact your owner or renew your subscription.</p>
        {user.role === "admin" && (
          <a href="/billing">Open billing & recovery</a>
        )}
      </div>
    );

  if (!user || !isAllowedForPath(user)) {
    return null;
  }

  return (
    <AdminAccessContext.Provider value={{ user, path: pathname }}>
      {children}
    </AdminAccessContext.Provider>
  );
}
