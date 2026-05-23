import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePortfolio } from '../hooks/usePortfolio'
import { HoldingCard } from '../components/HoldingCard'
import { SummaryCard } from '../components/SummaryCard'
import { LoadingSkeleton, ErrorState } from '../components/LoadingSkeleton'
import { aggRealized, realizedForPorts } from '../utils/realized'
import { filterBySegment, SKIP_PORTS, SEGMENT_LABELS, USD_PORTS } from '../utils/segments'
import type { Holding } from '../api/types'
import type { Currency } from '../App'

interface Props { currency: Currency }

interface CardRow {
  key:       string
  ticker:    string
  subLabel:  string
  current:   number
  invested:  number
  realGain:  number
  realCost:  number
  todayGain: number | null
  todayPct:  number | null
  ltp:       number | null
  navPort:   string
  navSym:    string
}

function buildRows(
  holdings: Holding[],
  realizedMap: ReturnType<typeof aggRealized>,
  mode: 'cumulative' | 'standalone',
  hasSegment: boolean,
): CardRow[] {
  if (!hasSegment || mode === 'standalone') {
    // One card per (portfolio, symbol) row
    return holdings
      .map(h => {
        const [rg, rc] = realizedMap.get(`${h.portfolio}:${h.symbol}`) ?? [0, 0]
        return {
          key:      `${h.portfolio}:${h.symbol}`,
          ticker:   h.symbol,
          subLabel: mode === 'standalone' ? h.portfolio : (h.company ?? ''),
          current:  h.disp_current,
          invested: h.disp_invested,
          realGain: rg, realCost: rc,
          todayGain: h.disp_today_gain,
          todayPct:  h.today_pct,
          ltp:      h.current_price,
          navPort:  h.portfolio,
          navSym:   h.symbol,
        }
      })
      .sort((a, b) => b.current - a.current)
  }

  // Cumulative: group by symbol, aggregate across portfolios
  const map = new Map<string, CardRow>()
  for (const h of holdings) {
    const [rg, rc] = realizedMap.get(`${h.portfolio}:${h.symbol}`) ?? [0, 0]
    const existing = map.get(h.symbol)
    if (!existing) {
      map.set(h.symbol, {
        key:      h.symbol,
        ticker:   h.symbol,
        subLabel: h.company ?? '',
        current:  h.disp_current,
        invested: h.disp_invested,
        realGain: rg, realCost: rc,
        todayGain: h.disp_today_gain,
        todayPct:  null,
        ltp:      h.current_price,
        navPort:  h.portfolio,
        navSym:   h.symbol,
      })
    } else {
      existing.current   += h.disp_current
      existing.invested  += h.disp_invested
      existing.realGain  += rg
      existing.realCost  += rc
      if (h.disp_today_gain !== null) {
        existing.todayGain = (existing.todayGain ?? 0) + h.disp_today_gain
      }
    }
  }

  // Recompute todayPct for cumulative rows
  return [...map.values()]
    .map(r => {
      const prior = r.current - (r.todayGain ?? 0)
      return { ...r, todayPct: (r.todayGain !== null && prior !== 0) ? (r.todayGain / prior) * 100 : null }
    })
    .sort((a, b) => b.current - a.current)
}

