"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarDays,
  ArrowRight,
  Minus,
  Plus,
  Trash2,
  X,
  Package,
  Sparkles,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useBooking } from "@/context/BookingContext";
import { formatCurrency, cn } from "@/lib/utils";
import styles from "./cart-drawer.module.css";

export function CartDrawer() {
  const {
    items,
    itemCount,
    subtotal,
    isOpen,
    closeCart,
    bumpQty,
    removeItem,
    clearCart,
    serviceQtyMap,
    packageQtyMap,
  } = useCart();
  const { openBookingFromCart } = useBooking();
  const returnFocus = useRef<HTMLElement | null>(null);
  const handleRequestBooking = () => {
    if (!items.length) return;
    returnFocus.current = null;
    closeCart();
    openBookingFromCart(serviceQtyMap, packageQtyMap);
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeCart();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.drawer}
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <header className={styles.header}>
            <span className={styles.headerIcon}>
              <CalendarDays size={24} />
            </span>
            <div>
              <p className={styles.eyebrow}>A LITTLE TIME FOR YOU</p>
              <Dialog.Title className={styles.title}>
                Your booking bag<span>{itemCount}</span>
              </Dialog.Title>
            </div>
            <Dialog.Close
              className={styles.close}
              aria-label="Close booking bag"
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          <Dialog.Description className={styles.description}>
            Your favorites, ready for your next feel-good visit.
          </Dialog.Description>
          <div className={styles.body}>
            {items.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <Sparkles size={37} strokeWidth={1.4} />
                </span>
                <h3>A little me-time belongs here.</h3>
                <p>
                  Find a service you love and add it to your bag. Your next
                  glow-up starts there.
                </p>
                <Link
                  href="/services"
                  onClick={closeCart}
                  className={styles.browse}
                >
                  Discover services <ArrowRight size={17} />
                </Link>
                <Link
                  href="/packages"
                  onClick={closeCart}
                  className={styles.packageLink}
                >
                  Or explore a complete package
                </Link>
              </div>
            ) : (
              <ul className={styles.items}>
                {items.map((item) => (
                  <li key={item.key} className={styles.item}>
                    <span className={styles.itemIcon}>
                      {item.type === "package" ? (
                        <Package size={22} />
                      ) : (
                        <Sparkles size={22} />
                      )}
                    </span>
                    <div className={styles.itemInfo}>
                      <small>
                        {item.type === "package" ? "PACKAGE" : "SERVICE"}
                      </small>
                      <h3>{item.name}</h3>
                      <p>{formatCurrency(item.price)} each</p>
                      <div className={styles.itemBottom}>
                        <div className={styles.quantity}>
                          <button
                            type="button"
                            onClick={() => bumpQty(item.key, -1)}
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus size={14} />
                          </button>
                          <span aria-live="polite">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => bumpQty(item.key, 1)}
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <strong>{formatCurrency(item.price * item.qty)}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => removeItem(item.key)}
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <footer className={styles.footer}>
            <div className={styles.subtotal}>
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <p>Review your appointment details in the next step.</p>
            <button
              type="button"
              className={styles.checkout}
              disabled={!items.length}
              onClick={handleRequestBooking}
            >
              Choose my date & time <ArrowRight size={18} />
            </button>
            {items.length > 0 && (
              <button
                type="button"
                className={styles.clear}
                onClick={clearCart}
              >
                Clear booking bag
              </button>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CartIconButton({ className }: { className?: string }) {
  const { itemCount, openCart } = useCart();
  return (
    <button
      type="button"
      onClick={openCart}
      className={cn(styles.iconButton, className)}
      aria-label={`Open booking bag, ${itemCount} items`}
    >
      <CalendarDays size={19} />
      <span>{itemCount}</span>
    </button>
  );
}

export function CartFloatingButton() {
  const pathname = usePathname();
  const { itemCount, subtotal, openCart, isOpen } = useCart();
  if (
    !pathname ||
    [
      "/admin",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
    ].some((path) => pathname.startsWith(path)) ||
    isOpen
  )
    return null;
  return (
    <button
      type="button"
      onClick={openCart}
      className={cn(
        styles.floating,
        (pathname === "/" || pathname === "/services") && styles.homeFloating,
      )}
      aria-label={`Open booking bag, ${itemCount} items`}
    >
      <span className={styles.floatingIcon}>
        <CalendarDays size={21} />
        <b>{itemCount > 99 ? "99+" : itemCount}</b>
      </span>
      <span className={styles.floatingCopy}>
        <strong>My booking bag</strong>
        <small>
          {itemCount
            ? `${itemCount} selected · ${formatCurrency(subtotal)}`
            : "Your next feel-good visit"}
        </small>
      </span>
      <ArrowRight size={18} />
    </button>
  );
}
