import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { parseTags } from '../utils/buckets'
import type { Holding } from '../api/types'

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

const RECONCILE_KEY_PREFIX = 'portfolio:tags:reconciled:'

// Tags live on each portfolio's own row for a symbol, not globally per symbol — adding an
// already-held symbol to a second/third portfolio previously got no tags copied onto that new
// row at all (AddTransactionModal.tsx hid the tag-picker UI on the false assumption the symbol
// was "already classified", but never actually copied the classification across). That left the
// new row Unassigned in every Bucket/Label view, silently excluding it from combined-view totals
// (e.g. HoldingCard undercounting a symbol relative to TransactionsPage's per-symbol total, which
// isn't Bucket/Label-scoped). Fixed going forward in AddTransactionModal.tsx; this repairs
// existing affected rows by finding, per symbol, whichever tags ANY of its rows already carry,
// and copying them onto sibling rows of the same symbol that are missing them.
function computeTagBackfill(holdings: Holding[]): TagAssignment[] {
  const canonicalBySymbol = new Map<string, Record<string, string>>()
  for (const h of holdings) {
    const tags = parseTags(h.tags)
    const canonical = canonicalBySymbol.get(h.symbol) ?? {}
    for (const [bucket, label] of Object.entries(tags)) {
      if (!canonical[bucket]) canonical[bucket] = label
    }
    canonicalBySymbol.set(h.symbol, canonical)
  }
  const assignments: TagAssignment[] = []
  for (const h of holdings) {
    const canonical = canonicalBySymbol.get(h.symbol)
    if (!canonical) continue
    const ownTags = parseTags(h.tags)
    for (const [bucket, label] of Object.entries(canonical)) {
      if (!ownTags[bucket]) assignments.push({ portfolio: h.portfolio, symbol: h.symbol, bucket, label })
    }
  }
  return assignments
}

// One-shot self-heal, gated per csv_hash (localStorage) so it never repeats once a CSV's
// holdings are consistent — only real uploaded CSVs (csvHash truthy) are touched, never demo.
export function useAutoReconcileTags(holdings: Holding[] | undefined, csvHash: string | undefined) {
  const { mutate } = useSetTags()
  const checkedRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!holdings?.length || !csvHash || checkedRef.current === csvHash) return
    checkedRef.current = csvHash
    const doneKey = RECONCILE_KEY_PREFIX + csvHash
    if (localStorage.getItem(doneKey)) return
    const assignments = computeTagBackfill(holdings)
    if (!assignments.length) {
      try { localStorage.setItem(doneKey, '1') } catch {}
      return
    }
    mutate(assignments, {
      onSuccess: () => { try { localStorage.setItem(doneKey, '1') } catch {} },
    })
  }, [holdings, csvHash, mutate])
}
