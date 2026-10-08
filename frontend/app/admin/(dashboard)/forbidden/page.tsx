"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"

import Link from "next/link"
import { ShieldOff } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AccessDeniedPage() {
  return (
    <div className={`${DASH_PAGE} flex min-h-[70vh] items-center justify-center`}>
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <ShieldOff className="size-8" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">403</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#111]">Access Denied</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#666]">
          You do not have permission to view this page. Contact an administrator if you
          believe this is a mistake.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/admin">Go to Dashboard</Link>
          </Button>
          <Button asChild variant="outline" accessAction="edit">
            <Link href="/admin/update-password">Update Password</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
