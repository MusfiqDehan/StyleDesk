import { cn } from "@/lib/utils"
import { DASH } from "./tokens"

interface DashboardShellProps {
  children: React.ReactNode
  className?: string
}

export function DashboardShell({ children, className }: DashboardShellProps) {
  return (
    <div
      className={cn(
        "admin-page min-h-full font-sans",
        DASH.pageBg,
        "p-4 sm:p-6 md:p-8",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface DashboardSectionProps {
  children: React.ReactNode
  className?: string
  title?: string
  description?: string
}

export function DashboardSection({
  children,
  className,
  title,
  description,
}: DashboardSectionProps) {
  return (
    <section className={cn("mb-6", className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="text-base font-semibold text-[var(--brand-ink)]">{title}</h2>
          )}
          {description && (
            <p className="mt-0.5 text-sm text-[var(--brand-muted)]">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
