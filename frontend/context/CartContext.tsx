"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { toast } from "@/lib/toast"

export type CartItemType = "service" | "package"

export type CartItem = {
  key: string
  type: CartItemType
  id: string
  name: string
  price: number
  qty: number
  imageUrl?: string | null
}

export type CartAddInput = {
  type: CartItemType
  id: string
  name: string
  price: number
  imageUrl?: string | null
  qty?: number
}

type CartContextType = {
  items: CartItem[]
  itemCount: number
  subtotal: number
  isOpen: boolean
  /** Increments on each successful addItem — used by the floating cart to buzz. */
  addPulse: number
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
  addItem: (item: CartAddInput) => void
  removeItem: (key: string) => void
  setQty: (key: string, qty: number) => void
  bumpQty: (key: string, delta: number) => void
  clearCart: () => void
  serviceQtyMap: Record<string, number>
  packageQtyMap: Record<string, number>
}

const STORAGE_KEY = "geeksalon-booking-cart"
const CartContext = createContext<CartContextType | undefined>(undefined)

function itemKey(type: CartItemType, id: string) {
  return `${type}:${id}`
}

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (i) =>
          i &&
          (i.type === "service" || i.type === "package") &&
          typeof i.id === "string" &&
          typeof i.name === "string" &&
          Number(i.qty) > 0,
      )
      .map((i) => ({
        key: itemKey(i.type, i.id),
        type: i.type as CartItemType,
        id: String(i.id),
        name: String(i.name),
        price: Number(i.price) || 0,
        qty: Math.max(1, Math.floor(Number(i.qty) || 1)),
        imageUrl: i.imageUrl ?? null,
      }))
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [addPulse, setAddPulse] = useState(0)

  useEffect(() => {
    setItems(loadCart())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* ignore quota */
    }
  }, [items, hydrated])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])
  const toggleCart = useCallback(() => setIsOpen((o) => !o), [])

  const addItem = useCallback((input: CartAddInput) => {
    const key = itemKey(input.type, input.id)
    const addQty = Math.max(1, Math.floor(input.qty ?? 1))
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key)
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, qty: i.qty + addQty, price: Number(input.price) || i.price } : i,
        )
      }
      return [
        ...prev,
        {
          key,
          type: input.type,
          id: input.id,
          name: input.name,
          price: Number(input.price) || 0,
          qty: addQty,
          imageUrl: input.imageUrl ?? null,
        },
      ]
    })
    toast.success(
      input.type === "package" ? "Package added to cart" : "Service added to cart",
    )
    // Do not open the drawer — only the cart icon / FAB opens it.
    setAddPulse((n) => n + 1)
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([30, 40, 30])
    }
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }, [])

  const setQty = useCallback((key: string, qty: number) => {
    const next = Math.floor(qty)
    if (next <= 0) {
      setItems((prev) => prev.filter((i) => i.key !== key))
      return
    }
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty: next } : i)))
  }, [])

  const bumpQty = useCallback((key: string, delta: number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.key === key)
      if (!item) return prev
      const next = item.qty + delta
      if (next <= 0) return prev.filter((i) => i.key !== key)
      return prev.map((i) => (i.key === key ? { ...i, qty: next } : i))
    })
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const itemCount = useMemo(
    () => items.reduce((n, i) => n + i.qty, 0),
    [items],
  )

  const subtotal = useMemo(
    () => items.reduce((n, i) => n + i.price * i.qty, 0),
    [items],
  )

  const serviceQtyMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const i of items) {
      if (i.type === "service") map[i.id] = i.qty
    }
    return map
  }, [items])

  const packageQtyMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const i of items) {
      if (i.type === "package") map[i.id] = i.qty
    }
    return map
  }, [items])

  const value = useMemo(
    () => ({
      items,
      itemCount,
      subtotal,
      isOpen,
      addPulse,
      openCart,
      closeCart,
      toggleCart,
      addItem,
      removeItem,
      setQty,
      bumpQty,
      clearCart,
      serviceQtyMap,
      packageQtyMap,
    }),
    [
      items,
      itemCount,
      subtotal,
      isOpen,
      addPulse,
      openCart,
      closeCart,
      toggleCart,
      addItem,
      removeItem,
      setQty,
      bumpQty,
      clearCart,
      serviceQtyMap,
      packageQtyMap,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}
