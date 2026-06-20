import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearDividendLocalCache } from './useDividends'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export interface TagAssignment {
  portfolio: string
  symbol?:   string   // omitted = bulk push (whole portfolio); present = override one holding
  bucket:    string
  label:     string
}

export function useSetTags() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (assignments: TagAssignment[]) => {
      const csvHash = localStorage.getItem('portfolio:csv:hash') ?? 'demo'
      const res = await fetch(`${BASE}/portfolio/set-tags?csv_hash=${csvHash}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ assignments }),
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
    },
  })
}
