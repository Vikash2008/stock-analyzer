import { useState, useEffect } from 'react'

export function LoadingSkeleton() {
  const [progress, setProgress] = useState(0)
  const [overtime, setOvertime] = useState(false)

  useEffect(() => {
    const TICK_MS = 500
    const TICKS   = 150          // 150 × 500ms = 75s
    const step    = 100 / TICKS  // ~0.667 per tick

    const id = setInterval(() => {
      setProgress(prev => {
        const next = prev + step
        if (next >= 100) {
          clearInterval(id)
          setOvertime(true)
          return 100
        }
        return next
      })
    }, TICK_MS)

    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-5 px-6">
      <div className="text-[22px] font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
        Portfolio Manager
      </div>
      <div className="flex items-center gap-2 text-slate-400 text-[13px]">
        <span className="inline-block animate-spin text-emerald-400 text-[18px]">↻</span>
        {overtime ? 'Taking a bit more time…' : 'Fetching live prices…'}
      </div>
      <div className="w-full max-w-[260px]">
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center space-y-2">
      <p className="text-[#be1c1c] text-sm font-semibold">Failed to load portfolio</p>
      <p className="text-slate-500 text-xs">{message}</p>
      <p className="text-slate-400 text-xs">The server may be waking up — wait ~60s and refresh the page</p>
    </div>
  )
}
