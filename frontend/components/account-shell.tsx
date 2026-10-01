"use client"

import type { ReactNode } from "react"
import landing from "@/app/components/salon-landing.module.css"
import { PublicFooter, PublicHeader } from "@/components/public-chrome"
import styles from "./account-shell.module.css"

interface AccountShellProps {
  children: ReactNode
}

/** Shared canvas for customer account pages — same chrome as the public site. */
export function AccountShell({ children }: AccountShellProps) {
  return (
    <div className={landing.site}>
      <PublicHeader />
      <main className={styles.main}>{children}</main>
      <PublicFooter />
    </div>
  )
}

export { styles as accountStyles }
