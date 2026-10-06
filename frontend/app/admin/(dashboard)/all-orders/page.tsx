"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Legacy path — redirects to /admin/invoices */
export default function AllOrdersRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/admin/invoices")
  }, [router])
  return null
}
