import React, { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useDividends, useForceRefreshDividends } from '../hooks/useDividends'
import type { DividendSymbol } from '../api/dividends'
import { fmtCompact, fmt } from '../utils/fmt'
import type { Currency } from '../App'

interface Props { currency: Currency; filterSymbols?: Set<string>; portfolio?: string }

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function YearChart({
  byYear,
  selectedYears,
  onToggleYear,
}: {
  byYear: Record<string, number>
  selectedYears: Set<string>
  onToggleYear: (year: string) => void
}) {
  const data = Object.entries(byYear).sort().map(([year, amount]) => ({ year, amount }))
  if (data.length === 0) return null
  const hasSel = selectedYears.size > 0
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
        <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #99f6e4', background: '#f0fdfa' }}
          formatter={(v: number) => [`₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Dividends']}
        />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }}
          onClick={(d: { year: string }) => onToggleYear(d.year)}>
          {data.map(d => (
            <Cell
              key={d.year}
              fill={hasSel ? (selectedYears.has(d.year) ? '#0d9488' : '#cbd5e1') : '#5eead4'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function MonthCalendar({
  bySymbol,
  selectedMonths,
  onToggleMonth,
}: {
  bySymbol: DividendSymbol[]
  selectedMonths: Set<number>
  onToggleMonth: (m: number) => void
}) {
  const monthSet = new Set<number>()
  bySymbol.forEach(s => s.month_pattern.forEach(m => monthSet.add(m)))
  if (monthSet.size === 0) return null

  return (
    <div className="grid grid-cols-12 gap-0.5 mt-3">
      {MONTH_LABELS.map((label, i) => {
        const month = i + 1
        const hasDivs = monthSet.has(month)
        const sel = selectedMonths.has(month)
        const cls = sel
          ? 'bg-teal-600 text-white ring-1 ring-teal-400'
          : hasDivs
          ? 'bg-teal-200 text-teal-700'
          : 'bg-slate-100 text-slate-300 cursor-default'
        return (
          <button
            key={label}
            onClick={() => hasDivs && onToggleMonth(month)}
            disabled={!hasDivs}
            className={`rounded py-1 text-center text-[9px] font-medium transition-colors ${cls} ${hasDivs ? 'active:opacity-70' : ''}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function SymbolRow({ sym, currency }: { sym: DividendSymbol; currency: Currency }) {
  const [open, setOpen] = useState(false)
  const fmtAmt = (v: number) => fmt(v, currency)

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left active:bg-teal-50"
      >
        {/* Exchange badge */}
        <span className={`shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded ${
          sym.exchange === 'NSE' ? 'bg-blue-100 text-blue-600' :
          sym.exchange === 'BSE' ? 'bg-teal-100 text-teal-600' :
          'bg-slate-100 text-slate-500'
        }`}>{sym.exchange}</span>

        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-slate-700 leading-tight">{sym.symbol}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-400 leading-tight">{sym.event_count} payment{sym.event_count !== 1 ? 's' : ''} · last {sym.last_ex_date}</span>
            {sym.yield_on_cost !== null && (
              <span className="text-[9px] font-semibold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full leading-none">
                {sym.yield_on_cost.toFixed(1)}% yield
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[13px] font-bold text-teal-600">{fmtCompact(sym.total_dividends, currency)}</p>
          {sym.projected_annual > 0 && (
            <p className="text-[10px] text-slate-400">~{fmtCompact(sym.projected_annual, currency)}/yr</p>
          )}
        </div>

        <svg className={`shrink-0 w-3 h-3 text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-teal-50/40 px-3 py-2">
          {sym.projected_annual > 0 && (
            <p className="text-[10px] text-teal-700 mb-2">
              ~{fmtAmt(sym.projected_annual)}/year projected · typically pays in{' '}
              {sym.month_pattern.map(m => MONTH_LABELS[m - 1]).join(', ')}
            </p>
          )}

          <div className="flex items-center gap-2 px-1 py-0.5 mb-1">
            <span className="text-[9px] font-semibold text-slate-400 w-[80px]">Ex-date</span>
            <span className="text-[9px] font-semibold text-slate-400 flex-1 text-right">Shares</span>
            <span className="text-[9px] font-semibold text-slate-400 w-[60px] text-right">Per share</span>
            <span className="text-[9px] font-semibold text-slate-400 w-[60px] text-right">Earned</span>
          </div>
          {sym.events.map(ev => (
            <div key={ev.ex_date} className="flex items-center gap-2 px-1 py-1 border-t border-teal-100">
              <span className="text-[10px] text-slate-500 w-[80px] tabular-nums">{ev.ex_date}</span>
              <span className="text-[10px] text-slate-600 flex-1 text-right tabular-nums">{ev.shares_held.toLocaleString()}</span>
              <span className="text-[10px] text-slate-600 w-[60px] text-right tabular-nums">
                {ev.div_currency === 'USD' ? `$${ev.div_per_share.toFixed(2)}` : `₹${ev.div_per_share.toFixed(2)}`}
              </span>
              <span className="text-[10px] font-semibold text-teal-700 w-[60px] text-right tabular-nums">
                {fmtCompact(ev.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DividendsTab({ currency, filterSymbols, portfolio }: Props) {
  const { data, isLoading, isError } = useDividends(portfolio)
  const forceRefresh = useForceRefreshDividends(portfolio)

  const [selectedYears, setSelectedYears] = useState<Set<string>>(new Set())
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const toggleYear = (y: string) => setSelectedYears(prev => {
    const n = new Set(prev); n.has(y) ? n.delete(y) : n.add(y); return n
  })
  const toggleMonth = (m: number) => setSelectedMonths(prev => {
    const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n
  })

  if (isLoading) {
    return (
      <div className="pt-4 text-center">
        <div className="animate-spin w-5 h-5 border-2 border-teal-300 border-t-teal-600 rounded-full mx-auto mb-2" />
        <p className="text-[11px] text-slate-400">Fetching dividend history…</p>
        <p className="text-[10px] text-slate-300 mt-1">First load may take ~30s</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="pt-4 text-center">
        <p className="text-[12px] text-red-400 mb-2">Could not load dividend data</p>
        <button onClick={() => forceRefresh()} className="text-[11px] text-teal-600 underline">Retry</button>
      </div>
    )
  }

  const { summary, by_symbol, by_year } = data

  const activeSymbols = filterSymbols && filterSymbols.size > 0
    ? by_symbol.filter(s => filterSymbols.has(s.symbol))
    : by_symbol

  const activeSummary = filterSymbols && filterSymbols.size > 0
    ? {
        total_dividends_inr: activeSymbols.reduce((sum, s) => sum + s.total_dividends, 0),
        dividend_count: activeSymbols.reduce((sum, s) => sum + s.event_count, 0),
        symbols_with_dividends: activeSymbols.length,
        projected_annual_inr: activeSymbols.reduce((sum, s) => sum + s.projected_annual, 0),
      }
    : summary

  const activeByYear = filterSymbols && filterSymbols.size > 0
    ? activeSymbols.reduce<Record<string, number>>((acc, s) => {
        s.events.forEach(ev => {
          const yr = ev.ex_date.slice(0, 4)
          acc[yr] = (acc[yr] ?? 0) + ev.amount
        })
        return acc
      }, {})
    : by_year

  const bestYear = useMemo(() => {
    const entries = Object.entries(activeByYear)
    if (entries.length === 0) return null
    return entries.reduce((best, curr) => curr[1] > best[1] ? curr : best)
  }, [activeByYear])

  // Year/month/search filter for the stock list
  const visibleSymbols = useMemo(() => {
    let syms = activeSymbols
    if (selectedYears.size > 0) {
      syms = syms.filter(s => s.events.some(ev => selectedYears.has(ev.ex_date.slice(0, 4))))
    }
    if (selectedMonths.size > 0) {
      syms = syms.filter(s => s.month_pattern.some(m => selectedMonths.has(m)))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      syms = syms.filter(s => s.symbol.toLowerCase().includes(q))
    }
    return syms
  }, [activeSymbols, selectedYears, selectedMonths, searchQuery])

  const hasDivs = activeSummary.total_dividends_inr > 0
  const hasFilter = selectedYears.size > 0 || selectedMonths.size > 0

  return (
    <div className="pt-2">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
          <p className="text-[10px] text-teal-600 font-medium">Total Earned</p>
          <p className="text-[18px] font-bold text-teal-700 leading-tight">
            {fmtCompact(activeSummary.total_dividends_inr, currency)}
          </p>
          <p className="text-[10px] text-teal-500 mt-0.5">{activeSummary.dividend_count} payments</p>
        </div>
        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
          <p className="text-[10px] text-teal-600 font-medium">Projected / Year</p>
          <p className="text-[18px] font-bold text-teal-700 leading-tight">
            {fmtCompact(activeSummary.projected_annual_inr, currency)}
          </p>
          <p className="text-[10px] text-teal-500 mt-0.5">~trailing 12m</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 font-medium">Stocks paying</p>
          <p className="text-[18px] font-bold text-slate-700 leading-tight">{activeSummary.symbols_with_dividends}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">of your holdings</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 font-medium">Best year</p>
          {bestYear ? (
            <>
              <p className="text-[18px] font-bold text-slate-700 leading-tight">{fmtCompact(bestYear[1], currency)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{bestYear[0]}</p>
            </>
          ) : (
            <p className="text-[18px] font-bold text-slate-700 leading-tight">—</p>
          )}
        </div>
      </div>

      {!hasDivs ? (
        <div className="text-center py-8 text-slate-400 text-[12px]">
          No dividends found in your holding periods.<br/>
          <span className="text-[10px] text-slate-300">Only stocks with dividends during dates you held them are shown.</span>
        </div>
      ) : (
        <>
          {/* Year chart + month calendar */}
          <div className="bg-white border border-slate-100 rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Year-by-year</p>
                {hasFilter && (
                  <button
                    onClick={() => { setSelectedYears(new Set()); setSelectedMonths(new Set()) }}
                    className="text-[9px] text-teal-500 underline"
                  >
                    clear filter
                  </button>
                )}
              </div>
              <button onClick={() => forceRefresh()} title="Refresh dividend data" className="text-slate-300 active:text-teal-500">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>
                </svg>
              </button>
            </div>
            <YearChart byYear={activeByYear} selectedYears={selectedYears} onToggleYear={toggleYear} />
            <p className="text-[10px] text-slate-300 text-center mt-1">Tap year or month to filter stocks below</p>
            <MonthCalendar bySymbol={activeSymbols} selectedMonths={selectedMonths} onToggleMonth={toggleMonth} />
          </div>

          {/* Search + stock list */}
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex-1">
              By stock
              {hasFilter || searchQuery ? (
                <span className="ml-1.5 text-teal-500 normal-case font-normal">({visibleSymbols.length}/{activeSymbols.length})</span>
              ) : null}
            </p>
          </div>

          {/* Search input */}
          <div className="relative mb-2">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search stock…"
              className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-slate-50 border border-slate-100 rounded-lg outline-none focus:border-teal-300 text-slate-700 placeholder:text-slate-300"
            />
          </div>

          {visibleSymbols.length === 0 ? (
            <p className="text-center text-[11px] text-slate-300 py-4">No stocks match this filter</p>
          ) : (
            visibleSymbols.map(sym => (
              <SymbolRow key={sym.yf_symbol} sym={sym} currency={currency} />
            ))
          )}
        </>
      )}
    </div>
  )
}
