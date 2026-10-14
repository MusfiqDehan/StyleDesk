"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Check, ChevronDown, CreditCard, Store } from "lucide-react";
import { NotificationBell } from "@admin/components/notification-bell";
import { DASH_CARD } from "@admin/components/dash";
import api from "@admin/api/base";
import { useAuth } from "@admin/hooks/use-auth";
import { hasPermission } from "@admin/lib/auth-utils";
import {
  selectedBranch as storedBranch,
  selectBranch,
} from "@/lib/branch-selection";
import { cn } from "@/lib/utils";

interface PosHeaderProps {
  className?: string;
}

export function PosHeader({ className }: PosHeaderProps) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchOpen, setBranchOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const branchRef = useRef<HTMLDivElement>(null);
  const todayLabel = format(new Date(), "EEEE, MMMM d, yyyy");
  const selectedBranch =
    branches.find((b) => b.id === selectedBranchId) ?? branches[0];

  useEffect(() => {
    api
      .get("/branches")
      .then(({ data }) => {
        const allowed =
          user?.role === "admin" || user?.branchScope === "tenant"
            ? data
            : data.filter(
                (branch: { id: string }) => branch.id === user?.branchId,
              );
        setBranches(allowed);
        setSelectedBranchId(
          storedBranch() ?? user?.branchId ?? allowed[0]?.id ?? "",
        );
      })
      .catch(() => setBranches([]));
  }, [user?.id, user?.role, user?.branchScope, user?.branchId]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!branchRef.current?.contains(e.target as Node)) {
        setBranchOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <header
      className={cn(
        DASH_CARD,
        "flex flex-col gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4 md:flex-row md:items-center md:justify-between md:px-8",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-mist text-brand-primary sm:size-12">
          <CreditCard className="size-5 sm:size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight text-brand-primary sm:text-[28px] md:text-[32px] md:leading-none">
            POS
          </h1>
          <p className="mt-1 text-[13px] leading-snug text-brand-muted sm:text-[14px]">
            {todayLabel} — Here&apos;s your salon today
          </p>
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <nav
          aria-label="POS navigation"
          className="grid w-full grid-cols-3 gap-1 rounded-xl border border-brand-line bg-brand-mist p-1 sm:flex sm:w-auto"
        >
          <span className="flex h-9 items-center justify-center rounded-lg bg-white px-3 text-center text-xs font-semibold text-brand-primary shadow-sm sm:h-10 sm:min-w-[88px] sm:text-sm">
            POS
          </span>
          {hasPermission(user, "invoice", "view") && (
            <Link
              href="/admin/invoices"
              className="flex h-9 items-center justify-center rounded-lg px-3 text-center text-xs font-medium text-brand-muted transition-colors hover:bg-white hover:text-brand-ink sm:h-10 sm:text-sm"
            >
              Invoice
            </Link>
          )}
          {hasPermission(user, "dashboard", "view") && (
            <Link
              href="/admin"
              className="flex h-9 items-center justify-center rounded-lg px-3 text-center text-xs font-medium text-brand-muted transition-colors hover:bg-white hover:text-brand-ink sm:h-10 sm:text-sm"
            >
              Dashboard
            </Link>
          )}
        </nav>

        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3">
          <div ref={branchRef} className="relative min-w-0 flex-1 sm:flex-none">
            <button
              type="button"
              disabled={branches.length < 2}
              onClick={() => setBranchOpen((open) => !open)}
              className="flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-brand-line bg-white px-3 sm:w-[168px]"
              aria-haspopup="listbox"
              aria-expanded={branchOpen}
            >
              <Store className="size-4 shrink-0 text-brand-primary" />
              <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-brand-ink">
                {selectedBranch?.name ?? "Selected branch"}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-brand-muted transition-transform",
                  branchOpen && "rotate-180",
                )}
              />
            </button>

            {branchOpen && (
              <ul
                role="listbox"
                className="absolute right-0 z-30 mt-1 w-full min-w-[168px] overflow-hidden rounded-xl border border-brand-line bg-white shadow-lg"
              >
                {branches.map((branch) => {
                  const isSelected = branch.id === selectedBranchId;
                  return (
                    <li
                      key={branch.id}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium",
                          isSelected
                            ? "bg-brand-mist text-brand-primary"
                            : "text-brand-ink hover:bg-brand-mist",
                        )}
                        onClick={() => {
                          selectBranch(branch.id);
                          setBranchOpen(false);
                        }}
                      >
                        <span className="truncate">{branch.name}</span>
                        {isSelected && <Check className="size-4 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <NotificationBell
            buttonClassName="h-10 w-10 border-brand-line bg-brand-mist hover:bg-brand-soft sm:h-12 sm:w-12"
            iconClassName="size-5 text-brand-muted sm:size-6 sm:text-brand-ink"
          />
        </div>
      </div>
    </header>
  );
}
