// Shared chart UI states (Category 7) — previously the portfolio-level aggregate chart
// (HoldingsPage.tsx/TransactionsPage.tsx) had a developed set of these (freshness label, amber
// warning, retry state) that the holding-level PriceChart.tsx never got, and PriceChart.tsx
// itself collapsed genuinely-empty / real-error / stale-rejected into one generic message.
// One shared component now backs both chart types instead of two parallel implementations.
import type { ChartFreshness } from '../utils/incrementalMerge'

export function ChartFreshnessLabel({ freshness }: { freshness: ChartFreshness | null | undefined }) {
  if (!freshness) return null
  return (
    <div className={`text-[9px] mb-1 ${freshness.warning ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
      {freshness.label}{freshness.detail ? ` · ${freshness.detail}` : ''}
    </div>
  )
}

export function ChartErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-10 text-xs">
      <p className="text-slate-400 mb-2">Couldn't load chart.</p>
      <button
        onClick={onRetry}
        className="text-teal-700 font-semibold underline underline-offset-2 inline-block py-3 px-4 min-h-[44px]"
      >
        Tap to retry
      </button>
    </div>
  )
}

export function ChartEmptyState({ message = 'No price history available.' }: { message?: string }) {
  return (
    <div className="text-center py-10 text-slate-400 text-xs">
      {message}
    </div>
  )
}
