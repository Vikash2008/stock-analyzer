import { useMutation, useQueryClient } from '@tanstack/react-query'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function postSetNotes(symbol: string, notes: string, csvHash: string) {
  return fetch(`${BASE}/portfolio/set-notes?csv_hash=${csvHash}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ symbol, notes }),
  })
}

export function useSetNotes() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ symbol, notes }: { symbol: string; notes: string }) => {
      const csvHash = localStorage.getItem('portfolio:csv:hash') ?? 'demo'
      let res = await postSetNotes(symbol, notes, csvHash)

      // Same re-seed-and-retry-once fallback as useSetTags — the backend's FIFO cache only
      // keeps a capped number of distinct uploaded-CSV hashes, so a stale hash can 404 even
      // though the browser still has the full CSV in localStorage.
      if (res.status === 404) {
        const csv = localStorage.getItem('portfolio:csv')
        if (csv) {
          await fetch(`${BASE}/portfolio`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: csv })
          res = await postSetNotes(symbol, notes, csvHash)
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
    },
  })
}
