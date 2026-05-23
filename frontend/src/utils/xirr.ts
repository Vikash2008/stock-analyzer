export interface Cashflow { date: Date; amount: number }

export function computeXIRR(cashflows: Cashflow[]): number | null {
  if (cashflows.length < 2) return null
  const hasNeg = cashflows.some(c => c.amount < 0)
  const hasPos = cashflows.some(c => c.amount > 0)
  if (!hasNeg || !hasPos) return null

  const t0  = cashflows.reduce((m, c) => Math.min(m, c.date.getTime()), Infinity)
  const yrs = cashflows.map(c => (c.date.getTime() - t0) / (365.25 * 86_400_000))
  const ams = cashflows.map(c => c.amount)

  const npv  = (r: number) => ams.reduce((s, a, i) => s + a / (1 + r) ** yrs[i], 0)
  const dnpv = (r: number) => ams.reduce((s, a, i) => s - yrs[i] * a / (1 + r) ** (yrs[i] + 1), 0)

  // Bisection in [-0.9999, 10]
  let lo = -0.9999, hi = 10
  const flo = npv(lo), fhi = npv(hi)

  if (Math.sign(flo) !== Math.sign(fhi)) {
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2
      if (hi - lo < 1e-8) return mid
      Math.sign(npv(mid)) === Math.sign(flo) ? (lo = mid) : (hi = mid)
    }
    return (lo + hi) / 2
  }

  // Fallback: Newton's method from several starting points
  for (const guess of [0.1, 0.5, -0.3, 2.0]) {
    let r = guess
    for (let i = 0; i < 100; i++) {
      const f = npv(r), df = dnpv(r)
      if (!isFinite(f) || !isFinite(df) || df === 0) break
      const nr = r - f / df
      if (Math.abs(nr - r) < 1e-7) return isFinite(nr) ? nr : null
      r = nr
    }
  }
  return null
}
