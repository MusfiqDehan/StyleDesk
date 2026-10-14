"use client";

import { useActionAccess } from "@admin/lib/access-context";
import { cn } from "@/lib/utils";
import { formatPayButtonAmount } from "./pos-utils";

export type PosPaymentMethod = "cash" | "online";

interface PosSelectPaymentProps {
  method: PosPaymentMethod;
  totalPayable: number;
  onMethodChange: (method: PosPaymentMethod) => void;
  onCashClick?: () => void;
  onOnlineClick?: () => void;
  onPay?: () => void;
  disabled?: boolean;
  className?: string;
}

export function PosSelectPayment({
  method,
  totalPayable,
  onMethodChange,
  onCashClick,
  onOnlineClick,
  onPay,
  disabled = false,
  className,
}: PosSelectPaymentProps) {
  const canCreate = useActionAccess("create", "pos");
  if (!canCreate) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <h3 className="text-[15px] font-semibold text-brand-ink">
        Select Payment
      </h3>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onMethodChange("cash");
            onCashClick?.();
          }}
          className={cn(
            "flex h-[38px] flex-1 items-center justify-center rounded-xl bg-[#fea918] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 xl:w-[148px] xl:flex-none xl:shrink-0",
            method === "cash"
              ? "ring-2 ring-[#fea918]/40 ring-offset-1"
              : "opacity-90 hover:opacity-100",
          )}
        >
          Cash
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onMethodChange("online");
            onOnlineClick?.();
          }}
          className={cn(
            "flex h-[38px] flex-1 items-center justify-center rounded-xl bg-[#e2136e] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50",
            method === "online"
              ? "ring-2 ring-[#e2136e]/40 ring-offset-1"
              : "opacity-90 hover:opacity-100",
          )}
        >
          Pay Online
        </button>
      </div>

      <button
        type="button"
        onClick={onPay}
        disabled={disabled}
        className="flex h-[38px] w-full items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {formatPayButtonAmount(totalPayable)}
      </button>
    </div>
  );
}
