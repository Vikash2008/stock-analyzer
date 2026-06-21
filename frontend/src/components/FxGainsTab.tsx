import React, { useMemo, useState } from 'react'
import type { FxLot } from '../api/types'
import type { Currency } from '../App'

interface Props {
  fxLots: FxLot[]
  usdInr: number
  currency: Currency
  asOf?: string  // ISO-8601 — portfolio bundle's last-fetch time, same source as PortfoliosPage's bottom-bar timestamp
}

function getBucketKey(rate: number): string {
  const floor = Math.floor(rate / 5) * 5
  return `${floor}–${floor + 5}`
}

function getBucketFloor(rate: number): number {
  return Math.floor(rate / 5) * 5
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(d: string): string {
  const dt = new Date(d.slice(0, 10))
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} '${String(dt.getFullYear()).slice(2)}`
}

function fmtUsd(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

function fmtInr(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : '+'
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`
  return `${sign}₹${abs.toFixed(0)}`
}

function fmtUsdGain(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : '+'
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

// FX gain amounts are computed in INR (they represent the rupee value change from rate
// movement) — convert to USD for display when the app's currency toggle is USD, same as
// every other tab respects the toggle.
function fmtGain(v: number, currency: Currency, usdInr: number): string {
  return currency === 'USD' ? fmtUsdGain(v / usdInr) : fmtInr(v)
}

function fmtSyncTime(d: Date): string {
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  const dd  = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en-US', { month: 'short' })
  return `${hh}:${mm} ${dd} ${mon}`
}

export function FxGainsTab({ fxLots, usdInr, currency, asOf }: Props) {
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const [expandedHoldings, setExpandedHoldings] = useState<Set<string>>(new Set())

  const stats = useMemo(() => {
    let totalUsd = 0, totalFxGain = 0
    for (const lot of fxLots) {
      const lotUsd = lot.qty * lot.cost_usd
      totalUsd += lotUsd
      totalFxGain += lotUsd * (usdInr - lot.buy_fx_rate)
    }
    return { totalUsd, totalFxGain, count: fxLots.length }
  }, [fxLots, usdInr])

  const buckets = useMemo(() => {
    const map = new Map<string, { usd: number; fxGain: number; floorRate: number }>()
    for (const lot of fxLots) {
      const key   = getBucketKey(lot.buy_fx_rate)
      const floor = getBucketFloor(lot.buy_fx_rate)
      const lotUsd = lot.qty * lot.cost_usd
      const e = map.get(key) ?? { usd: 0, fxGain: 0, floorRate: floor }
      map.set(key, { usd: e.usd + lotUsd, fxGain: e.fxGain + lotUsd * (usdInr - lot.buy_fx_rate), floorRate: floor })
    }
    return [...map.entries()].sort((a, b) => a[1].floorRate - b[1].floorRate)
  }, [fxLots, usdInr])

  const yearMonthData = useMemo(() => {
    const map = new Map<string, Map<string, { usd: number; fxGain: number }>>()
    for (const lot of fxLots) {
      const yr  = lot.date.slice(0, 4)
      const mo  = lot.date.slice(5, 7)
      const lotUsd = lot.qty * lot.cost_usd
      if (!map.has(yr)) map.set(yr, new Map())
      const moMap = map.get(yr)!
      const e = moMap.get(mo) ?? { usd: 0, fxGain: 0 }
      moMap.set(mo, { usd: e.usd + lotUsd, fxGain: e.fxGain + lotUsd * (usdInr - lot.buy_fx_rate) })
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([yr, moMap]) => ({
        year: yr,
        months: [...moMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
          .map(([mo, d]) => ({ mo, ...d })),
      }))
  }, [fxLots, usdInr])

  const holdings = useMemo(() => {
    const map = new Map<string, { symbol: string; totalUsd: number; fxWeightUsd: number; fxGain: number }>()
    for (const lot of fxLots) {
      const lotUsd = lot.qty * lot.cost_usd
      const e = map.get(lot.symbol) ?? { symbol: lot.symbol, totalUsd: 0, fxWeightUsd: 0, fxGain: 0 }
      map.set(lot.symbol, {
        symbol:     lot.symbol,
        totalUsd:   e.totalUsd + lotUsd,
        fxWeightUsd: e.fxWeightUsd + lotUsd * lot.buy_fx_rate,
        fxGain:     e.fxGain + lotUsd * (usdInr - lot.buy_fx_rate),
      })
    }
    return [...map.values()]
      .map(h => ({ ...h, avgBuyRate: h.totalUsd > 0 ? h.fxWeightUsd / h.totalUsd : 1 }))
      .sort((a, b) => b.fxGain - a.fxGain)
  }, [fxLots, usdInr])

  if (fxLots.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        No USD open lots found.
      </div>
    )
  }

  const maxBucketUsd = Math.max(...buckets.map(([, b]) => b.usd))

  return (
    <div className="space-y-4 pb-4">

      {/* Section 1: Summary strip */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">FX Conversion Gains</p>
          {asOf && <span className="text-[9px] text-teal-600/70 whitespace-nowrap">Rate as of {fmtSyncTime(new Date(asOf))}</span>}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">Total FX Gain</p>
            <p className="text-[15px] font-bold text-teal-700">{fmtGain(stats.totalFxGain, currency, usdInr)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">Current Rate</p>
            <p className="text-[15px] font-bold text-slate-700">₹{usdInr.toFixed(2)}<span className="text-[10px] font-normal text-slate-400">/USD</span></p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">USD Invested</p>
            <p className="text-[13px] font-semibold text-slate-700">{fmtUsd(stats.totalUsd)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">Open Lots</p>
            <p className="text-[13px] font-semibold text-slate-700">{stats.count}</p>
          </div>
        </div>
      </div>

      {/* Section 2: Rate buckets */}
      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Rate Buckets (INR/USD)</p>
        <div className="space-y-2.5">
          {buckets.map(([key, b]) => {
            const barPct = maxBucketUsd > 0 ? b.usd / maxBucketUsd * 100 : 0
            return (
              <div key={key}>
                <div className="flex items-center mb-0.5">
                  <span className="text-[10px] font-medium text-slate-600 w-[54px]">₹{key}</span>
                  <span className="text-[10px] text-slate-400 flex-1">{fmtUsd(b.usd)}</span>
                  <span className="text-[10px] font-semibold text-teal-700">{fmtGain(b.fxGain, currency, usdInr)}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${barPct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 3: Year / Month timeline */}
      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Timeline</p>
        <div className="space-y-2">
          {yearMonthData.map(({ year, months }) => {
            const isOpen  = expandedYears.has(year)
            const yrUsd   = months.reduce((s, m) => s + m.usd, 0)
            const yrFx    = months.reduce((s, m) => s + m.fxGain, 0)
            return (
              <div key={year} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 text-left active:opacity-60"
                  onClick={() => setExpandedYears(prev => {
                    const next = new Set(prev)
                    next.has(year) ? next.delete(year) : next.add(year)
                    return next
                  })}
                >
                  <span className="text-[11px] font-semibold text-slate-700">{year}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400">{fmtUsd(yrUsd)}</span>
                    <span className="text-[10px] font-semibold text-teal-700">{fmtGain(yrFx, currency, usdInr)}</span>
                    <span className="text-[10px] text-slate-300">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50">
                    {months.map(m => (
                      <div key={m.mo} className="flex items-center px-3 py-1.5 border-b border-slate-100 last:border-0">
                        <span className="text-[10px] text-slate-600 w-[40px]">{MONTHS[parseInt(m.mo, 10) - 1]}</span>
                        <span className="text-[10px] text-slate-400 flex-1">{fmtUsd(m.usd)}</span>
                        <span className="text-[10px] font-medium text-teal-700">{fmtGain(m.fxGain, currency, usdInr)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 4: Per-holding accordion */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div className="px-3 py-2 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Per Holding</p>
        </div>
        <div className="divide-y divide-slate-100">
          {holdings.map(h => {
            const isOpen = expandedHoldings.has(h.symbol)
            const lots = fxLots
              .filter(l => l.symbol === h.symbol)
              .sort((a, b) => a.date.localeCompare(b.date))
            return (
              <div key={h.symbol}>
                {/* Header row — tap to expand */}
                <button
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left active:opacity-60"
                  onClick={() => setExpandedHoldings(prev => {
                    const next = new Set(prev)
                    next.has(h.symbol) ? next.delete(h.symbol) : next.add(h.symbol)
                    return next
                  })}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-700">{h.symbol.replace(/\.(NS|BO)$/i, '')}</span>
                    <span className="text-[10px] text-slate-400">{lots.length} lot{lots.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold ${h.fxGain >= 0 ? 'text-teal-700' : 'text-red-500'}`}>{fmtGain(h.fxGain, currency, usdInr)}</span>
                    <span className="text-[10px] text-slate-300">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Expanded lot table */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {/* Column headers */}
                    <div className="grid grid-cols-[90px_40px_52px_44px_1fr] gap-x-1 px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Date</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase text-right">Shares</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase text-right">USD</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase text-right">Rate</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase text-right">FX Gain</span>
                    </div>
                    {/* Lot rows */}
                    {lots.map((lot, i) => {
                      const lotUsd    = lot.qty * lot.cost_usd
                      const lotFxGain = lotUsd * (usdInr - lot.buy_fx_rate)
                      return (
                        <div key={i} className="grid grid-cols-[90px_40px_52px_44px_1fr] gap-x-1 px-3 py-2 border-b border-slate-100 last:border-0 bg-white">
                          <span className="text-[10px] text-slate-500">{fmtDate(lot.date)}</span>
                          <span className="text-[10px] text-slate-600 text-right tabular-nums">{lot.qty % 1 === 0 ? lot.qty : lot.qty.toFixed(3)}</span>
                          <span className="text-[10px] text-slate-600 text-right tabular-nums">{fmtUsd(lotUsd)}</span>
                          <span className="text-[10px] text-slate-600 text-right tabular-nums">₹{lot.buy_fx_rate.toFixed(1)}</span>
                          <span className={`text-[10px] font-medium text-right tabular-nums ${lotFxGain >= 0 ? 'text-teal-700' : 'text-red-500'}`}>{fmtGain(lotFxGain, currency, usdInr)}</span>
                        </div>
                      )
                    })}
                    {/* Total row */}
                    <div className="grid grid-cols-[90px_40px_52px_44px_1fr] gap-x-1 px-3 py-2 bg-teal-50 border-t border-teal-100">
                      <span className="text-[10px] font-bold text-slate-600 col-span-4">Total</span>
                      <span className={`text-[10px] font-bold text-right tabular-nums ${h.fxGain >= 0 ? 'text-teal-700' : 'text-red-500'}`}>{fmtGain(h.fxGain, currency, usdInr)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
