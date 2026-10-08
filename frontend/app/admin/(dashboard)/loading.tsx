import { DashboardPageSkeleton } from "@admin/components/dash/states"
import { DASH_PAGE } from "@admin/components/dash/styles"

export default function Loading() {
  return (
    <div className={DASH_PAGE}>
      <DashboardPageSkeleton />
    </div>
  )
}
