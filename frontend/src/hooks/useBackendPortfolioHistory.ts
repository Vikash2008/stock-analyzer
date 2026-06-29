import { useQuery } from '@tanstack/react-query'
import type { Currency } from '../App'
import type { PortfolioSeries } from './usePortfolioHistory'

interface RawResponse {
  dates:      string[]
  values:     number[]
  invested:   number[]
  unrealized: number[]
  realized:   number[]
  total:      number[]
  returnPct:  number[]
  xirrTrend:  { dates: string[]; values: number[] }
}

async function fetchPortfolioHistory(
  currency: Currency,
  portfolio?: string,
  segment?:  string,
): Promise<PortfolioSeries | null> {
  const base = import.meta.env.VITE_API_URL ?? ''
  const params = new URLSearchParams({ currency })
  if (portfolio) params.set('portfolio', portfolio)
  if (segment)   params.set('segment',   segment)

  const res = await fetch(`${base}/api/portfolio-history?${params}`)
  if (!res.ok) throw new Error(`portfolio-history ${res.status}`)
  const raw: RawResponse = await res.json()

  if (!raw.dates?.length) return null

  const dates = raw.dates.map(d => new Date(d))
  const xt    = raw.xirrTrend
  return {
    value:      { dates, values: raw.values     },
    invested:   { dates, values: raw.invested   },
    unrealized: { dates, values: raw.unrealized },
    realized:   { dates, values: raw.realized   },
    total:      { dates, values: raw.total      },
    returnPct:  { dates, values: raw.returnPct  },
    xirrTrend:  {
      dates:  xt.dates.map(d => new Date(d)),
      values: xt.values,
    },
  }
}

export function useBackendPortfolioHistory(
  currency:  Currency,
  portfolio?: string,
  segment?:  string,
  enabled = true,
) {
  return useQuery<PortfolioSeries | null>({
    queryKey:  ['portfolio-history', currency, portfolio ?? '', segment ?? ''],
    queryFn:   () => fetchPortfolioHistory(currency, portfolio, segment),
    enabled,
    staleTime: 30 * 60 * 1000,  // 30 min — matches backend cache TTL
    gcTime:    60 * 60 * 1000,
    retry:     1,
  })
}
