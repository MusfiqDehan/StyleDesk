import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { DASH_PAGE, DASH_SPIN } from "./styles"

interface DashPageProps {
  children: ReactNode
  className?: string
}

/** Standard admin page canvas — mist background, shared padding. */
export function DashPage({ children, className }: DashPageProps) {
  return <div className={cn(DASH_PAGE, className)}>{children}</div>
}

export function DashSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-[50vh] items-center justify-center", className)}>
      <div className={DASH_SPIN} />
    </div>
  )
}
