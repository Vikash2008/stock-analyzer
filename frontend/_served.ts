import.meta.env = {"BASE_URL": "/", "DEV": true, "MODE": "development", "PROD": false, "SSR": false};import { useQueries, useQueryClient } from "/node_modules/.vite/deps/@tanstack_react-query.js?v=6d25c11d";
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=6d25c11d"; const useEffect = __vite__cjsImport1_react["useEffect"]; const useMemo = __vite__cjsImport1_react["useMemo"];
import { USD_PORTS } from "/src/utils/segments.ts?t=1781934308308";
import { computeXIRR } from "/src/utils/xirr.ts";
import { lsGet, lsSet, lsGetTimestamp, mergeHistory, CLOSED_LS_TTL, REFRESH_MS } from "/src/hooks/useHistory.ts?t=1781860211322";
const BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";
const lsKey = (sym) => `${sym}:2015-01-01`;
async function fetchSymHistory(sym, start) {
  const existing = lsGet(lsKey(sym));
  const since = existing?.dates?.[existing.dates.length - 1];
  const params = new URLSearchParams({ yf_symbol: sym, start });
  if (since) params.set("since", since);
  const r = await fetch(`${BASE}/history?${params}`);
  if (!r.ok) throw new Error(`History ${r.status}`);
  const fetched = await r.json();
  if (!fetched.dates?.length) return { dates: [], prices: [] };
  const d = fetched.partial_since && existing ? mergeHistory(existing, fetched) : fetched;
  lsSet(lsKey(sym), d);
  return d;
}
const RANGE_DAYS = {
  "1m": 30,
  "3m": 90,
  "6m": 182,
  "1y": 365,
  "2y": 730,
  "3y": 1095,
  "5y": 1825
};
export function sliceSeries(s, range) {
  if (!s.dates.length) return null;
  if (range === "All") return s;
  const cutoff = new Date(Date.now() - RANGE_DAYS[range] * 864e5);
  const i = s.dates.findIndex((d) => d >= cutoff);
  return i < 0 ? null : { dates: s.dates.slice(i), values: s.values.slice(i) };
}
export function usePortfolioHistory(holdings, transactions, realized, usdInr, currency, enabled, extraSymbols, closedSymbols, prioritySymbols) {
  const qc = useQueryClient();
  const closedSet = useMemo(() => new Set(closedSymbols ?? []), [closedSymbols]);
  const symbols = useMemo(() => {
    const all = [.../* @__PURE__ */ new Set([...holdings.map((h) => h.yf_symbol), ...extraSymbols ?? []])];
    if (!prioritySymbols?.length) return all;
    const prioritySet = new Set(prioritySymbols);
    return [...all.filter((s) => prioritySet.has(s)), ...all.filter((s) => !prioritySet.has(s))];
  }, [holdings, extraSymbols, prioritySymbols]);
  const queries = useQueries({
    queries: symbols.map((sym) => {
      const isClosed = closedSet.has(sym);
      return {
        queryKey: isClosed ? ["history-closed", sym] : ["history", sym],
        queryFn: () => fetchSymHistory(sym, "2015-01-01"),
        // Closed symbols: skip the network entirely once a still-fresh (<30 day) cache exists.
        enabled: enabled && (!isClosed || !lsGet(lsKey(sym), CLOSED_LS_TTL)),
        staleTime: isClosed ? CLOSED_LS_TTL : REFRESH_MS,
        gcTime: Infinity,
        // keep in memory for entire session
        refetchInterval: isClosed ? false : REFRESH_MS,
        refetchIntervalInBackground: false,
        retry: 2,
        retryDelay: 8e3,
        retryOnMount: false,
        // error-state queries stay counted on navigation; avoids backwards counter
        // Open symbols: seed with the real cache timestamp so staleTime is judged against
        // actual last-fetch time — on app reopen within 30min this skips the fetch entirely
        // instead of always kicking one off in the background (placeholderData's behavior).
        // Closed symbols keep placeholderData — their fetch is already gated off by `enabled`
        // above once a fresh cache exists, so there's nothing for initialData to skip.
        ...isClosed ? { placeholderData: () => lsGet(lsKey(sym), CLOSED_LS_TTL) } : {
          initialData: () => lsGet(lsKey(sym)),
          initialDataUpdatedAt: () => lsGetTimestamp(lsKey(sym))
        }
      };
    })
  });
  const openSymbolsKey = useMemo(
    () => symbols.filter((s) => !closedSet.has(s)).slice().sort().join(","),
    [symbols, closedSet]
  );
  useEffect(() => {
    if (!enabled || !openSymbolsKey) return;
    const openSymbols = openSymbolsKey.split(",");
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      for (const sym of openSymbols) {
        const state = qc.getQueryState(["history", sym]);
        const lastFetch = state?.dataUpdatedAt ?? 0;
        if (Date.now() - lastFetch >= REFRESH_MS) {
          qc.refetchQueries({ queryKey: ["history", sym], type: "active" });
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, openSymbolsKey, qc]);
  const loadedCount = queries.filter((q) => q.status === "success" || q.status === "error").length;
  const fetchingCount = queries.filter((q) => q.fetchStatus === "fetching").length;
  const isFetching = fetchingCount > 0;
  const lastFetchedAt = queries.reduce((max, q) => Math.max(max, q.dataUpdatedAt ?? 0), 0) || null;
  const hasAllData = symbols.length > 0 && queries.every((q) => q.data !== void 0 || q.status === "error");
  const isLoading = enabled && symbols.length > 0 && !hasAllData;
  const symbolPriceMap = useMemo(() => {
    if (!enabled) return /* @__PURE__ */ new Map();
    const pm = /* @__PURE__ */ new Map();
    for (let i = 0; i < symbols.length; i++) {
      const d = queries[i]?.data;
      if (!d?.dates.length) continue;
      const m = /* @__PURE__ */ new Map();
      d.dates.forEach((dt, j) => m.set(dt, d.prices[j]));
      pm.set(symbols[i], m);
    }
    return pm;
  }, [enabled, isFetching, loadedCount, symbols]);
  const series = useMemo(() => {
    if (!enabled || !holdings.length) return null;
    const priceMap = symbolPriceMap;
    if (!priceMap.size) return null;
    const dateSet = /* @__PURE__ */ new Set();
    for (const [, m] of priceMap) for (const dt of m.keys()) dateSet.add(dt);
    const allDates = [...dateSet].sort();
    if (!allDates.length) return null;
    const qtyDelta = /* @__PURE__ */ new Map();
    const firstDate = /* @__PURE__ */ new Map();
    for (const tx of transactions) {
      if (tx.type === "DIVIDEND") continue;
      const delta = tx.type === "BUY" ? tx.quantity : -tx.quantity;
      const key = `${tx.portfolio}:${tx.yf_symbol}`;
      const dateStr = tx.date.slice(0, 10);
      if (!qtyDelta.has(key)) qtyDelta.set(key, []);
      const arr = qtyDelta.get(key);
      const existing = arr.find((e) => e[0] === dateStr);
      if (existing) existing[1] += delta;
      else arr.push([dateStr, delta]);
      if (!firstDate.has(key) || dateStr < firstDate.get(key)) firstDate.set(key, dateStr);
    }
    for (const arr of qtyDelta.values()) arr.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const n = allDates.length;
    const valArr = new Array(n).fill(0);
    const invArr = new Array(n).fill(0);
    for (const h of holdings) {
      const pm = priceMap.get(h.yf_symbol);
      const key = `${h.portfolio}:${h.yf_symbol}`;
      const deltas = qtyDelta.get(key) ?? [];
      const first = firstDate.get(key) ?? allDates[0];
      const isUsd = USD_PORTS.has(h.portfolio);
      const fx = isUsd ? currency === "INR" ? usdInr : 1 : currency === "USD" ? 1 / usdInr : 1;
      const constPx = pm?.size ? null : h.current_price;
      let qty = 0;
      let di = 0;
      while (di < deltas.length && deltas[di][0] < allDates[0]) {
        qty += deltas[di][1];
        di++;
      }
      qty = Math.max(0, qty);
      let lastPx = null;
      for (let i = 0; i < n; i++) {
        const d = allDates[i];
        if (d < first) continue;
        while (di < deltas.length && deltas[di][0] <= d) {
          qty = Math.max(0, qty + deltas[di][1]);
          di++;
        }
        if (pm?.size) {
          const px = pm.get(d);
          if (px !== void 0) lastPx = px;
        } else {
          lastPx = constPx;
        }
        if (lastPx === null || qty <= 0) continue;
        valArr[i] += lastPx * qty * fx;
        invArr[i] += h.avg_cost * qty * fx;
      }
    }
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const todayFx = currency === "USD" ? 1 / usdInr : 1;
    let todayVal = 0, todayInv = 0;
    for (const h of holdings) {
      todayVal += h.disp_current * todayFx;
      todayInv += h.disp_invested * todayFx;
    }
    if (allDates.length > 0 && allDates[allDates.length - 1] === todayStr) {
      valArr[valArr.length - 1] = todayVal;
      invArr[invArr.length - 1] = todayInv;
    } else if (todayVal > 0) {
      allDates.push(todayStr);
      valArr.push(todayVal);
      invArr.push(todayInv);
    }
    const startIdx = valArr.findIndex((v) => v > 0);
    if (startIdx < 0) return null;
    const datesSlice = allDates.slice(startIdx);
    const dates = datesSlice.map((d) => new Date(d));
    const values = valArr.slice(startIdx);
    const invested = invArr.slice(startIdx);
    const unrealized = values.map((v, i) => v - invested[i]);
    const realEvts = realized.map((r) => {
      const isUsd = r.currency === "USD";
      const fx = isUsd && currency === "INR" ? usdInr : !isUsd && currency === "USD" ? 1 / usdInr : 1;
      return {
        d: r.sell_date.slice(0, 10),
        pnl: r.realized_pnl * fx,
        cost: r.type === "SELL" ? r.quantity * r.buy_price * fx : 0
      };
    }).sort((a, b) => a.d < b.d ? -1 : 1);
    const realVals = new Array(dates.length).fill(0);
    const realCostVals = new Array(dates.length).fill(0);
    let cumReal = 0, cumRealCost = 0, ri = 0;
    for (let i = 0; i < datesSlice.length; i++) {
      while (ri < realEvts.length && realEvts[ri].d <= datesSlice[i]) {
        cumReal += realEvts[ri].pnl;
        cumRealCost += realEvts[ri].cost;
        ri++;
      }
      realVals[i] = cumReal;
      realCostVals[i] = cumRealCost;
    }
    const totalVals = unrealized.map((u, i) => u + realVals[i]);
    const returnPct = totalVals.map((tg, i) => {
      const totalCost = invested[i] + realCostVals[i];
      return totalCost > 0 ? tg / totalCost * 100 : 0;
    });
    const xirrDates = [];
    const xirrVals = [];
    if (transactions.length > 0) {
      const sortedTxns = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
      const runCfs = [];
      let ti = 0;
      const now = /* @__PURE__ */ new Date();
      const t0 = new Date(sortedTxns[0].date);
      let y = t0.getFullYear(), mo = t0.getMonth();
      while (true) {
        const monthEnd = new Date(y, mo + 1, 0);
        const isCurrentPeriod = monthEnd > now;
        const me = isCurrentPeriod ? now : monthEnd;
        const meStr = me.toISOString().slice(0, 10);
        while (ti < sortedTxns.length && sortedTxns[ti].date.slice(0, 10) <= meStr) {
          const tx = sortedTxns[ti++];
          const isUsd = USD_PORTS.has(tx.portfolio);
          const fx = isUsd ? currency === "INR" ? usdInr : 1 : currency === "USD" ? 1 / usdInr : 1;
          const amt = tx.quantity * tx.price * fx;
          const chg = tx.charges * fx;
          if (tx.type === "BUY") runCfs.push({ date: new Date(tx.date), amount: -(amt + chg) });
          else if (tx.type === "SELL") runCfs.push({ date: new Date(tx.date), amount: amt - chg });
          else if (tx.type === "DIVIDEND") runCfs.push({ date: new Date(tx.date), amount: amt });
        }
        let vIdx = datesSlice.length - 1;
        while (vIdx >= 0 && datesSlice[vIdx] > meStr) vIdx--;
        if (vIdx >= 0 && values[vIdx] > 0) {
          const allCfs = [...runCfs, { date: me, amount: values[vIdx] }];
          const r = computeXIRR(allCfs);
          if (r !== null && isFinite(r) && r > -0.99 && r < 50) {
            xirrDates.push(new Date(me));
            xirrVals.push(r * 100);
          }
        }
        if (isCurrentPeriod) break;
        mo++;
        if (mo > 11) {
          mo = 0;
          y++;
        }
      }
    }
    return {
      value: { dates, values },
      invested: { dates, values: invested },
      unrealized: { dates, values: unrealized },
      realized: { dates, values: realVals },
      total: { dates, values: totalVals },
      returnPct: { dates, values: returnPct },
      xirrTrend: { dates: xirrDates, values: xirrVals }
    };
  }, [enabled, loadedCount, holdings, transactions, realized, usdInr, currency, symbols, symbolPriceMap]);
  return { series, isLoading, isFetching, loadedCount, totalCount: symbols.length, fetchingCount, symbolPriceMap, lastFetchedAt };
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZVBvcnRmb2xpb0hpc3RvcnkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXNlUXVlcmllcywgdXNlUXVlcnlDbGllbnQgfSBmcm9tICdAdGFuc3RhY2svcmVhY3QtcXVlcnknXG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZU1lbW8gfSBmcm9tICdyZWFjdCdcbmltcG9ydCB0eXBlIHsgSG9sZGluZywgVHJhbnNhY3Rpb24sIFJlYWxpemVkIH0gZnJvbSAnLi4vYXBpL3R5cGVzJ1xuaW1wb3J0IHR5cGUgeyBDdXJyZW5jeSB9IGZyb20gJy4uL0FwcCdcbmltcG9ydCB7IFVTRF9QT1JUUyB9IGZyb20gJy4uL3V0aWxzL3NlZ21lbnRzJ1xuaW1wb3J0IHsgY29tcHV0ZVhJUlIgfSBmcm9tICcuLi91dGlscy94aXJyJ1xuaW1wb3J0IHsgbHNHZXQsIGxzU2V0LCBsc0dldFRpbWVzdGFtcCwgbWVyZ2VIaXN0b3J5LCBDTE9TRURfTFNfVFRMLCBSRUZSRVNIX01TIH0gZnJvbSAnLi91c2VIaXN0b3J5J1xuXG5jb25zdCBCQVNFID0gKGltcG9ydC5tZXRhLmVudi5WSVRFX0FQSV9VUkwgPz8gJycpICsgJy9hcGknXG5cbi8vIFNhbWUga2V5IGZvcm1hdCBhcyB1c2VIaXN0b3J5LnRzL3VzZVByZWZldGNoSG9sZGluZ0NoYXJ0cyDigJQgb25lIHNoYXJlZCBjYWNoZSBwZXIgc3ltYm9sLlxuY29uc3QgbHNLZXkgPSAoc3ltOiBzdHJpbmcpID0+IGAke3N5bX06MjAxNS0wMS0wMWBcblxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hTeW1IaXN0b3J5KHN5bTogc3RyaW5nLCBzdGFydDogc3RyaW5nKSB7XG4gIGNvbnN0IGV4aXN0aW5nID0gbHNHZXQobHNLZXkoc3ltKSlcbiAgY29uc3Qgc2luY2UgPSBleGlzdGluZz8uZGF0ZXM/LltleGlzdGluZy5kYXRlcy5sZW5ndGggLSAxXVxuICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHsgeWZfc3ltYm9sOiBzeW0sIHN0YXJ0IH0pXG4gIGlmIChzaW5jZSkgcGFyYW1zLnNldCgnc2luY2UnLCBzaW5jZSlcbiAgY29uc3QgciA9IGF3YWl0IGZldGNoKGAke0JBU0V9L2hpc3Rvcnk/JHtwYXJhbXN9YClcbiAgaWYgKCFyLm9rKSB0aHJvdyBuZXcgRXJyb3IoYEhpc3RvcnkgJHtyLnN0YXR1c31gKVxuICBjb25zdCBmZXRjaGVkID0gYXdhaXQgci5qc29uKCkgYXMgeyBkYXRlczogc3RyaW5nW107IHByaWNlczogbnVtYmVyW107IHBhcnRpYWxfc2luY2U/OiBzdHJpbmcgfVxuICBpZiAoIWZldGNoZWQuZGF0ZXM/Lmxlbmd0aCkgcmV0dXJuIHsgZGF0ZXM6IFtdIGFzIHN0cmluZ1tdLCBwcmljZXM6IFtdIGFzIG51bWJlcltdIH1cbiAgY29uc3QgZCA9IGZldGNoZWQucGFydGlhbF9zaW5jZSAmJiBleGlzdGluZyA/IG1lcmdlSGlzdG9yeShleGlzdGluZywgZmV0Y2hlZCkgOiBmZXRjaGVkXG4gIGxzU2V0KGxzS2V5KHN5bSksIGQpXG4gIHJldHVybiBkXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGF0ZWRTZXJpZXMgeyBkYXRlczogRGF0ZVtdOyB2YWx1ZXM6IG51bWJlcltdIH1cblxuZXhwb3J0IGludGVyZmFjZSBQb3J0Zm9saW9TZXJpZXMge1xuICB2YWx1ZTogICAgICBEYXRlZFNlcmllc1xuICBpbnZlc3RlZDogICBEYXRlZFNlcmllc1xuICB1bnJlYWxpemVkOiBEYXRlZFNlcmllc1xuICByZWFsaXplZDogICBEYXRlZFNlcmllc1xuICB0b3RhbDogICAgICBEYXRlZFNlcmllc1xuICByZXR1cm5QY3Q6ICBEYXRlZFNlcmllc1xuICB4aXJyVHJlbmQ6ICBEYXRlZFNlcmllc1xufVxuXG5jb25zdCBSQU5HRV9EQVlTOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge1xuICAnMW0nOiAzMCwgJzNtJzogOTAsICc2bSc6IDE4MiwgJzF5JzogMzY1LCAnMnknOiA3MzAsICczeSc6IDEwOTUsICc1eSc6IDE4MjUsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzbGljZVNlcmllcyhzOiBEYXRlZFNlcmllcywgcmFuZ2U6IHN0cmluZyk6IERhdGVkU2VyaWVzIHwgbnVsbCB7XG4gIGlmICghcy5kYXRlcy5sZW5ndGgpIHJldHVybiBudWxsXG4gIGlmIChyYW5nZSA9PT0gJ0FsbCcpIHJldHVybiBzXG4gIGNvbnN0IGN1dG9mZiA9IG5ldyBEYXRlKERhdGUubm93KCkgLSBSQU5HRV9EQVlTW3JhbmdlXSAqIDg2XzQwMF8wMDApXG4gIGNvbnN0IGkgPSBzLmRhdGVzLmZpbmRJbmRleChkID0+IGQgPj0gY3V0b2ZmKVxuICByZXR1cm4gaSA8IDAgPyBudWxsIDogeyBkYXRlczogcy5kYXRlcy5zbGljZShpKSwgdmFsdWVzOiBzLnZhbHVlcy5zbGljZShpKSB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VQb3J0Zm9saW9IaXN0b3J5KFxuICBob2xkaW5nczogICAgICBIb2xkaW5nW10sXG4gIHRyYW5zYWN0aW9uczogIFRyYW5zYWN0aW9uW10sXG4gIHJlYWxpemVkOiAgICAgIFJlYWxpemVkW10sXG4gIHVzZElucjogICAgICAgIG51bWJlcixcbiAgY3VycmVuY3k6ICAgICAgQ3VycmVuY3ksXG4gIGVuYWJsZWQ6ICAgICAgIGJvb2xlYW4sXG4gIGV4dHJhU3ltYm9scz86ICAgIHN0cmluZ1tdLCAgLy8gYWRkaXRpb25hbCBzeW1ib2xzIHRvIGZldGNoIGZvciBzeW1ib2xQcmljZU1hcCAoZS5nLiBjbG9zZWQgcG9zaXRpb25zKVxuICBjbG9zZWRTeW1ib2xzPzogICBzdHJpbmdbXSwgIC8vIHN1YnNldCBvZiAoaG9sZGluZ3MgeWZfc3ltYm9scyDiiKogZXh0cmFTeW1ib2xzKSB0aGF0IGFyZSBmdWxseSBleGl0ZWRcbiAgcHJpb3JpdHlTeW1ib2xzPzogc3RyaW5nW10sICAvLyBzeW1ib2xzIGJlbG9uZ2luZyB0byB0aGUgY3VycmVudGx5IGFjdGl2ZSB2aWV3IOKAlCBmZXRjaGVkIGZpcnN0XG4pIHtcbiAgY29uc3QgcWMgPSB1c2VRdWVyeUNsaWVudCgpXG4gIGNvbnN0IGNsb3NlZFNldCA9IHVzZU1lbW8oKCkgPT4gbmV3IFNldChjbG9zZWRTeW1ib2xzID8/IFtdKSwgW2Nsb3NlZFN5bWJvbHNdKVxuXG4gIGNvbnN0IHN5bWJvbHMgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBhbGwgPSBbLi4ubmV3IFNldChbLi4uaG9sZGluZ3MubWFwKGggPT4gaC55Zl9zeW1ib2wpLCAuLi4oZXh0cmFTeW1ib2xzID8/IFtdKV0pXVxuICAgIGlmICghcHJpb3JpdHlTeW1ib2xzPy5sZW5ndGgpIHJldHVybiBhbGxcbiAgICBjb25zdCBwcmlvcml0eVNldCA9IG5ldyBTZXQocHJpb3JpdHlTeW1ib2xzKVxuICAgIC8vIFJlb3JkZXIgc28gcHJpb3JpdHkgc3ltYm9scycgcXVlcmllcyBhcmUgaXNzdWVkIGZpcnN0IOKAlCBib3RoIHRoZSBicm93c2VyJ3NcbiAgICAvLyBjb25uZWN0aW9uIHBvb2wgYW5kIHRoZSBiYWNrZW5kJ3MgY29uY3VycmVuY3kgY2FwIHRoZW4gbmF0dXJhbGx5IHNlcnZpY2UgdGhlbSBmaXJzdC5cbiAgICByZXR1cm4gWy4uLmFsbC5maWx0ZXIocyA9PiBwcmlvcml0eVNldC5oYXMocykpLCAuLi5hbGwuZmlsdGVyKHMgPT4gIXByaW9yaXR5U2V0LmhhcyhzKSldXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSByZWFjdC1ob29rcy9leGhhdXN0aXZlLWRlcHNcbiAgfSwgW2hvbGRpbmdzLCBleHRyYVN5bWJvbHMsIHByaW9yaXR5U3ltYm9sc10pXG5cbiAgY29uc3QgcXVlcmllcyA9IHVzZVF1ZXJpZXMoe1xuICAgIHF1ZXJpZXM6IHN5bWJvbHMubWFwKHN5bSA9PiB7XG4gICAgICBjb25zdCBpc0Nsb3NlZCA9IGNsb3NlZFNldC5oYXMoc3ltKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcXVlcnlLZXk6ICBpc0Nsb3NlZCA/IFsnaGlzdG9yeS1jbG9zZWQnLCBzeW1dIDogWydoaXN0b3J5Jywgc3ltXSxcbiAgICAgICAgcXVlcnlGbjogICAoKSA9PiBmZXRjaFN5bUhpc3Rvcnkoc3ltLCAnMjAxNS0wMS0wMScpLFxuICAgICAgICAvLyBDbG9zZWQgc3ltYm9sczogc2tpcCB0aGUgbmV0d29yayBlbnRpcmVseSBvbmNlIGEgc3RpbGwtZnJlc2ggKDwzMCBkYXkpIGNhY2hlIGV4aXN0cy5cbiAgICAgICAgZW5hYmxlZDogICBlbmFibGVkICYmICghaXNDbG9zZWQgfHwgIWxzR2V0KGxzS2V5KHN5bSksIENMT1NFRF9MU19UVEwpKSxcbiAgICAgICAgc3RhbGVUaW1lOiAgICBpc0Nsb3NlZCA/IENMT1NFRF9MU19UVEwgOiBSRUZSRVNIX01TLFxuICAgICAgICBnY1RpbWU6ICAgICAgIEluZmluaXR5LCAgLy8ga2VlcCBpbiBtZW1vcnkgZm9yIGVudGlyZSBzZXNzaW9uXG4gICAgICAgIHJlZmV0Y2hJbnRlcnZhbDogICAgICAgICAgICAgaXNDbG9zZWQgPyBmYWxzZSA6IFJFRlJFU0hfTVMsXG4gICAgICAgIHJlZmV0Y2hJbnRlcnZhbEluQmFja2dyb3VuZDogZmFsc2UsXG4gICAgICAgIHJldHJ5OiAgICAgICAgMixcbiAgICAgICAgcmV0cnlEZWxheTogICA4XzAwMCxcbiAgICAgICAgcmV0cnlPbk1vdW50OiBmYWxzZSwgICAgIC8vIGVycm9yLXN0YXRlIHF1ZXJpZXMgc3RheSBjb3VudGVkIG9uIG5hdmlnYXRpb247IGF2b2lkcyBiYWNrd2FyZHMgY291bnRlclxuICAgICAgICAvLyBPcGVuIHN5bWJvbHM6IHNlZWQgd2l0aCB0aGUgcmVhbCBjYWNoZSB0aW1lc3RhbXAgc28gc3RhbGVUaW1lIGlzIGp1ZGdlZCBhZ2FpbnN0XG4gICAgICAgIC8vIGFjdHVhbCBsYXN0LWZldGNoIHRpbWUg4oCUIG9uIGFwcCByZW9wZW4gd2l0aGluIDMwbWluIHRoaXMgc2tpcHMgdGhlIGZldGNoIGVudGlyZWx5XG4gICAgICAgIC8vIGluc3RlYWQgb2YgYWx3YXlzIGtpY2tpbmcgb25lIG9mZiBpbiB0aGUgYmFja2dyb3VuZCAocGxhY2Vob2xkZXJEYXRhJ3MgYmVoYXZpb3IpLlxuICAgICAgICAvLyBDbG9zZWQgc3ltYm9scyBrZWVwIHBsYWNlaG9sZGVyRGF0YSDigJQgdGhlaXIgZmV0Y2ggaXMgYWxyZWFkeSBnYXRlZCBvZmYgYnkgYGVuYWJsZWRgXG4gICAgICAgIC8vIGFib3ZlIG9uY2UgYSBmcmVzaCBjYWNoZSBleGlzdHMsIHNvIHRoZXJlJ3Mgbm90aGluZyBmb3IgaW5pdGlhbERhdGEgdG8gc2tpcC5cbiAgICAgICAgLi4uKGlzQ2xvc2VkXG4gICAgICAgICAgPyB7IHBsYWNlaG9sZGVyRGF0YTogKCkgPT4gbHNHZXQobHNLZXkoc3ltKSwgQ0xPU0VEX0xTX1RUTCkgfVxuICAgICAgICAgIDoge1xuICAgICAgICAgICAgICBpbml0aWFsRGF0YTogICAgICAgICAgKCkgPT4gbHNHZXQobHNLZXkoc3ltKSksXG4gICAgICAgICAgICAgIGluaXRpYWxEYXRhVXBkYXRlZEF0OiAoKSA9PiBsc0dldFRpbWVzdGFtcChsc0tleShzeW0pKSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgfVxuICAgIH0pLFxuICB9KVxuXG4gIC8vIE1vYmlsZSBicm93c2VycyBzdXNwZW5kIEpTIHRpbWVycyB3aGVuIHNjcmVlbiBsb2NrcyBvciBhcHAgYmFja2dyb3VuZHMg4oCUIHNhbWVcbiAgLy8gdmlzaWJpbGl0eWNoYW5nZSArIGVsYXBzZWQtY2hlY2sgcGF0dGVybiB1c2VQb3J0Zm9saW8udHMvdXNlSGlzdG9yeS50cyB1c2UuXG4gIGNvbnN0IG9wZW5TeW1ib2xzS2V5ID0gdXNlTWVtbyhcbiAgICAoKSA9PiBzeW1ib2xzLmZpbHRlcihzID0+ICFjbG9zZWRTZXQuaGFzKHMpKS5zbGljZSgpLnNvcnQoKS5qb2luKCcsJyksXG4gICAgW3N5bWJvbHMsIGNsb3NlZFNldF0sXG4gIClcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWVuYWJsZWQgfHwgIW9wZW5TeW1ib2xzS2V5KSByZXR1cm5cbiAgICBjb25zdCBvcGVuU3ltYm9scyA9IG9wZW5TeW1ib2xzS2V5LnNwbGl0KCcsJylcbiAgICBjb25zdCBoYW5kbGVWaXNpYmlsaXR5ID0gKCkgPT4ge1xuICAgICAgaWYgKGRvY3VtZW50LnZpc2liaWxpdHlTdGF0ZSAhPT0gJ3Zpc2libGUnKSByZXR1cm5cbiAgICAgIGZvciAoY29uc3Qgc3ltIG9mIG9wZW5TeW1ib2xzKSB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gcWMuZ2V0UXVlcnlTdGF0ZShbJ2hpc3RvcnknLCBzeW1dKVxuICAgICAgICBjb25zdCBsYXN0RmV0Y2ggPSBzdGF0ZT8uZGF0YVVwZGF0ZWRBdCA/PyAwXG4gICAgICAgIGlmIChEYXRlLm5vdygpIC0gbGFzdEZldGNoID49IFJFRlJFU0hfTVMpIHtcbiAgICAgICAgICBxYy5yZWZldGNoUXVlcmllcyh7IHF1ZXJ5S2V5OiBbJ2hpc3RvcnknLCBzeW1dLCB0eXBlOiAnYWN0aXZlJyB9KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCBoYW5kbGVWaXNpYmlsaXR5KVxuICAgIHJldHVybiAoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgaGFuZGxlVmlzaWJpbGl0eSlcbiAgfSwgW2VuYWJsZWQsIG9wZW5TeW1ib2xzS2V5LCBxY10pXG5cbiAgY29uc3QgbG9hZGVkQ291bnQgICA9IHF1ZXJpZXMuZmlsdGVyKHEgPT4gcS5zdGF0dXMgPT09ICdzdWNjZXNzJyB8fCBxLnN0YXR1cyA9PT0gJ2Vycm9yJykubGVuZ3RoXG4gIGNvbnN0IGZldGNoaW5nQ291bnQgPSBxdWVyaWVzLmZpbHRlcihxID0+IHEuZmV0Y2hTdGF0dXMgPT09ICdmZXRjaGluZycpLmxlbmd0aFxuICBjb25zdCBpc0ZldGNoaW5nICAgID0gZmV0Y2hpbmdDb3VudCA+IDBcbiAgLy8gUmVhbCBsYXN0LWZldGNoIHRpbWUgYWNyb3NzIGV2ZXJ5IHN5bWJvbCdzIHF1ZXJ5IChlYWNoIHNlZWRlZCB3aXRoIHRoZSBhY3R1YWwgY2FjaGVcbiAgLy8gdGltZXN0YW1wIHZpYSBpbml0aWFsRGF0YVVwZGF0ZWRBdCBhYm92ZSkg4oCUIG5vdCBcIm5vd1wiLCBzbyByZW9wZW5pbmcgdGhlIGFwcCB3aXRoIGFcbiAgLy8gY2FjaGUgdGhhdCdzIGhvdXJzIG9sZCBzaG93cyBpdHMgdHJ1ZSBhZ2UgaW5zdGVhZCBvZiBsb29raW5nIGZyZXNobHkgc3luY2VkLlxuICBjb25zdCBsYXN0RmV0Y2hlZEF0ID0gcXVlcmllcy5yZWR1Y2UoKG1heCwgcSkgPT4gTWF0aC5tYXgobWF4LCBxLmRhdGFVcGRhdGVkQXQgPz8gMCksIDApIHx8IG51bGxcbiAgLy8gXCJOb3RoaW5nIHRvIHNob3cgeWV0XCIg4oCUIHRydWUgb25seSB3aGVuIGF0IGxlYXN0IG9uZSBzeW1ib2wgaGFzIG5laXRoZXIgYSByZWFsL2NhY2hlZFxuICAvLyByZXN1bHQgbm9yIGhhcyBmaW5pc2hlZCBmYWlsaW5nLiBBIHN5bWJvbCB0aGF0IGVycm9ycyBvdXQgKG5vIGNhY2hlLCByZXRyaWVzIGV4aGF1c3RlZCDigJRcbiAgLy8gZS5nLiBhIHRyYW5zaWVudCBtb2JpbGUgbmV0d29yayBkcm9wKSBjb3VudHMgYXMgcmVzb2x2ZWQgdG9vLCBzbyBvbmUgYmFkIHN5bWJvbCBkb2Vzbid0XG4gIC8vIHdlZGdlIHRoZSBwcm9ncmVzcyBiYXIgb24gc2NyZWVuIGZvcmV2ZXI7IHRoZSBjaGFydCBqdXN0IHJlbmRlcnMgd2l0aG91dCB0aGF0IHN5bWJvbC5cbiAgY29uc3QgaGFzQWxsRGF0YSAgICA9IHN5bWJvbHMubGVuZ3RoID4gMCAmJiBxdWVyaWVzLmV2ZXJ5KHEgPT4gcS5kYXRhICE9PSB1bmRlZmluZWQgfHwgcS5zdGF0dXMgPT09ICdlcnJvcicpXG4gIGNvbnN0IGlzTG9hZGluZyAgICAgPSBlbmFibGVkICYmIHN5bWJvbHMubGVuZ3RoID4gMCAmJiAhaGFzQWxsRGF0YVxuXG4gIC8vIEJ1aWx0IGZyb20gd2hhdGV2ZXIgcXVlcmllcyBoYXZlIGRhdGEg4oCUIGFsbG93cyBzaG93aW5nIGNhY2hlZCBzZXJpZXMgd2hpbGUgcmVmZXRjaGluZ1xuICBjb25zdCBzeW1ib2xQcmljZU1hcCA9IHVzZU1lbW8oKCk6IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIG51bWJlcj4+ID0+IHtcbiAgICBpZiAoIWVuYWJsZWQpIHJldHVybiBuZXcgTWFwKClcbiAgICBjb25zdCBwbSA9IG5ldyBNYXA8c3RyaW5nLCBNYXA8c3RyaW5nLCBudW1iZXI+PigpXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzeW1ib2xzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBkID0gcXVlcmllc1tpXT8uZGF0YVxuICAgICAgaWYgKCFkPy5kYXRlcy5sZW5ndGgpIGNvbnRpbnVlXG4gICAgICBjb25zdCBtID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKVxuICAgICAgZC5kYXRlcy5mb3JFYWNoKChkdCwgaikgPT4gbS5zZXQoZHQsIGQucHJpY2VzW2pdKSlcbiAgICAgIHBtLnNldChzeW1ib2xzW2ldLCBtKVxuICAgIH1cbiAgICByZXR1cm4gcG1cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHJlYWN0LWhvb2tzL2V4aGF1c3RpdmUtZGVwc1xuICB9LCBbZW5hYmxlZCwgaXNGZXRjaGluZywgbG9hZGVkQ291bnQsIHN5bWJvbHNdKVxuXG4gIGNvbnN0IHNlcmllcyA9IHVzZU1lbW8oKCk6IFBvcnRmb2xpb1NlcmllcyB8IG51bGwgPT4ge1xuICAgIGlmICghZW5hYmxlZCB8fCAhaG9sZGluZ3MubGVuZ3RoKSByZXR1cm4gbnVsbFxuXG4gICAgY29uc3QgcHJpY2VNYXAgPSBzeW1ib2xQcmljZU1hcFxuICAgIGlmICghcHJpY2VNYXAuc2l6ZSkgcmV0dXJuIG51bGxcblxuICAgIC8vIFVuaW9uIG9mIGFsbCB0cmFkaW5nIGRhdGVzLCBzb3J0ZWRcbiAgICBjb25zdCBkYXRlU2V0ID0gbmV3IFNldDxzdHJpbmc+KClcbiAgICBmb3IgKGNvbnN0IFssIG1dIG9mIHByaWNlTWFwKSBmb3IgKGNvbnN0IGR0IG9mIG0ua2V5cygpKSBkYXRlU2V0LmFkZChkdClcbiAgICBjb25zdCBhbGxEYXRlcyA9IFsuLi5kYXRlU2V0XS5zb3J0KClcbiAgICBpZiAoIWFsbERhdGVzLmxlbmd0aCkgcmV0dXJuIG51bGxcblxuICAgIC8vIHF0eSBkZWx0YXM6IGBwb3J0Zm9saW86eWZfc3ltYm9sYCDihpIgc29ydGVkIFtkYXRlU3RyLCBuZXREZWx0YV1bXVxuICAgIGNvbnN0IHF0eURlbHRhICA9IG5ldyBNYXA8c3RyaW5nLCBbc3RyaW5nLCBudW1iZXJdW10+KClcbiAgICBjb25zdCBmaXJzdERhdGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpXG5cbiAgICBmb3IgKGNvbnN0IHR4IG9mIHRyYW5zYWN0aW9ucykge1xuICAgICAgaWYgKHR4LnR5cGUgPT09ICdESVZJREVORCcpIGNvbnRpbnVlXG4gICAgICBjb25zdCBkZWx0YSAgID0gdHgudHlwZSA9PT0gJ0JVWScgPyB0eC5xdWFudGl0eSA6IC10eC5xdWFudGl0eVxuICAgICAgY29uc3Qga2V5ICAgICA9IGAke3R4LnBvcnRmb2xpb306JHt0eC55Zl9zeW1ib2x9YFxuICAgICAgY29uc3QgZGF0ZVN0ciA9IHR4LmRhdGUuc2xpY2UoMCwgMTApXG4gICAgICBpZiAoIXF0eURlbHRhLmhhcyhrZXkpKSBxdHlEZWx0YS5zZXQoa2V5LCBbXSlcbiAgICAgIGNvbnN0IGFyciA9IHF0eURlbHRhLmdldChrZXkpIVxuICAgICAgY29uc3QgZXhpc3RpbmcgPSBhcnIuZmluZChlID0+IGVbMF0gPT09IGRhdGVTdHIpXG4gICAgICBpZiAoZXhpc3RpbmcpIGV4aXN0aW5nWzFdICs9IGRlbHRhXG4gICAgICBlbHNlIGFyci5wdXNoKFtkYXRlU3RyLCBkZWx0YV0pXG4gICAgICBpZiAoIWZpcnN0RGF0ZS5oYXMoa2V5KSB8fCBkYXRlU3RyIDwgZmlyc3REYXRlLmdldChrZXkpISkgZmlyc3REYXRlLnNldChrZXksIGRhdGVTdHIpXG4gICAgfVxuICAgIGZvciAoY29uc3QgYXJyIG9mIHF0eURlbHRhLnZhbHVlcygpKSBhcnIuc29ydCgoYSwgYikgPT4gYVswXSA8IGJbMF0gPyAtMSA6IGFbMF0gPiBiWzBdID8gMSA6IDApXG5cbiAgICBjb25zdCBuICAgICAgPSBhbGxEYXRlcy5sZW5ndGhcbiAgICBjb25zdCB2YWxBcnIgPSBuZXcgQXJyYXk8bnVtYmVyPihuKS5maWxsKDApXG4gICAgY29uc3QgaW52QXJyID0gbmV3IEFycmF5PG51bWJlcj4obikuZmlsbCgwKVxuXG4gICAgZm9yIChjb25zdCBoIG9mIGhvbGRpbmdzKSB7XG4gICAgICBjb25zdCBwbSAgICAgPSBwcmljZU1hcC5nZXQoaC55Zl9zeW1ib2wpXG4gICAgICBjb25zdCBrZXkgICAgPSBgJHtoLnBvcnRmb2xpb306JHtoLnlmX3N5bWJvbH1gXG4gICAgICBjb25zdCBkZWx0YXMgPSBxdHlEZWx0YS5nZXQoa2V5KSA/PyBbXVxuICAgICAgY29uc3QgZmlyc3QgID0gZmlyc3REYXRlLmdldChrZXkpID8/IGFsbERhdGVzWzBdXG4gICAgICBjb25zdCBpc1VzZCAgPSBVU0RfUE9SVFMuaGFzKGgucG9ydGZvbGlvKVxuICAgICAgY29uc3QgZnggICAgID0gaXNVc2QgPyAoY3VycmVuY3kgPT09ICdJTlInID8gdXNkSW5yIDogMSkgOiAoY3VycmVuY3kgPT09ICdVU0QnID8gMSAvIHVzZEluciA6IDEpXG5cbiAgICAgIC8vIEZhbGxiYWNrOiBob2xkaW5ncyB3aXRoIG5vIHlmaW5hbmNlIGhpc3RvcnkgKGUuZy4gTkFWLWJhc2VkIE1GcykgdXNlXG4gICAgICAvLyBjdXJyZW50X3ByaWNlIGFzIGEgY29uc3RhbnQgc28gdGhlIGxhc3QgY2hhcnQgcG9pbnQgbWF0Y2hlcyBzdW1tYXJ5LlxuICAgICAgY29uc3QgY29uc3RQeCA9IHBtPy5zaXplID8gbnVsbCA6IGguY3VycmVudF9wcmljZVxuXG4gICAgICAvLyBQcmUtYWNjdW11bGF0ZSBxdHkgZnJvbSB0cmFuc2FjdGlvbnMgdGhhdCBwcmVkYXRlIHRoZSBwcmljZSBoaXN0b3J5IHN0YXJ0LlxuICAgICAgLy8geWZpbmFuY2UgaGlzdG9yeSBtYXkgc3RhcnQgbGF0ZXIgdGhhbiB0aGUgZmlyc3QgQlVZIChlLmcuIDIwMTgtMDEtMDEgYnV0XG4gICAgICAvLyBmaXJzdCBCVVkgd2FzIDIwMTctMDctMjQpIOKAlCB0aG9zZSBkZWx0YXMgbmV2ZXIgYXBwZWFyIGluIGFsbERhdGVzIG90aGVyd2lzZS5cbiAgICAgIGxldCBxdHkgPSAwXG4gICAgICBsZXQgZGkgID0gMFxuICAgICAgd2hpbGUgKGRpIDwgZGVsdGFzLmxlbmd0aCAmJiBkZWx0YXNbZGldWzBdIDwgYWxsRGF0ZXNbMF0pIHsgcXR5ICs9IGRlbHRhc1tkaV1bMV07IGRpKysgfVxuICAgICAgcXR5ID0gTWF0aC5tYXgoMCwgcXR5KVxuICAgICAgbGV0IGxhc3RQeDogbnVtYmVyIHwgbnVsbCA9IG51bGxcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgY29uc3QgZCA9IGFsbERhdGVzW2ldXG4gICAgICAgIGlmIChkIDwgZmlyc3QpIGNvbnRpbnVlXG4gICAgICAgIC8vIENhdGNoIHVwIGFueSBkZWx0YXMgZGF0ZWQgb24vYmVmb3JlIGBkYCB0aGF0IGZlbGwgb24gYSBub24tdHJhZGluZyBkYXlcbiAgICAgICAgLy8gKG1hcmtldCBob2xpZGF5KSBhbmQgc28gbmV2ZXIgbGFuZGVkIGV4YWN0bHkgb24gYW4gYWxsRGF0ZXMgZW50cnkg4oCUXG4gICAgICAgIC8vIG90aGVyd2lzZSB0aGF0IEJVWS9TRUxMJ3MgZWZmZWN0IG9uIHF0eSBpcyBzaWxlbnRseSBkcm9wcGVkIGZyb20gdGhlXG4gICAgICAgIC8vIHdob2xlIHJlc3Qgb2YgdGhlIHNlcmllcywgdW5kZXJjb3VudGluZyBpbnZlc3RlZC92YWx1ZSB2cyB0aGUgbGl2ZSB0b3RhbC5cbiAgICAgICAgd2hpbGUgKGRpIDwgZGVsdGFzLmxlbmd0aCAmJiBkZWx0YXNbZGldWzBdIDw9IGQpIHsgcXR5ID0gTWF0aC5tYXgoMCwgcXR5ICsgZGVsdGFzW2RpXVsxXSk7IGRpKysgfVxuICAgICAgICBpZiAocG0/LnNpemUpIHtcbiAgICAgICAgICBjb25zdCBweCA9IHBtLmdldChkKVxuICAgICAgICAgIGlmIChweCAhPT0gdW5kZWZpbmVkKSBsYXN0UHggPSBweFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxhc3RQeCA9IGNvbnN0UHhcbiAgICAgICAgfVxuICAgICAgICBpZiAobGFzdFB4ID09PSBudWxsIHx8IHF0eSA8PSAwKSBjb250aW51ZVxuICAgICAgICB2YWxBcnJbaV0gKz0gbGFzdFB4ICAgICAqIHF0eSAqIGZ4XG4gICAgICAgIGludkFycltpXSArPSBoLmF2Z19jb3N0ICogcXR5ICogZnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBQaW4gdGhlIGxhc3QgZGF0YSBwb2ludCB0byBsaXZlIHByaWNlcyBzbyB0aGUgY2hhcnQgZW5kcG9pbnQgbWF0Y2hlcyB0aGUgc3VtbWFyeSBjYXJkLlxuICAgIC8vIHlmaW5hbmNlIGhpc3RvcnkgdXNlcyBFT0QgY2xvc2VzOyBjdXJyZW50X3ByaWNlIGlzIGxpdmUgKDMwLW1pbiBjYWNoZSkuIFRoZSBnYXAgPSBpbnRyYWRheSBtb3ZlLlxuICAgIC8vIGRpc3BfY3VycmVudC9kaXNwX2ludmVzdGVkIGFyZSBhbHdheXMgSU5SIGZyb20gdGhlIGJhY2tlbmQg4oCUIGFwcGx5IEZYIHNvIHRvZGF5IHBpbiBtYXRjaGVzXG4gICAgLy8gdGhlIHNhbWUgY3VycmVuY3kgYXMgdGhlIGhpc3RvcmljYWwgc2VyaWVzIGNvbXB1dGVkIGFib3ZlLlxuICAgIGNvbnN0IHRvZGF5U3RyID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKVxuICAgIGNvbnN0IHRvZGF5RnggID0gY3VycmVuY3kgPT09ICdVU0QnID8gMSAvIHVzZEluciA6IDFcbiAgICBsZXQgdG9kYXlWYWwgPSAwLCB0b2RheUludiA9IDBcbiAgICBmb3IgKGNvbnN0IGggb2YgaG9sZGluZ3MpIHtcbiAgICAgIHRvZGF5VmFsICs9IGguZGlzcF9jdXJyZW50ICAqIHRvZGF5RnhcbiAgICAgIHRvZGF5SW52ICs9IGguZGlzcF9pbnZlc3RlZCAqIHRvZGF5RnhcbiAgICB9XG4gICAgaWYgKGFsbERhdGVzLmxlbmd0aCA+IDAgJiYgYWxsRGF0ZXNbYWxsRGF0ZXMubGVuZ3RoIC0gMV0gPT09IHRvZGF5U3RyKSB7XG4gICAgICB2YWxBcnJbdmFsQXJyLmxlbmd0aCAtIDFdID0gdG9kYXlWYWxcbiAgICAgIGludkFycltpbnZBcnIubGVuZ3RoIC0gMV0gPSB0b2RheUludlxuICAgIH0gZWxzZSBpZiAodG9kYXlWYWwgPiAwKSB7XG4gICAgICBhbGxEYXRlcy5wdXNoKHRvZGF5U3RyKVxuICAgICAgdmFsQXJyLnB1c2godG9kYXlWYWwpXG4gICAgICBpbnZBcnIucHVzaCh0b2RheUludilcbiAgICB9XG5cbiAgICBjb25zdCBzdGFydElkeCA9IHZhbEFyci5maW5kSW5kZXgodiA9PiB2ID4gMClcbiAgICBpZiAoc3RhcnRJZHggPCAwKSByZXR1cm4gbnVsbFxuXG4gICAgY29uc3QgZGF0ZXNTbGljZSA9IGFsbERhdGVzLnNsaWNlKHN0YXJ0SWR4KVxuICAgIGNvbnN0IGRhdGVzICAgICAgPSBkYXRlc1NsaWNlLm1hcChkID0+IG5ldyBEYXRlKGQpKVxuICAgIGNvbnN0IHZhbHVlcyAgICAgPSB2YWxBcnIuc2xpY2Uoc3RhcnRJZHgpXG4gICAgY29uc3QgaW52ZXN0ZWQgICA9IGludkFyci5zbGljZShzdGFydElkeClcbiAgICBjb25zdCB1bnJlYWxpemVkID0gdmFsdWVzLm1hcCgodiwgaSkgPT4gdiAtIGludmVzdGVkW2ldKVxuXG4gICAgLy8gUmVhbGl6ZWQg4oCUIGN1bXVsYXRpdmUgYnkgc2VsbF9kYXRlOyBjb3N0IGJhc2lzIHRyYWNrZWQgZm9yIHRydWUgUmV0dXJuICVcbiAgICBjb25zdCByZWFsRXZ0cyA9IHJlYWxpemVkXG4gICAgICAubWFwKHIgPT4ge1xuICAgICAgICBjb25zdCBpc1VzZCA9IHIuY3VycmVuY3kgPT09ICdVU0QnXG4gICAgICAgIGNvbnN0IGZ4ICAgID0gaXNVc2QgJiYgY3VycmVuY3kgPT09ICdJTlInID8gdXNkSW5yIDogIWlzVXNkICYmIGN1cnJlbmN5ID09PSAnVVNEJyA/IDEgLyB1c2RJbnIgOiAxXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZDogICAgci5zZWxsX2RhdGUuc2xpY2UoMCwgMTApLFxuICAgICAgICAgIHBubDogIHIucmVhbGl6ZWRfcG5sICogZngsXG4gICAgICAgICAgY29zdDogci50eXBlID09PSAnU0VMTCcgPyByLnF1YW50aXR5ICogci5idXlfcHJpY2UgKiBmeCA6IDAsXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAuc29ydCgoYSwgYikgPT4gYS5kIDwgYi5kID8gLTEgOiAxKVxuXG4gICAgY29uc3QgcmVhbFZhbHMgICAgID0gbmV3IEFycmF5PG51bWJlcj4oZGF0ZXMubGVuZ3RoKS5maWxsKDApXG4gICAgY29uc3QgcmVhbENvc3RWYWxzID0gbmV3IEFycmF5PG51bWJlcj4oZGF0ZXMubGVuZ3RoKS5maWxsKDApXG4gICAgbGV0IGN1bVJlYWwgPSAwLCBjdW1SZWFsQ29zdCA9IDAsIHJpID0gMFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0ZXNTbGljZS5sZW5ndGg7IGkrKykge1xuICAgICAgd2hpbGUgKHJpIDwgcmVhbEV2dHMubGVuZ3RoICYmIHJlYWxFdnRzW3JpXS5kIDw9IGRhdGVzU2xpY2VbaV0pIHtcbiAgICAgICAgY3VtUmVhbCAgICAgKz0gcmVhbEV2dHNbcmldLnBubFxuICAgICAgICBjdW1SZWFsQ29zdCArPSByZWFsRXZ0c1tyaV0uY29zdFxuICAgICAgICByaSsrXG4gICAgICB9XG4gICAgICByZWFsVmFsc1tpXSAgICAgPSBjdW1SZWFsXG4gICAgICByZWFsQ29zdFZhbHNbaV0gPSBjdW1SZWFsQ29zdFxuICAgIH1cblxuICAgIGNvbnN0IHRvdGFsVmFscyA9IHVucmVhbGl6ZWQubWFwKCh1LCBpKSA9PiB1ICsgcmVhbFZhbHNbaV0pXG4gICAgY29uc3QgcmV0dXJuUGN0ID0gdG90YWxWYWxzLm1hcCgodGcsIGkpID0+IHtcbiAgICAgIGNvbnN0IHRvdGFsQ29zdCA9IGludmVzdGVkW2ldICsgcmVhbENvc3RWYWxzW2ldXG4gICAgICByZXR1cm4gdG90YWxDb3N0ID4gMCA/IHRnIC8gdG90YWxDb3N0ICogMTAwIDogMFxuICAgIH0pXG5cbiAgICAvLyBYSVJSIHRyZW5kIOKAlCBvbmUgZGF0YSBwb2ludCBwZXIgbW9udGgtZW5kXG4gICAgY29uc3QgeGlyckRhdGVzOiAgRGF0ZVtdICAgPSBbXVxuICAgIGNvbnN0IHhpcnJWYWxzOiAgIG51bWJlcltdID0gW11cblxuICAgIGlmICh0cmFuc2FjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3Qgc29ydGVkVHhucyA9IFsuLi50cmFuc2FjdGlvbnNdLnNvcnQoKGEsIGIpID0+IGEuZGF0ZS5sb2NhbGVDb21wYXJlKGIuZGF0ZSkpXG4gICAgICBjb25zdCBydW5DZnM6IHsgZGF0ZTogRGF0ZTsgYW1vdW50OiBudW1iZXIgfVtdID0gW11cbiAgICAgIGxldCB0aSA9IDBcbiAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKClcbiAgICAgIGNvbnN0IHQwICA9IG5ldyBEYXRlKHNvcnRlZFR4bnNbMF0uZGF0ZSlcbiAgICAgIGxldCB5ID0gdDAuZ2V0RnVsbFllYXIoKSwgbW8gPSB0MC5nZXRNb250aCgpXG5cbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGNvbnN0IG1vbnRoRW5kID0gbmV3IERhdGUoeSwgbW8gKyAxLCAwKSAgIC8vIGxhc3QgZGF5IG9mIHRoaXMgbW9udGhcbiAgICAgICAgY29uc3QgaXNDdXJyZW50UGVyaW9kID0gbW9udGhFbmQgPiBub3dcbiAgICAgICAgY29uc3QgbWUgICAgPSBpc0N1cnJlbnRQZXJpb2QgPyBub3cgOiBtb250aEVuZCAgIC8vIGNsYW1wIHRvIHRvZGF5IGZvciB0aGUgaW4tcHJvZ3Jlc3MgbW9udGhcbiAgICAgICAgY29uc3QgbWVTdHIgPSBtZS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKVxuXG4gICAgICAgIC8vIEFjY3VtdWxhdGUgdHJhbnNhY3Rpb25zIHVwIHRvIHRoaXMgbW9udGgtZW5kXG4gICAgICAgIHdoaWxlICh0aSA8IHNvcnRlZFR4bnMubGVuZ3RoICYmIHNvcnRlZFR4bnNbdGldLmRhdGUuc2xpY2UoMCwgMTApIDw9IG1lU3RyKSB7XG4gICAgICAgICAgY29uc3QgdHggICAgPSBzb3J0ZWRUeG5zW3RpKytdXG4gICAgICAgICAgY29uc3QgaXNVc2QgPSBVU0RfUE9SVFMuaGFzKHR4LnBvcnRmb2xpbylcbiAgICAgICAgICBjb25zdCBmeCAgICA9IGlzVXNkID8gKGN1cnJlbmN5ID09PSAnSU5SJyA/IHVzZEluciA6IDEpIDogKGN1cnJlbmN5ID09PSAnVVNEJyA/IDEgLyB1c2RJbnIgOiAxKVxuICAgICAgICAgIGNvbnN0IGFtdCAgID0gdHgucXVhbnRpdHkgKiB0eC5wcmljZSAqIGZ4XG4gICAgICAgICAgY29uc3QgY2hnICAgPSB0eC5jaGFyZ2VzICAqIGZ4XG4gICAgICAgICAgaWYgICAgICAodHgudHlwZSA9PT0gJ0JVWScpICAgICAgcnVuQ2ZzLnB1c2goeyBkYXRlOiBuZXcgRGF0ZSh0eC5kYXRlKSwgYW1vdW50OiAtKGFtdCArIGNoZykgfSlcbiAgICAgICAgICBlbHNlIGlmICh0eC50eXBlID09PSAnU0VMTCcpICAgICBydW5DZnMucHVzaCh7IGRhdGU6IG5ldyBEYXRlKHR4LmRhdGUpLCBhbW91bnQ6IGFtdCAtIGNoZyB9KVxuICAgICAgICAgIGVsc2UgaWYgKHR4LnR5cGUgPT09ICdESVZJREVORCcpIHJ1bkNmcy5wdXNoKHsgZGF0ZTogbmV3IERhdGUodHguZGF0ZSksIGFtb3VudDogYW10IH0pXG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaW5kIHBvcnRmb2xpbyB2YWx1ZSBhdCB0aGlzIG1vbnRoLWVuZCBmcm9tIHZhbHVlIHNlcmllc1xuICAgICAgICBsZXQgdklkeCA9IGRhdGVzU2xpY2UubGVuZ3RoIC0gMVxuICAgICAgICB3aGlsZSAodklkeCA+PSAwICYmIGRhdGVzU2xpY2VbdklkeF0gPiBtZVN0cikgdklkeC0tXG5cbiAgICAgICAgaWYgKHZJZHggPj0gMCAmJiB2YWx1ZXNbdklkeF0gPiAwKSB7XG4gICAgICAgICAgY29uc3QgYWxsQ2ZzID0gWy4uLnJ1bkNmcywgeyBkYXRlOiBtZSwgYW1vdW50OiB2YWx1ZXNbdklkeF0gfV1cbiAgICAgICAgICBjb25zdCByID0gY29tcHV0ZVhJUlIoYWxsQ2ZzKVxuICAgICAgICAgIGlmIChyICE9PSBudWxsICYmIGlzRmluaXRlKHIpICYmIHIgPiAtMC45OSAmJiByIDwgNTApIHtcbiAgICAgICAgICAgIHhpcnJEYXRlcy5wdXNoKG5ldyBEYXRlKG1lKSlcbiAgICAgICAgICAgIHhpcnJWYWxzLnB1c2gociAqIDEwMClcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNDdXJyZW50UGVyaW9kKSBicmVha1xuICAgICAgICBtbysrXG4gICAgICAgIGlmIChtbyA+IDExKSB7IG1vID0gMDsgeSsrIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdmFsdWU6ICAgICAgeyBkYXRlcywgdmFsdWVzIH0sXG4gICAgICBpbnZlc3RlZDogICB7IGRhdGVzLCB2YWx1ZXM6IGludmVzdGVkIH0sXG4gICAgICB1bnJlYWxpemVkOiB7IGRhdGVzLCB2YWx1ZXM6IHVucmVhbGl6ZWQgfSxcbiAgICAgIHJlYWxpemVkOiAgIHsgZGF0ZXMsIHZhbHVlczogcmVhbFZhbHMgfSxcbiAgICAgIHRvdGFsOiAgICAgIHsgZGF0ZXMsIHZhbHVlczogdG90YWxWYWxzIH0sXG4gICAgICByZXR1cm5QY3Q6ICB7IGRhdGVzLCB2YWx1ZXM6IHJldHVyblBjdCB9LFxuICAgICAgeGlyclRyZW5kOiAgeyBkYXRlczogeGlyckRhdGVzLCB2YWx1ZXM6IHhpcnJWYWxzIH0sXG4gICAgfVxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcmVhY3QtaG9va3MvZXhoYXVzdGl2ZS1kZXBzXG4gIH0sIFtlbmFibGVkLCBsb2FkZWRDb3VudCwgaG9sZGluZ3MsIHRyYW5zYWN0aW9ucywgcmVhbGl6ZWQsIHVzZEluciwgY3VycmVuY3ksIHN5bWJvbHMsIHN5bWJvbFByaWNlTWFwXSlcblxuICByZXR1cm4geyBzZXJpZXMsIGlzTG9hZGluZywgaXNGZXRjaGluZywgbG9hZGVkQ291bnQsIHRvdGFsQ291bnQ6IHN5bWJvbHMubGVuZ3RoLCBmZXRjaGluZ0NvdW50LCBzeW1ib2xQcmljZU1hcCwgbGFzdEZldGNoZWRBdCB9XG59XG4iXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsWUFBWSxzQkFBc0I7QUFDM0MsU0FBUyxXQUFXLGVBQWU7QUFHbkMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxPQUFPLE9BQU8sZ0JBQWdCLGNBQWMsZUFBZSxrQkFBa0I7QUFFdEYsTUFBTSxRQUFRLFlBQVksSUFBSSxnQkFBZ0IsTUFBTTtBQUdwRCxNQUFNLFFBQVEsQ0FBQyxRQUFnQixHQUFHLEdBQUc7QUFFckMsZUFBZSxnQkFBZ0IsS0FBYSxPQUFlO0FBQ3pELFFBQU0sV0FBVyxNQUFNLE1BQU0sR0FBRyxDQUFDO0FBQ2pDLFFBQU0sUUFBUSxVQUFVLFFBQVEsU0FBUyxNQUFNLFNBQVMsQ0FBQztBQUN6RCxRQUFNLFNBQVMsSUFBSSxnQkFBZ0IsRUFBRSxXQUFXLEtBQUssTUFBTSxDQUFDO0FBQzVELE1BQUksTUFBTyxRQUFPLElBQUksU0FBUyxLQUFLO0FBQ3BDLFFBQU0sSUFBSSxNQUFNLE1BQU0sR0FBRyxJQUFJLFlBQVksTUFBTSxFQUFFO0FBQ2pELE1BQUksQ0FBQyxFQUFFLEdBQUksT0FBTSxJQUFJLE1BQU0sV0FBVyxFQUFFLE1BQU0sRUFBRTtBQUNo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