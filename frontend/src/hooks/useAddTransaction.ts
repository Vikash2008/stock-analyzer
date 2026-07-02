import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearDividendLocalCache } from './useDividends'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export interface AddTxnBody {
  date:       string
  symbol:     string
  exchange:   string
  type:       'BUY' | 'SELL'
  quantity:   number
  price:      number
  portfolios: string[]
  currency:   string
  charges:    number
  name:       string
  tags?:      Record<string, string>   // Bucket -> Label assignments for the new row(s)
}

export function useAddTransaction() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (body: AddTxnBody) => {
      const csvHash = localStorage.getItem('portfolio:csv:hash') ?? 'demo'
      const res = await fetch(`${BASE}/portfolio/add-txn?csv_hash=${csvHash}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }
      return res.json() as Promise<{ portfolio: object; csv: string; csv_hash: string }>
    },
    onSuccess: (data) => {
      try { localStorage.setItem('portfolio:csv', data.csv) } catch {
        // Quota exceeded — evict gemini + history caches and retry
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith('gemini:') || k.startsWith('history:')) localStorage.removeItem(k)
        }
        try { localStorage.setItem('portfolio:csv', data.csv) } catch {}
      }
      try { localStorage.setItem('portfolio:csv:hash', data.csv_hash) } catch {}
      try {
        localStorage.setItem('portfolio:csv:meta', JSON.stringify({
          name: 'portfolio.csv',
          size: data.csv.length,
          importedAt: Date.now(),
        }))
      } catch {}
      // Update portfolio query + clear stale dividends
      qc.setQueryData(['portfolio'], data.portfolio)
      clearDividendLocalCache()
      qc.invalidateQueries({ queryKey: ['dividends'] })
      // The aggregate chart (Invested/Value/Total lines) has its own 30-min staleTime and
      // was never told a transaction changed — without this it'd keep showing pre-edit
      // numbers until that timer runs out on its own.
      qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'portfolio-history' })
    },
  })
}