export default function HoldingsPage({ currency }: Props) {
  const navigate = useNavigate()
  const { portfolio, segment } = useParams<{ portfolio?: string; segment?: string }>()
  const { data, isLoading, error } = usePortfolio(currency)
  const [viewMode, setViewMode] = useState<'cumulative' | 'standalone'>('cumulative')
  const [activeTab, setActiveTab] = useState<'holdings' | 'charts'>('holdings')

  const realizedMap = useMemo(
    () => (data ? aggRealized(data.realized, data.usd_inr) : new Map()),
    [data],
  )

  const filteredHoldings = useMemo(() => {
    if (!data) return []
    let h = data.holdings.filter(r => !SKIP_PORTS.has(r.portfolio))
    if (portfolio) h = h.filter(r => r.portfolio === portfolio)
    else if (segment) h = filterBySegment(h, segment)
    return h
  }, [data, portfolio, segment])

  const summaryStats = useMemo(() => {
    const cur  = filteredHoldings.reduce((s, h) => s + h.disp_current,  0)
    const inv  = filteredHoldings.reduce((s, h) => s + h.disp_invested, 0)
    const tg   = filteredHoldings
      .filter(h => h.disp_today_gain !== null)
      .reduce((s, h) => s + (h.disp_today_gain ?? 0), 0)
    const prior = cur - tg
    const ports = new Set(filteredHoldings.map(h => h.portfolio))
    const [rg, rc] = realizedForPorts(realizedMap, ports)
    return {
      cur, inv, tg,
      todayPct: prior !== 0 ? (tg / prior) * 100 : null,
      realGain: rg, realCost: rc,
    }
  }, [filteredHoldings, realizedMap])

  const rows = useMemo(
    () => buildRows(filteredHoldings, realizedMap, viewMode, !!segment),
    [filteredHoldings, realizedMap, viewMode, segment],
  )

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <ErrorState message={(error as Error)?.message ?? 'Unknown error'} />
  if (!filteredHoldings.length) {
    return (
      <div className="max-w-xl mx-auto px-4 py-4">
        <button onClick={() => navigate('/')} className="text-[11px] text-[#2563eb] mb-4">
          ← All Portfolios
        </button>
        <p className="text-slate-500 text-sm">No holdings found.</p>
      </div>
    )
  }

  const isUsd  = portfolio ? USD_PORTS.has(portfolio) : false
  const label  = portfolio ?? SEGMENT_LABELS[segment ?? ''] ?? 'Holdings'
  const backLabel = segment ? '← Overview' : '← All Portfolios'

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      {/* Back */}
      <button onClick={() => navigate('/')} className="text-[11px] text-[#2563eb] mb-3">
        {backLabel}
      </button>

      {/* Summary card */}
      <SummaryCard
        label={label}
        current={summaryStats.cur}
        invested={summaryStats.inv}
        realGain={summaryStats.realGain}
        realCost={summaryStats.realCost}
        todayGain={summaryStats.tg || null}
        todayPct={summaryStats.todayPct}
        currency={currency}
      />

      {/* Tabs */}
      <div className="flex gap-3 mb-3 border-b border-slate-200">
        {(['holdings', 'charts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[11px] pb-1.5 capitalize font-medium transition-colors ${
              activeTab === tab
                ? 'text-[#2563eb] border-b-2 border-[#2563eb]'
                : 'text-slate-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'holdings' && (
        <>
          {/* Cumulative / Standalone toggle — segment view only */}
          {segment && (
            <div className="flex gap-2 mb-3">
              {(['cumulative', 'standalone'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`text-[10px] px-3 py-0.5 rounded-full border transition-colors capitalize ${
                    viewMode === m
                      ? 'bg-[#2563eb] text-white border-[#2563eb]'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          <p className="text-[9px] text-slate-400 mb-2">{rows.length} holdings</p>

          <div className="space-y-2">
            {rows.map(r => (
              <HoldingCard
                key={r.key}
                ticker={r.ticker}
                subLabel={r.subLabel}
                current={r.current}
                invested={r.invested}
                realGain={r.realGain}
                realCost={r.realCost}
                todayGain={r.todayGain}
                todayPct={r.todayPct}
                ltp={r.ltp}
                currency={isUsd ? 'USD' : currency}
                onClick={() => navigate(`/transactions/${encodeURIComponent(r.navPort)}/${encodeURIComponent(r.navSym)}`)}
              />
            ))}
          </div>
        </>
      )}

      {activeTab === 'charts' && (
        <div className="text-slate-400 text-xs text-center py-8">
          Summary charts — Phase 4
        </div>
      )}
    </div>
  )
}
