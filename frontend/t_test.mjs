// T category test cases — Transactions page
// T-SUMMARY-1: Overview current value matches API disp_current
// T-SUMMARY-2: Overview total gain (unrealized + realized) matches API
// T-SUMMARY-3: Overview today gain matches API disp_today_gain
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const API  = 'http://localhost:8000';
const SKIP_PORTS = ['Equity', 'MF_Portfolio'];

function parseVal(s) {
  if (!s) return null;
  s = s.replace(/[₹$,\s]/g,'').replace(/^\+/,'').replace(/^−/,'-').replace(/^-−/,'-');
  const m = s.match(/^-?[\d.]+([CLKclk]r?)?/);
  if (!m) return null;
  let part = m[0], mult = 1;
  if (part.endsWith('Cr'))      { mult = 1e7; part = part.slice(0,-2); }
  else if (part.endsWith('L')) { mult = 1e5; part = part.slice(0,-1); }
  else if (part.endsWith('K')) { mult = 1e3; part = part.slice(0,-1); }
  const n = parseFloat(part);
  return isNaN(n) ? null : n * mult;
}
function close(a, b, tol=0.03) {
  if (a == null || b == null) return false;
  const avg = (Math.abs(a) + Math.abs(b)) / 2 || 1;
  return Math.abs(a-b) / avg <= tol;
}
function pass(id, msg) { console.log('PASS ' + id + ': ' + msg); }
function fail(id, msg) { console.log('FAIL ' + id + ': ' + msg); }
function warn(id, msg) { console.log('WARN ' + id + ': ' + msg); }

// ── Step 1: Get all portfolio data from API ───────────────────────────────────
const portData = await fetch(`${API}/api/portfolio?currency=INR`).then(r => r.json());

// Build realized gain map: { "portfolio:symbol" -> total_realized_pnl }
const realizedMap = {};
for (const r of (portData.realized || [])) {
  const key = r.portfolio + ':' + r.symbol;
  realizedMap[key] = (realizedMap[key] || 0) + r.realized_pnl;
}

// Open non-SKIP holdings
const holdings = (portData.holdings || [])
  .filter(h => h.quantity > 0 && !SKIP_PORTS.includes(h.portfolio));

console.log(`\nTotal open non-SKIP holdings: ${holdings.length}`);
console.log('Testing T-SUMMARY-1, T-SUMMARY-2, T-SUMMARY-3\n');

// ── Step 2: Launch browser ────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 430, height: 932 });

// Warm up — load root so React + portfolio data caches
await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);

// ── Step 3: Test each holding ─────────────────────────────────────────────────
// Sort by current value desc; test first 8 to cover variety
const toTest = [...holdings].sort((a,b) => b.disp_current - a.disp_current).slice(0, 8);

let passCount = 0, failCount = 0, warnCount = 0;

for (const h of toTest) {
  const key     = h.portfolio + ':' + h.symbol;
  const realized = realizedMap[key] || 0;
  const apiCurrent   = h.disp_current;
  const apiTotalGain = h.disp_gain + realized;
  const apiTodayGain = h.disp_today_gain;

  const cleanSym = h.yf_symbol.replace(/\.(NS|BO)$/, '');
  const txUrl    = `${BASE}/transactions/${encodeURIComponent(h.portfolio)}/${encodeURIComponent(cleanSym)}`;

  console.log(`\n── ${h.portfolio} / ${cleanSym} ──`);
  console.log(`  API current=₹${Math.round(apiCurrent).toLocaleString()}  totalGain=₹${Math.round(apiTotalGain).toLocaleString()}  today=₹${Math.round(apiTodayGain||0).toLocaleString()}`);

  await page.goto(txUrl, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);

  const lines = await page.evaluate(() =>
    document.body.innerText.split('\n').map(l => l.trim()).filter(l => l)
  );

  // Current value: line immediately after the line starting with "LTP"
  const ltpIdx = lines.findIndex(l => l.startsWith('LTP'));
  const uiCurrentStr = ltpIdx >= 0 ? lines[ltpIdx + 1] : null;
  const uiCurrent = parseVal(uiCurrentStr);

  // Today gain: line after "Today" label
  const todayLblIdx = lines.findIndex(l => l === 'Today');
  const uiTodayStr = todayLblIdx >= 0 ? lines[todayLblIdx + 1] : null;
  const uiToday = parseVal(uiTodayStr);

  // Unrealized total: line after "Total" label
  const totalLblIdx = lines.findIndex(l => l === 'Total');
  const uiUnrealStr = totalLblIdx >= 0 ? lines[totalLblIdx + 1] : null;
  const uiUnreal = parseVal(uiUnrealStr);

  // Realized: line starting with "Realized"
  const realizedLine = lines.find(l => l.startsWith('Realized'));
  const uiRealStr = realizedLine ? realizedLine.replace(/^Realized\s*/,'') : null;
  const uiReal = parseVal(uiRealStr) || 0;

  const uiTotalGain = uiUnreal != null ? uiUnreal + uiReal : null;

  console.log(`  UI  current=${uiCurrentStr}  total=${uiUnrealStr}  realized=${uiRealStr}  today=${uiTodayStr}`);

  // ── T-SUMMARY-1: current ──
  const id1 = `T-SUMMARY-1[${h.portfolio}/${cleanSym}]`;
  if (uiCurrent == null) {
    warn(id1, `Could not extract UI current (ltpIdx=${ltpIdx}, line="${uiCurrentStr}")`);
    warnCount++;
  } else if (close(uiCurrent, apiCurrent)) {
    pass(id1, `₹${Math.round(uiCurrent).toLocaleString()} ≈ API ₹${Math.round(apiCurrent).toLocaleString()}`);
    passCount++;
  } else {
    fail(id1, `UI ₹${Math.round(uiCurrent).toLocaleString()} vs API ₹${Math.round(apiCurrent).toLocaleString()}`);
    failCount++;
  }

  // ── T-SUMMARY-2: total gain ──
  const id2 = `T-SUMMARY-2[${h.portfolio}/${cleanSym}]`;
  if (uiTotalGain == null) {
    warn(id2, `Could not extract UI total gain`);
    warnCount++;
  } else if (close(uiTotalGain, apiTotalGain)) {
    pass(id2, `₹${Math.round(uiTotalGain).toLocaleString()} ≈ API ₹${Math.round(apiTotalGain).toLocaleString()}`);
    passCount++;
  } else {
    fail(id2, `UI ₹${Math.round(uiTotalGain).toLocaleString()} vs API ₹${Math.round(apiTotalGain).toLocaleString()}`);
    failCount++;
  }

  // ── T-SUMMARY-3: today gain ──
  const id3 = `T-SUMMARY-3[${h.portfolio}/${cleanSym}]`;
  if (apiTodayGain == null || Math.abs(apiTodayGain) < 1) {
    warn(id3, `API today gain is null or ~0 — skipping (market closed?)`);
    warnCount++;
  } else if (uiToday == null) {
    warn(id3, `Could not extract UI today gain`);
    warnCount++;
  } else if (close(uiToday, apiTodayGain, 0.05)) {
    pass(id3, `₹${Math.round(uiToday).toLocaleString()} ≈ API ₹${Math.round(apiTodayGain).toLocaleString()}`);
    passCount++;
  } else {
    fail(id3, `UI ₹${Math.round(uiToday).toLocaleString()} vs API ₹${Math.round(apiTodayGain).toLocaleString()}`);
    failCount++;
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`);
console.log(`PASS: ${passCount}  FAIL: ${failCount}  WARN: ${warnCount}`);
console.log('='.repeat(50));

await browser.close();
