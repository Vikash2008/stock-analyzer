export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-5 px-6">
      <div className="text-[22px] font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
        Portfolio Manager
      </div>
      <div className="flex items-center gap-2 text-slate-400 text-[13px]">
        <span className="inline-block animate-spin text-emerald-400 text-[18px]">↻</span>
        Fetching live prices…
      </div>
      <p className="text-slate-600 text-[11px] text-center max-w-[220px]">
        Backend may take up to 60s to wake up on first visit
      </p>
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
