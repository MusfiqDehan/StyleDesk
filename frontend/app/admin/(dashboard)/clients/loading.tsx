import { DASH_PAGE } from "@admin/components/dash/styles"
export default function Loading() {
  return (
    <div className={`${DASH_PAGE} animate-pulse`}>
      <div className="mb-6">
        <div className="h-3 w-24 bg-muted rounded mb-2" />
        <div className="h-7 w-32 bg-muted rounded mb-1" />
        <div className="h-4 w-52 bg-muted rounded" />
      </div>
      <div className="bg-card rounded-xl border border-border">
        <div className="p-4 border-b border-border flex gap-3">
          <div className="h-9 flex-1 max-w-sm bg-muted rounded" />
          <div className="h-9 w-36 bg-muted rounded" />
          <div className="h-9 w-36 bg-muted rounded" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
              <div className="h-4 w-36 bg-muted rounded" />
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-28 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
