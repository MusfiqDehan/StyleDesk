export function HomeSectionSkeleton({ className = "bg-[#0b0b0b]" }: { className?: string }) {
  return (
    <section className={`${className} px-4 py-20 sm:px-6 lg:px-8`} aria-hidden>
      <div className="mx-auto w-full max-w-7xl animate-pulse space-y-6">
        <div className="mx-auto h-3 w-28 rounded bg-white/10" />
        <div className="mx-auto h-10 max-w-md rounded bg-white/10" />
        <div className="mx-auto h-4 max-w-xl rounded bg-white/5" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="aspect-[4/3] rounded bg-white/5" />
          <div className="aspect-[4/3] rounded bg-white/5" />
          <div className="aspect-[4/3] rounded bg-white/5" />
        </div>
      </div>
    </section>
  )
}
