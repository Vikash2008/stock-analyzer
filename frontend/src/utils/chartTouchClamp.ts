// Recharts hides its Tooltip the instant a touch drag's coordinates fall outside its
// internal plot-area box (see generateCategoricalChart's `inRange` check) — so overshooting
// the first/last data point by even a pixel makes the tooltip vanish instead of sticking to
// the edge point. This clamps touchmove coordinates to the chart container's bounds (capture
// phase, before Recharts' own bubble-phase touchmove handler runs) and re-dispatches a
// corrected TouchEvent, so a drag that overshoots stays pinned on the nearest edge point.
import { useEffect, useRef } from 'react'

const CLAMPED_FLAG = '__chartTouchClamped'

function clampTouchToChart(container: HTMLElement) {
  function onTouchMoveCapture(e: TouchEvent) {
    if ((e as unknown as Record<string, boolean>)[CLAMPED_FLAG]) return
    const touch = e.touches[0]
    if (!touch) return

    const rect = container.getBoundingClientRect()
    const inset = 1
    const clampedX = Math.min(Math.max(touch.clientX, rect.left + inset), rect.right - inset)
    const clampedY = Math.min(Math.max(touch.clientY, rect.top + inset), rect.bottom - inset)
    if (clampedX === touch.clientX && clampedY === touch.clientY) return

    e.stopPropagation()
    e.preventDefault()

    try {
      const newTouch = new Touch({
        identifier: touch.identifier,
        target: touch.target,
        clientX: clampedX,
        clientY: clampedY,
        pageX: clampedX + window.scrollX,
        pageY: clampedY + window.scrollY,
      })
      const newEvent = new TouchEvent('touchmove', {
        touches: [newTouch],
        targetTouches: [newTouch],
        changedTouches: [newTouch],
        bubbles: true,
        cancelable: true,
      })
      ;(newEvent as unknown as Record<string, boolean>)[CLAMPED_FLAG] = true
      touch.target?.dispatchEvent(newEvent)
    } catch {
      // Touch/TouchEvent constructors unsupported (rare, non-Chromium WebView) — no-op,
      // falls back to Recharts' default (tooltip-vanishes-at-edge) behavior.
    }
  }

  container.addEventListener('touchmove', onTouchMoveCapture, { capture: true, passive: false })
  return () => container.removeEventListener('touchmove', onTouchMoveCapture, { capture: true })
}

// Attach to the div directly wrapping a chart's <ResponsiveContainer>.
export function useStickyChartTooltip<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!ref.current) return
    return clampTouchToChart(ref.current)
  }, [])
  return ref
}
