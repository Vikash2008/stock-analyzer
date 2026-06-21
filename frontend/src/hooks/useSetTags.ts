import { useMutation, useQueryClient } from '@tanstack/react-query'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export interface TagAssignment {
  portfolio: string
  symbol?:   string   // omitted = bulk push (whole portfolio); present = override one holding
  bucket:    string
  label:     string
}

async function postSetTags(assignments: TagAssignment[], csvHash: string) {
  return fetch(`${BASE}/portfolio/set-tags?csv_hash=${csvHash}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ assignments }),
  })
}

export function useSetTags() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (assignments: TagAssignment[]) => {
      const csvHash = localStorage.getItem('portfolio:csv:hash') ?? 'demo'
      let res = await postSetTags(assignments, csvHash)

      // The backend's FIFO cache only keeps a capped number of distinct uploaded-CSV hashes —
      // a long editing session (many Bucket/Label/delete actions, each minting a new content
      // hash) can evict the current one between actions, turning this into a dead-end "re-import
      // your CSV" error even though the browser still has the full CSV in localStorage. Re-seed
      // the backend from that local copy and retry once instead of surfacing a hard failure.
      if (res.status === 404) {
        const csv = localStorage.getItem('portfolio:csv')
        if (csv) {
          await fetch(`${BASE}/portfolio`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: csv })
          res = await postSetTags(assignments, csvHash)
        }
      }

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
      // Tag/bucket assignment never changes quantities or the symbol set, so dividend
      // totals can't change here — unlike useAddTransaction/useDeleteHolding, this never
      // needs to invalidate the dividends cache.
    },
  })
}
