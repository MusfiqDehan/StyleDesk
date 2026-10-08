import { DashboardLayout } from "@admin/components/dashboard-layout"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      <div className="contents">
        {children}
      </div>
    </DashboardLayout>
  )
}
