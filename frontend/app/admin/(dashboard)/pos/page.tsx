"use client"

import { useCallback, useEffect, useState } from "react"
import { DashPage } from "@admin/components/dash"
import { PosHeader } from "@admin/components/pos/pos-header"
import { PosChooseServicePanel } from "@admin/components/pos/pos-choose-service-panel"
import {
  PosSelectedServicesPanel,
  type PosCartItem,
} from "@admin/components/pos/pos-selected-services-panel"
import { PosTransactionDetails } from "@admin/components/pos/pos-transaction-details"
import type { PosServiceCardData } from "@admin/components/pos/pos-service-card"
import type { PosPackageCardData } from "@admin/components/pos/pos-package-card"

const POS_CART_STORAGE_KEY = "makeover-pos-cart"

function isPosCartItem(value: unknown): value is PosCartItem {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.price === "number" &&
    Number.isFinite(row.price) &&
    typeof row.quantity === "number" &&
    Number.isFinite(row.quantity) &&
    row.quantity > 0 &&
    (row.type === "service" || row.type === "package")
  )
}

function loadPosCart(): PosCartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(POS_CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPosCartItem).map((row) => ({
      id: row.id,
      name: row.name,
      price: Math.max(0, Number(row.price) || 0),
      quantity: Math.max(1, Math.floor(Number(row.quantity) || 1)),
      type: row.type,
    }))
  } catch {
    return []
  }
}

function savePosCart(items: PosCartItem[]) {
  if (typeof window === "undefined") return
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(POS_CART_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(POS_CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore quota / private mode errors
  }
}

export default function PosPage() {
  const [cartItems, setCartItems] = useState<PosCartItem[]>([])
  const [cartReady, setCartReady] = useState(false)

  useEffect(() => {
    setCartItems(loadPosCart())
    setCartReady(true)
  }, [])

  useEffect(() => {
    if (!cartReady) return
    savePosCart(cartItems)
  }, [cartItems, cartReady])

  const addOrIncrement = useCallback((item: Omit<PosCartItem, "quantity">) => {
    setCartItems((prev) => {
      const existing = prev.find((row) => row.id === item.id && row.type === item.type)
      if (existing) {
        return prev.map((row) =>
          row.id === item.id && row.type === item.type
            ? { ...row, quantity: row.quantity + 1 }
            : row
        )
      }
      return [...prev, { ...item, quantity: 1 }]
    })
  }, [])

  const handleSelectService = (service: PosServiceCardData) => {
    addOrIncrement({
      id: service.id,
      name: service.name,
      price: service.price,
      type: "service",
    })
  }

  const handleSelectPackage = (pkg: PosPackageCardData) => {
    addOrIncrement({
      id: pkg.id,
      name: pkg.title,
      price: pkg.price,
      type: "package",
    })
  }

  const handleIncrement = (id: string, type: PosCartItem["type"]) => {
    setCartItems((prev) =>
      prev.map((row) =>
        row.id === id && row.type === type ? { ...row, quantity: row.quantity + 1 } : row
      )
    )
  }

  const handleDecrement = (id: string, type: PosCartItem["type"]) => {
    setCartItems((prev) =>
      prev
        .map((row) =>
          row.id === id && row.type === type
            ? { ...row, quantity: Math.max(0, row.quantity - 1) }
            : row
        )
        .filter((row) => row.quantity > 0)
    )
  }

  const handleRemove = (id: string, type: PosCartItem["type"]) => {
    setCartItems((prev) => prev.filter((row) => !(row.id === id && row.type === type)))
  }

  const handleClear = () => {
    setCartItems([])
  }

  const handleRestoreCart = useCallback((items: PosCartItem[]) => {
    setCartItems(items)
  }, [])

  return (
    // xl+ (desktop POS): pinned to the viewport, no page-level scroll — each panel
    // below manages its own internal scroll region. Below xl there isn't room for
    // three side-by-side columns, so the panels stack and the page scrolls normally.
    <DashPage className="flex min-w-0 flex-col gap-3 sm:gap-4 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PosHeader className="xl:shrink-0" />

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)_minmax(320px,0.85fr)] xl:overflow-hidden">
        <PosChooseServicePanel
          onSelectService={handleSelectService}
          onSelectPackage={handleSelectPackage}
          className="xl:min-h-0"
        />

        <PosSelectedServicesPanel
          items={cartItems}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onRemove={handleRemove}
          onClear={handleClear}
          className="h-[340px] max-h-[340px] xl:h-full xl:max-h-none xl:min-h-0"
        />

        <PosTransactionDetails
          items={cartItems}
          onResetCart={handleClear}
          onRestoreCart={handleRestoreCart}
          className="min-h-[320px] xl:h-full xl:min-h-0"
        />
      </div>
    </DashPage>
  )
}
