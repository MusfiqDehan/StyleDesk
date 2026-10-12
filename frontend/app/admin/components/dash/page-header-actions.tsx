"use client";

import { useActionAccess, type AccessAction } from "@admin/lib/access-context";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared geometry for admin page header action controls */
export const PAGE_HEADER_ACTION_BASE =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium leading-none transition-all disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

/** @deprecated Use PAGE_HEADER_ACTION_BASE */
export const ADMIN_HEADER_ACTION_BASE = PAGE_HEADER_ACTION_BASE;

type HeaderButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  accessAction?: AccessAction;
  accessFeature?: string;
};

export const PageHeaderSecondaryButton = React.forwardRef<
  HTMLButtonElement,
  HeaderButtonProps
>(function PageHeaderSecondaryButton(
  {
    children,
    className,
    asChild = false,
    type = "button",
    accessAction,
    accessFeature,
    ...props
  },
  ref,
) {
  const allowed = useActionAccess(accessAction, accessFeature);
  const Comp = asChild ? Slot : "button";
  if (!allowed) return null;
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(
        PAGE_HEADER_ACTION_BASE,
        "border border-[var(--brand-line)] bg-[var(--brand-mist)] text-[var(--brand-muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-ink)]",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

export const PageHeaderPrimaryButton = React.forwardRef<
  HTMLButtonElement,
  HeaderButtonProps
>(function PageHeaderPrimaryButton(
  {
    children,
    className,
    asChild = false,
    type = "button",
    accessAction,
    accessFeature,
    ...props
  },
  ref,
) {
  const allowed = useActionAccess(accessAction, accessFeature);
  const Comp = asChild ? Slot : "button";
  if (!allowed) return null;
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(
        PAGE_HEADER_ACTION_BASE,
        "border border-brand-primary bg-brand-primary text-brand-on-primary shadow-sm shadow-brand-primary/25 hover:border-brand-hover hover:bg-brand-hover hover:shadow-md hover:shadow-brand-primary/30",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

export const PageHeaderDangerButton = React.forwardRef<
  HTMLButtonElement,
  HeaderButtonProps
>(function PageHeaderDangerButton(
  {
    children,
    className,
    asChild = false,
    type = "button",
    accessAction,
    accessFeature,
    ...props
  },
  ref,
) {
  const allowed = useActionAccess(accessAction, accessFeature);
  const Comp = asChild ? Slot : "button";
  if (!allowed) return null;
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(
        PAGE_HEADER_ACTION_BASE,
        "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

interface PageHeaderYearSwitchProps {
  year: number;
  onYearChange: (year: number) => void;
  minYear?: number;
  maxYear?: number;
  className?: string;
}

export function PageHeaderYearSwitch({
  year,
  onYearChange,
  minYear = 2000,
  maxYear = new Date().getFullYear(),
  className,
}: Readonly<PageHeaderYearSwitchProps>) {
  return (
    <div
      className={cn(
        PAGE_HEADER_ACTION_BASE,
        "gap-1 border border-[var(--brand-line)] bg-[var(--brand-mist)] px-1.5 text-[var(--brand-muted)]",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Previous year"
        onClick={() => onYearChange(Math.max(minYear, year - 1))}
        disabled={year <= minYear}
        className="inline-flex size-7 items-center justify-center rounded-md text-[var(--brand-muted)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[3.25rem] text-center text-sm font-medium tabular-nums text-[var(--brand-ink)]">
        {year}
      </span>
      <button
        type="button"
        aria-label="Next year"
        onClick={() => onYearChange(Math.min(maxYear, year + 1))}
        disabled={year >= maxYear}
        className="inline-flex size-7 items-center justify-center rounded-md text-[var(--brand-muted)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/** Back-compat aliases */
export const AdminHeaderSecondaryButton = PageHeaderSecondaryButton;
export const AdminHeaderPrimaryButton = PageHeaderPrimaryButton;
export const AdminHeaderDangerButton = PageHeaderDangerButton;
export const AdminHeaderYearSwitch = PageHeaderYearSwitch;
