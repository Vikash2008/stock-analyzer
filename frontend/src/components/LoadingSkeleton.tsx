// Pulsing skeleton shown while the initial API fetch is in-flight.
// Shape matches the PortfoliosPage card layout so there is no layout shift on load.

export function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {/* Hero card */}
      <div className="h-24 bg-slate-200 rounded-[10px]" />
      {/* Stocks / MF cards */}
      <div className="h-16 bg-slate-200 rounded-[10px]" />
      <div className="h-16 bg-slate-200 rounded-[10px]" />
      {/* Toggle row */}
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-slate-200 rounded-full" />
        <div className="h-8 w-20 bg-slate-200 rounded-full" />
      </div>
      {/* Breakdown cards */}
      <div className="h-12 bg-slate-200 rounded-[10px]" />
      <div className="h-12 bg-slate-200 rounded-[10px]" />
      <div className="h-12 bg-slate-200 rounded-[10px]" />
      <div className="h-12 bg-slate-200 rounded-[10px]" />
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center space-y-2">
      <p className="text-[#be1c1c] text-sm font-semibold">Failed to load portfolio</p>
      <p className="text-slate-500 text-xs">{message}</p>
      <p className="text-slate-400 text-xs">Check that the backend is running on port 8000</p>
    </div>
  )
}
