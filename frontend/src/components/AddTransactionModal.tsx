import React, { useState, useEffect, useRef } from 'react'
import type { PortfolioData } from '../api/types'
import { useAddTransaction } from '../hooks/useAddTransaction'
import { SKIP_PORTS } from '../utils/segments'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

interface SearchResult { symbol: string; name: string; exchange: string }

interface Props {
  open:                 boolean
  onClose:              () => void
  data:                 PortfolioData
  preFilledSymbol?:     string
  preFilledSymbolName?: string
  preFilledExchange?:   string
  preFilledCurrency?:   string
  preFilledPortfolio?:  string
  preFilledPrice?:      number
  lockSymbol?:          boolean
}

function yfToClean(yfSym: string): string {
  return yfSym.replace(/\.(NS|BO)$/i, '').toUpperCase()
}
function toYf(sym: string, exchange: string): string {
  if (exchange === 'NSE') return `${sym}.NS`
  if (exchange === 'BSE') return `${sym}.BO`
  return sym.toUpperCase()
}

export function AddTransactionModal({
  open, onClose, data,
  preFilledSymbol, preFilledSymbolName, preFilledExchange,
  preFilledCurrency, preFilledPortfolio, preFilledPrice,
  lockSymbol = false,
}: Props) {
  const { mutate, isPending } = useAddTransaction()

  const [selSymbol,   setSelSymbol]   = useState('')
  const [selYfSymbol, setSelYfSymbol] = useState('')
  const [selName,     setSelName]     = useState('')
  const [selExchange, setSelExchange] = useState('NSE')
  const [selCurrency, setSelCurrency] = useState('INR')

  const [searchQuery,     setSearchQuery]     = useState('')
  const [suggestions,     setSuggestions]     = useState<SearchResult[]>([])
  const [isSearching,     setIsSearching]     = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [txnType,      setTxnType]      = useState<'BUY' | 'SELL'>('BUY')
  const [portfolio,    setPortfolio]    = useState('')
  const [date,         setDate]         = useState('')
  const [quantity,     setQuantity]     = useState('')
  const [price,        setPrice]        = useState('')
  const [priceLoading, setPriceLoading] = useState(false)
  const [error,        setError]        = useState('')

  const allPortfolios = data.all_portfolios.filter(p => !SKIP_PORTS.has(p))

  useEffect(() => {
    if (!open) return
    setTxnType('BUY')
    setDate(new Date().toISOString().split('T')[0])
    setQuantity('')
    setPrice(preFilledPrice != null ? String(preFilledPrice) : '')
    setSearchQuery('')
    setSuggestions([])
    setError('')
    setPortfolio(preFilledPortfolio ?? allPortfolios[0] ?? '')

    if (lockSymbol && preFilledSymbol) {
      setSelSymbol(yfToClean(preFilledSymbol))
      setSelYfSymbol(preFilledSymbol)
      setSelName(preFilledSymbolName ?? yfToClean(preFilledSymbol))
      setSelExchange(preFilledExchange ?? 'NSE')
      setSelCurrency(preFilledCurrency ?? 'INR')
    } else {
      setSelSymbol(''); setSelYfSymbol(''); setSelName('')
      setSelExchange('NSE'); setSelCurrency('INR')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selYfSymbol || lockSymbol) return
    const existing = data.holdings.find(h => h.yf_symbol === selYfSymbol)
    if (existing?.current_price) { setPrice(String(existing.current_price)); return }
    setPriceLoading(true)
    fetch(`${BASE}/quickstats?yf_symbol=${encodeURIComponent(selYfSymbol)}`)
      .then(r => r.json())
      .then(qs => { if (qs.current_price) setPrice(String(qs.current_price)) })
      .catch(() => {})
      .finally(() => setPriceLoading(false))
  }, [selYfSymbol]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lockSymbol || !searchQuery.trim()) { setSuggestions([]); setShowSuggestions(false); return }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`${BASE}/search?q=${encodeURIComponent(searchQuery)}`)
        setSuggestions(await res.json())
        setShowSuggestions(true)
      } catch {}
      setIsSearching(false)
    }, 300)
  }, [searchQuery, lockSymbol])

  function selectStock(sym: string, name: string, exchange: string) {
    const yfSym = toYf(sym, exchange)
    setSelSymbol(sym.toUpperCase()); setSelYfSymbol(yfSym); setSelName(name)
    setSelExchange(exchange); setSelCurrency(exchange === 'NSE' || exchange === 'BSE' ? 'INR' : 'USD')
    setSearchQuery(''); setSuggestions([]); setShowSuggestions(false); setPrice('')
  }

  function clearStock() {
    setSelSymbol(''); setSelYfSymbol(''); setSelName(''); setPrice(''); setSearchQuery('')
  }

  const qty   = parseFloat(quantity)
  const prc   = parseFloat(price)
  const total = qty > 0 && prc > 0 ? qty * prc : null
  const currSymbol = selCurrency === 'USD' ? '$' : '₹'

  function handleSubmit() {
    if (!selSymbol) { setError('Please select a stock.'); return }
    if (!quantity || qty <= 0) { setError('Enter a valid quantity.'); return }
    if (!price || prc <= 0) { setError('Enter a valid price.'); return }
    setError('')
    mutate(
      { date, symbol: selSymbol, exchange: selExchange, type: txnType,
        quantity: qty, price: prc, portfolios: [portfolio],
        currency: selCurrency, charges: 0, name: selName },
      { onSuccess: () => onClose() },
    )
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[200]" onClick={onClose} />

      <div
        className="fixed inset-x-3 z-[201] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-emerald-100"
        style={{ top: '5dvh', maxHeight: '90dvh', maxWidth: 460, margin: '0 auto' }}
      >
        {/* Header — emerald→teal gradient matching overview gear panel */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">Add Transaction</span>
          </div>
          <button onClick={onClose} className="text-emerald-200 active:text-white text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-white px-4 py-4 space-y-3">

          {/* Stock search */}
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3">
            <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest mb-2">Stock</p>

            {lockSymbol ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">{selSymbol}</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">{selExchange}</span>
                {selName && <span className="text-[11px] text-slate-500 truncate">{selName}</span>}
              </div>
            ) : selSymbol && !searchQuery ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-800">{selSymbol}</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">{selExchange}</span>
                {selName && <span className="text-[11px] text-slate-500 truncate flex-1">{selName}</span>}
                <button onClick={clearStock} className="text-slate-400 active:text-slate-600 shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search stocks…"
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-emerald-200 rounded-lg bg-white focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100"
                />
                {isSearching && (
                  <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 animate-pulse">Searching…</span>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 border border-emerald-200 rounded-xl bg-white shadow-lg z-10 overflow-hidden max-h-44 overflow-y-auto">
                    {suggestions.map(s => (
                      <button
                        key={s.symbol}
                        onClick={() => selectStock(s.symbol, s.name, s.exchange)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-emerald-50 transition-colors"
                      >
                        <span className="text-[11px] font-semibold text-slate-700 w-20 shrink-0">{s.symbol}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-600 rounded-full px-1.5 shrink-0">{s.exchange}</span>
                        <span className="text-[10px] text-slate-500 truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Portfolio + Type */}
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest mb-2">Portfolio</p>
                <select
                  value={portfolio}
                  onChange={e => setPortfolio(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-emerald-200 rounded-lg bg-white focus:outline-none focus:border-teal-400 text-slate-700"
                >
                  {allPortfolios.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="shrink-0">
                <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest mb-2">Type</p>
                <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                  {(['BUY', 'SELL'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTxnType(t)}
                      className={`px-4 py-1.5 text-[11px] font-bold rounded-md transition-colors ${
                        txnType === t
                          ? t === 'BUY' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-red-500 text-white shadow-sm'
                          : 'text-slate-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Date + Quantity + Price — one row */}
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest mb-2">Date</p>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-2 py-2 text-[11px] border border-emerald-200 rounded-lg bg-white focus:outline-none focus:border-teal-400"
                />
              </div>
              <div>
                <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest mb-2">Qty</p>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="any"
                  className="w-full px-2 py-2 text-[11px] border border-emerald-200 rounded-lg bg-white focus:outline-none focus:border-teal-400"
                />
              </div>
              <div>
                <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest mb-2">
                  Price {selCurrency === 'USD' ? '($)' : '(₹)'}
                </p>
                <input
                  type="number"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder={priceLoading ? '…' : '0.00'}
                  min="0"
                  step="0.01"
                  className="w-full px-2 py-2 text-[11px] border border-emerald-200 rounded-lg bg-white focus:outline-none focus:border-teal-400"
                />
              </div>
            </div>
          </div>

          {/* Total */}
          {total != null && (
            <div className="flex items-center justify-between bg-emerald-50 rounded-xl border border-emerald-100 px-4 py-2.5">
              <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest">Total</span>
              <span className="text-sm font-bold text-emerald-800">
                {currSymbol}{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-white border-t border-emerald-100 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #059669, #0d9488)' }}
          >
            {isPending ? 'Adding…' : 'Add Transaction'}
          </button>
        </div>
      </div>
    </>
  )
}
