"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"

import { Suspense } from "react"
import ClientDuePaymentPage from "./due-payment-client"

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className={`${DASH_PAGE} animate-pulse`}>
          <div className="mb-6 h-20 rounded-lg bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
        </div>
      }
    >
      <ClientDuePaymentPage />
    </Suspense>
  )
}
