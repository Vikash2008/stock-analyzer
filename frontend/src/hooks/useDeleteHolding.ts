import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearDividendLocalCache } from './useDividends'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export interface HoldingDeletion {
  portfolio: string
  symbol?:   string   // omitted = delete every symbol in this portfolio
  // When also given, narrows to one specific transaction row instead of the whole symbol.
  date?:     string   // YYYY-MM-DD
  type?:     string   // BUY / SELL / DIVIDEND
  quantity?: number
  price?:    number
}

export function useDeleteHolding() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (deletions: HoldingDeletion[]) => {
      const csvHash = localStorage.getItem('portfolio:csv:hash') ?? 'demo'
      const res = await fetch(`${BASE}/portfolio/delete-holding?csv_hash=${csvHash}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ deletions }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }
      return res.json() as Promise<{ portfolio: object; csv: string; csv_hash: string }>
    },
    onSuccess: (data) => {
      try { localStorage.setItem('portfolio:csv', data.csv) } catch {
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
      qc.setQueryData(['portfolio'], data.portfolio)
      clearDividendLocalCache()
      qc.invalidateQueries({ queryKey: ['dividends'] })
      // See useAddTransaction.ts — the aggregate chart's own 30-min staleTime never learns
      // about a deletion on its own, so it must be told explicitly here too.
      qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'portfolio-history' })
    },
  })
}
