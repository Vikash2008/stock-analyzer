import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  LineSeries,
  ColorType,
} from 'lightweight-charts'

interface DataPoint {
  date:  string
  price: number
}

interface RangePoint {
  time:  string
  price: number
}

interface Props {
  data:     DataPoint[]
  isIndian: boolean
  onClose:  () => void
}

type Mode = 'crosshair' | 'range'

export function ZoomChartOverlay({ data, isIndian, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const seriesRef    = useRef<any>(null)
  const chartRef     = useRef<any>(null)
  const modeRef      = useRef<Mode>('crosshair')
  const p1Ref        = useRef<RangePoint | null>(null)

  const [mode,   setMode]   = useState<Mode>('crosshair')
  const [point1, setPoint1] = useState<RangePoint | null>(null)
  const [point2, setPoint2] = useState<RangePoint | null>(null)

  // keep refs in sync so click handler (closure) always sees latest values
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { p1Ref.current = point1 }, [point1])

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor:  '#94a3b8',
        fontSize:   11,
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 1, // Normal — shows both lines
        vertLine: {
          color:                '#475569',
          style:                1, // Dashed
          labelBackgroundColor: '#334155',
          labelVisible:         true,
        },
        horzLine: {
          color:                '#475569',
          style:                1,
          labelBackgroundColor: '#334155',
          labelVisible:         true,
        },
      },
      leftPriceScale:  { borderColor: '#1e293b', visible: true },
      rightPriceScale: { visible: false },
      timeScale: {
        borderColor:     '#1e293b',
        timeVisible:     false,
        fixLeftEdge:     false,
        fixRightEdge:    false,
      },
      handleScale: {
        mouseWheel:           true,
        pinch:                true,
        axisPressedMouseMove: { time: true, price: true },
      },
      handleScroll: {
        mouseWheel:       true,
        pressedMouseMove: true,
        horzTouchDrag:    true,
        vertTouchDrag:    true,
      },
    })

    const series = chart.addSeries(LineSeries, {
      color:                  '#3b82f6',
      lineWidth:              2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius:  5,
      lastValueVisible:       true,
      priceLineVisible:       false,
      priceScaleId:           'left',
    })

    const lwData = data
      .filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.date))
      .map(p => ({ time: p.date as any, value: p.price }))

    series.setData(lwData)
    chart.timeScale().fitContent()

    chartRef.current  = chart
    seriesRef.current = series

    chart.subscribeClick((param: any) => {
      if (modeRef.current !== 'range') return
      if (!param.time) return
      const bar = param.seriesData?.get(series) as { value: number } | undefined
      if (!bar) return

      const clicked: RangePoint = { time: param.time as string, price: bar.value }

      if (!p1Ref.current) {
        setPoint1(clicked)
        p1Ref.current = clicked
      } else {
        setPoint2(clicked)
      }
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current  = null
      seriesRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const resetRange = () => {
    setPoint1(null)
    setPoint2(null)
    p1Ref.current = null
    seriesRef.current?.setMarkers([])
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    modeRef.current = m
    if (m === 'crosshair') resetRange()
  }

  const fmtPrice = (v: number) =>
    isIndian
      ? `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
      : `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

  const rangeResult = point1 && point2
    ? (() => {
        const pct = (point2.price - point1.price) / point1.price * 100
        return {
          pct,
          str:   `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
          color: pct >= 0 ? '#4ade80' : '#f87171',
          abs:   fmtPrice(Math.abs(point2.price - point1.price)),
        }
      })()
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '14px 16px', boxSizing: 'border-box' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Price</span>

        {/* Mode pills */}
        <div style={{ display: 'flex', gap: 4, background: '#1e293b', borderRadius: 8, padding: 2 }}>
          {(['crosshair', 'range'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                fontSize: 10, padding: '4px 12px', borderRadius: 6, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: mode === m ? (m === 'crosshair' ? '#3b82f6' : '#10b981') : 'transparent',
                color:      mode === m ? '#fff' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {m === 'crosshair' ? '✛ Crosshair' : '↔ Range'}
            </button>
          ))}
        </div>

        <button onClick={onClose} style={{ color: '#94a3b8', fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
      </div>

      {/* ── Range status bar ── */}
      <div style={{ minHeight: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        {mode === 'range' && !point1 && (
          <span style={{ fontSize: 10, color: '#475569' }}>Tap a point on the chart to start</span>
        )}
        {mode === 'range' && point1 && !point2 && (
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            📍 {point1.time} · {fmtPrice(point1.price)} — tap second point
          </span>
        )}
        {rangeResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1e293b', borderRadius: 8, padding: '5px 12px' }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>{point1!.time}</span>
            <span style={{ fontSize: 10, color: '#475569' }}>→</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>{point2!.time}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: rangeResult.color }}>{rangeResult.str}</span>
            <span style={{ fontSize: 10, color: '#475569' }}>{rangeResult.abs}</span>
            <button
              onClick={resetRange}
              style={{ fontSize: 10, color: '#475569', background: 'none', border: '1px solid #334155', borderRadius: 4, padding: '1px 6px', cursor: 'pointer' }}
            >Reset</button>
          </div>
        )}
      </div>

      {/* ── Chart ── */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  )
}
