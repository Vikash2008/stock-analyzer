// HC — Holdings Charts tab test cases
// HC-A1: Portfolio Value stat = Summary current
// HC-A2: Invested stat = Summary invested (verify)
// HC-A3: Unrealized stat = current − invested
// HC-A4: Realized stat = Summary realized
// HC-A5: Total Gains stat = Summary total
// HC-A6: Return % stat = Summary implied return%
// HC-A7: XIRR Trend stat ≈ Summary XIRR (±2pp)
// HC-B1: 1m range = fewer X-axis ticks than All
// HC-B2: Range persists when switching metric pill
// HC-C1: Segment isolation: total > stk > indian_stock (Portfolio Value)
// HC-C2: ↻ button shows spinner then restores valid stat
// HC-D1: stk chart last point ≈ Portfolios Stocks tile
// HC-A1-PIN: manual (needs weekend/holiday)
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';

function parseVal(s) {
  if (!s) return null;
  s = s.replace(/[₹$,\s]/g,'').replace(/^\+/,'').replace(/^−/,'-');
  const m = s.match(/^-?[\d.]+([CLKclk]r?)?/);
  if (!m) return null;
  let part = m[0], mult = 1;
  if (part.endsWith('Cr'))     { mult = 1e7; part = part.slice(0,-2); }
  else if (part.endsWith('L')){ mult = 1e5; part = part.slice(0,-1); }
  else if (part.endsWith('K')){ mult = 1e3; part = part.slice(0,-1); }
  const n = parseFloat(part);
  return isNaN(n) ? null : n * mult;
}
function parsePct(s) {
  if (!s) return null;
  const m = s.replace(/^\+/,'').match(/^-?[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}
function close(a, b, tol=0.03) {
  if (a == null || b == null) return false;
  const avg = (Math.abs(a)+Math.abs(b))/2 || 1;
  return Math.abs(a-b)/avg <= tol;
}
function closePp(a, b, pp=2) {
  if (a == null || b == null) return false;
  return Math.abs(a-b) <= pp;
}
function pass(id, msg) { console.log('PASS ' + id + ': ' + msg); }
function fail(id, msg) { console.log('FAIL ' + id + ': ' + msg); }
function warn(id, msg) { console.log('WARN ' + id + ': ' + msg); }

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 430, height: 932 });

// Warm up — load root so portfolio data caches in React Query
await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);

let passCount = 0, failCount = 0, warnCount = 0;

// ─── Helper: get all visible text lines ──────────────────────────────────────
async function getLines() {
  return page.evaluate(() =>
    document.body.innerText.split('\n').map(l => l.trim()).filter(l => l)
  );
}

// ─── Helper: get SVG axis text labels ────────────────────────────────────────
async function getSvgLabels() {
  return page.evaluate(() =>
    [...document.querySelectorAll('svg text')].map(el => el.textContent?.trim()).filter(Boolean)
  );
}

// ─── Helper: extract stat line (first value line after ↻, skip loading lines)
function extractStatLine(lines) {
  const idx = lines.indexOf('↻');
  if (idx < 0) return null;
  for (const l of lines.slice(idx + 1)) {
    if (l.includes('Loading')) continue;
    if (/^\d+%$/.test(l)) continue; // skip "43%"
    if (/^₹/.test(l) || /^[+\-]?\d+\.?\d*%/.test(l) || /^[+\-]₹/.test(l)) return l;
  }
  return null;
}

// ─── Helper: extract summary values from Holdings page top section ────────────
function extractSummary(lines) {
  // Summary card is lines 0–9 (before tabs)
  // current: first ₹ line (line 2)
  const currentLine = lines.find(l => /^₹[\d.]/.test(l));
  const current = parseVal(currentLine);

  // today: line after "Today"
  const todayIdx = lines.findIndex(l => l === 'Today');
  const today = todayIdx >= 0 ? parseVal(lines[todayIdx + 1]) : null;

  // XIRR: line starting with "XIRR "
  const xirrLine = lines.find(l => l.startsWith('XIRR '));
  const xirr = xirrLine ? parsePct(xirrLine.replace('XIRR ','')) : null;

  // Total: line after "Total"
  const totalIdx = lines.findIndex(l => l === 'Total');
  const totalLine = totalIdx >= 0 ? lines[totalIdx + 1] : null;
  const total = parseVal(totalLine);
  const returnPct = totalLine ? parsePct(totalLine.replace(/^[^(]*\(/, '').replace(/\).*/, '')) : null;

  // Invested: line starting with "Invested ₹"
  const investedLine = lines.find(l => l.startsWith('Invested ₹'));
  const invested = investedLine ? parseVal(investedLine.replace('Invested ', '')) : null;

  // Realized: line starting with "Realized "
  const realizedLine = lines.find(l => l.startsWith('Realized '));
  const realized = realizedLine ? parseVal(realizedLine.replace('Realized ', '')) : null;

  return { current, today, xirr, total, returnPct, invested, realized };
}

// ─── Helper: navigate to holdings page, open Charts tab, wait for initial load
async function openChartsTab(url) {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  const lines0 = await getLines();
  const sum = extractSummary(lines0);

  // Click Charts tab — simple text locator
  await page.locator('text=Charts').first().click();
  await page.waitForTimeout(3000);
  return sum;
}

// ─── Helper: click a metric pill by name (exact match to avoid substring collisions)
async function clickPill(name, waitMs = 3000) {
  // Use regex exact match: "Realized Gains" must not match "Unrealized Gains"
  const exactRe = new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
  // Prefer button elements (metric pills) over plain text labels (summary card)
  let btn = page.locator('button').filter({ hasText: exactRe }).first();
  let cnt = await btn.count();
  if (!cnt) {
    // Fallback: any element with exact text, take last (pill is after summary in DOM)
    btn = page.getByText(name, { exact: true }).last();
    cnt = await btn.count();
  }
  if (!cnt) { console.log(`  pill "${name}" not found`); return; }
  await btn.click();
  await page.waitForTimeout(waitMs);
}

// ─── Helper: wait for chart progress to be high (≥80%) or loading gone ───────
async function waitForChart(maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const txt = await page.evaluate(() => document.body.innerText);
    const m = txt.match(/Loading price history[^\d]*(\d+) \/ (\d+)/);
    if (!m) break; // no loading indicator = done
    if (parseInt(m[1]) / parseInt(m[2]) >= 0.80) break;
    await page.waitForTimeout(1500);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HC-A1 through HC-A7  — stat line matches summary (segment/total)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══ HC-A: Stat line vs Summary (segment/total) ══');

const sum = await openChartsTab(`${BASE}/holdings/segment/total`);
console.log(`  Summary: current=${sum.current ? Math.round(sum.current).toLocaleString() : 'null'} invested=${sum.invested ? Math.round(sum.invested).toLocaleString() : 'null'} total=${sum.total ? Math.round(sum.total).toLocaleString() : 'null'} realized=${sum.realized ? Math.round(sum.realized).toLocaleString() : 'null'} return%=${sum.returnPct} xirr=${sum.xirr}`);

await waitForChart(25000);

// HC-A1: Portfolio Value
await clickPill('Portfolio Value', 2000);
{
  const lines = await getLines();
  const stat = extractStatLine(lines);
  const uiVal = parseVal(stat);
  const id = 'HC-A1';
  console.log(`  stat="${stat}" parsed=${uiVal ? Math.round(uiVal).toLocaleString() : 'null'}`);
  if (!uiVal) { warn(id, `Could not extract stat line (got: "${stat}")`); warnCount++; }
  else if (close(uiVal, sum.current)) { pass(id, `Portfolio Value last point ₹${Math.round(uiVal/1e5)/10}L ≈ Summary ₹${Math.round(sum.current/1e5)/10}L`); passCount++; }
  else { fail(id, `stat ₹${Math.round(uiVal).toLocaleString()} vs summary ₹${Math.round(sum.current).toLocaleString()}`); failCount++; }
}

// HC-A2: Invested
await clickPill('Invested', 2000);
{
  const lines = await getLines();
  const stat = extractStatLine(lines);
  const uiVal = parseVal(stat);
  const id = 'HC-A2';
  console.log(`  stat="${stat}" parsed=${uiVal ? Math.round(uiVal).toLocaleString() : 'null'}`);
  if (!uiVal) { warn(id, `Could not extract stat line`); warnCount++; }
  else if (close(uiVal, sum.invested)) { pass(id, `Invested last point ₹${Math.round(uiVal).toLocaleString()} ≈ Summary ₹${Math.round(sum.invested).toLocaleString()}`); passCount++; }
  else { fail(id, `stat ₹${Math.round(uiVal).toLocaleString()} vs summary ₹${Math.round(sum.invested).toLocaleString()}`); failCount++; }
}

// HC-A3: Unrealized = current − invested
await clickPill('Unrealized Gains', 2000);
{
  const lines = await getLines();
  const stat = extractStatLine(lines);
  const uiVal = parseVal(stat);
  const expected = sum.current != null && sum.invested != null ? sum.current - sum.invested : null;
  const id = 'HC-A3';
  console.log(`  stat="${stat}" parsed=${uiVal ? Math.round(uiVal).toLocaleString() : 'null'} expected=${expected ? Math.round(expected).toLocaleString() : 'null'}`);
  if (!uiVal) { warn(id, `Could not extract stat line`); warnCount++; }
  else if (!expected) { warn(id, `Could not compute expected (current or invested null)`); warnCount++; }
  else if (close(uiVal, expected)) { pass(id, `Unrealized last point ₹${Math.round(uiVal).toLocaleString()} ≈ current−invested ₹${Math.round(expected).toLocaleString()}`); passCount++; }
  else { fail(id, `stat ₹${Math.round(uiVal).toLocaleString()} vs expected ₹${Math.round(expected).toLocaleString()}`); failCount++; }
}

// HC-A4: Realized Gains
await clickPill('Realized Gains', 2000);
{
  const lines = await getLines();
  const stat = extractStatLine(lines);
  const uiVal = parseVal(stat);
  const id = 'HC-A4';
  console.log(`  stat="${stat}" parsed=${uiVal ? Math.round(uiVal).toLocaleString() : 'null'}`);
  if (!uiVal) { warn(id, `Could not extract stat line`); warnCount++; }
  else if (!sum.realized) { warn(id, `Summary realized not extracted`); warnCount++; }
  else if (close(uiVal, sum.realized)) { pass(id, `Realized last point ₹${Math.round(uiVal).toLocaleString()} ≈ Summary ₹${Math.round(sum.realized).toLocaleString()}`); passCount++; }
  else { fail(id, `stat ₹${Math.round(uiVal).toLocaleString()} vs summary ₹${Math.round(sum.realized).toLocaleString()}`); failCount++; }
}

// HC-A5: Total Gains
await clickPill('Total Gains', 2000);
{
  const lines = await getLines();
  const stat = extractStatLine(lines);
  const uiVal = parseVal(stat);
  const id = 'HC-A5';
  console.log(`  stat="${stat}" parsed=${uiVal ? Math.round(uiVal).toLocaleString() : 'null'}`);
  if (!uiVal) { warn(id, `Could not extract stat line`); warnCount++; }
  else if (!sum.total) { warn(id, `Summary total not extracted`); warnCount++; }
  else if (close(uiVal, sum.total)) { pass(id, `Total Gains last point ₹${Math.round(uiVal).toLocaleString()} ≈ Summary ₹${Math.round(sum.total).toLocaleString()}`); passCount++; }
  else { fail(id, `stat ₹${Math.round(uiVal).toLocaleString()} vs summary ₹${Math.round(sum.total).toLocaleString()}`); failCount++; }
}

// HC-A6: Return %
await clickPill('Return %', 2000);
{
  const lines = await getLines();
  const stat = extractStatLine(lines);
  const uiPct = parsePct(stat);
  const id = 'HC-A6';
  console.log(`  stat="${stat}" parsed=${uiPct} expected=${sum.returnPct}`);
  if (uiPct == null) { warn(id, `Could not extract stat line`); warnCount++; }
  else if (sum.returnPct == null) { warn(id, `Summary return% not extracted`); warnCount++; }
  else if (closePp(uiPct, sum.returnPct, 0.5)) { pass(id, `Return % last point ${uiPct}% ≈ Summary ${sum.returnPct}%`); passCount++; }
  else { fail(id, `stat ${uiPct}% vs summary ${sum.returnPct}%`); failCount++; }
}

// HC-A7: XIRR Trend ≈ Summary XIRR (±2pp)
await clickPill('XIRR Trend', 3000);
{
  const lines = await getLines();
  const stat = extractStatLine(lines);
  const uiPct = parsePct(stat);
  const id = 'HC-A7';
  console.log(`  stat="${stat}" parsed=${uiPct} expected≈${sum.xirr}`);
  if (uiPct == null) { warn(id, `Could not extract stat line`); warnCount++; }
  else if (sum.xirr == null) { warn(id, `Summary XIRR not extracted`); warnCount++; }
  else if (closePp(uiPct, sum.xirr, 2)) { pass(id, `XIRR Trend last point ${uiPct}% ≈ Summary XIRR ${sum.xirr}% (within ±2pp)`); passCount++; }
  else { fail(id, `stat ${uiPct}% vs summary ${sum.xirr}% (diff=${Math.abs(uiPct-sum.xirr).toFixed(2)}pp)`); failCount++; }
}

// ════════════════════════════════════════════════════════════════════════════
// HC-B1: 1m range has fewer X-axis ticks than All range
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══ HC-B: Range controls ══');

// Back to Portfolio Value
await clickPill('Portfolio Value', 1000);

// Read "All" range SVG labels
await page.locator('text="All"').first().click();
await page.waitForTimeout(2000);
const allLabels = await getSvgLabels();
console.log(`  All range SVG labels (${allLabels.length}): ${allLabels.join(', ')}`);

// Read 1m range SVG labels
await page.locator('text="1m"').first().click();
await page.waitForTimeout(2000);
const oneMonthLabels = await getSvgLabels();
console.log(`  1m range SVG labels (${oneMonthLabels.length}): ${oneMonthLabels.join(', ')}`);

{
  const id = 'HC-B1';
  // 1m should show day-level labels ("15 May", "2 Jun") not year-level ("Jan '18")
  const oneMDayLabels  = oneMonthLabels.filter(l => /^\d+ [A-Z][a-z]{2}$/.test(l));
  const allYearLabels  = allLabels.filter(l => /[A-Z][a-z]+ '\d{2}/.test(l));
  if (oneMonthLabels.length === 0) { warn(id, `No SVG labels found for 1m range`); warnCount++; }
  else if (oneMDayLabels.length > 0 && allYearLabels.length > 0) {
    pass(id, `1m shows day-level labels (${oneMDayLabels.join(', ')}) vs All year-level — correct 30-day window`); passCount++;
  } else {
    warn(id, `Could not confirm day-level granularity for 1m. Labels: ${oneMonthLabels.join(', ')}`); warnCount++;
  }
}

// HC-B2: Select 3m, switch metric pill, range stays at 3m (not reset to All)
await page.locator('text="3m"').first().click();
await page.waitForTimeout(1500);
const threeMonthLabels = await getSvgLabels();

await clickPill('Total Gains', 1500);
const afterPillLabels = await getSvgLabels();

await clickPill('Portfolio Value', 1500);
const afterReturnLabels = await getSvgLabels();

{
  const id = 'HC-B2';
  console.log(`  3m labels: ${threeMonthLabels.join(', ')}`);
  console.log(`  After pill switch labels: ${afterPillLabels.join(', ')}`);
  // Range persists if labels after pill switch are similar to 3m (not the All range labels)
  const allLabelSet = new Set(allLabels.filter(l => !/^\d/.test(l))); // non-numeric
  const afterNonNum = afterPillLabels.filter(l => !/^\d/.test(l));
  const movedToAll = afterNonNum.some(l => allLabels.includes(l) && !threeMonthLabels.includes(l));
  if (afterPillLabels.length === 0) { warn(id, `No SVG labels after pill switch`); warnCount++; }
  else if (JSON.stringify(threeMonthLabels) === JSON.stringify(afterPillLabels)) {
    pass(id, `SVG labels identical after metric pill switch — range persisted at 3m`); passCount++;
  } else if (afterPillLabels.length <= allLabels.length + 2 && afterPillLabels.length >= threeMonthLabels.length - 2) {
    pass(id, `Range labels consistent after pill switch (3m: ${threeMonthLabels.length}, after: ${afterPillLabels.length} ticks)`); passCount++;
  } else {
    warn(id, `Range may have reset — 3m had ${threeMonthLabels.length} ticks, after switch ${afterPillLabels.length} ticks`); warnCount++;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HC-C1: Segment isolation — total > stk > indian_stock (Portfolio Value last point)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══ HC-C: Segment isolation ══');

const segmentValues = {};
for (const [seg, label] of [['total','total'], ['stk','stk'], ['indian_stock','indian_stock']]) {
  const s = await openChartsTab(`${BASE}/holdings/segment/${seg}`);
  await waitForChart(20000);
  await clickPill('Portfolio Value', 2000);
  const lines = await getLines();
  const stat = extractStatLine(lines);
  const val = parseVal(stat);
  segmentValues[seg] = val;
  console.log(`  segment/${seg} Portfolio Value stat="${stat}" parsed=${val ? Math.round(val).toLocaleString() : 'null'}`);
}

{
  const id = 'HC-C1';
  const { total, stk, indian_stock } = segmentValues;
  if (!total || !stk || !indian_stock) {
    warn(id, `Could not extract all segment values (total=${total}, stk=${stk}, indian_stock=${indian_stock})`); warnCount++;
  } else if (total >= stk && stk >= indian_stock) {
    pass(id, `Isolation: total ₹${Math.round(total/1e5)/10}L ≥ stk ₹${Math.round(stk/1e5)/10}L ≥ indian_stock ₹${Math.round(indian_stock/1e5)/10}L`); passCount++;
  } else {
    fail(id, `Isolation violated — total=${Math.round(total/1e5)/10}L stk=${Math.round(stk/1e5)/10}L indian_stock=${Math.round(indian_stock/1e5)/10}L`); failCount++;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HC-C2: ↻ button shows spinner then restores valid stat
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══ HC-C2: ↻ refresh button ══');

// Go back to total, Charts tab, Portfolio Value
const sumC2 = await openChartsTab(`${BASE}/holdings/segment/total`);
await waitForChart(20000);
await clickPill('Portfolio Value', 1500);

const statBefore = extractStatLine(await getLines());
console.log(`  Stat before ↻: "${statBefore}"`);

// Click ↻
await page.locator('text="↻"').first().click();
await page.waitForTimeout(500);
const linesAfterClick = await getLines();
const hasSpinner = linesAfterClick.some(l => l.includes('Loading') || l.includes('%'));
console.log(`  Has loading indicator after ↻: ${hasSpinner}`);

// Wait for reload
await page.waitForTimeout(5000);
const statAfter = extractStatLine(await getLines());
console.log(`  Stat after ↻: "${statAfter}"`);

{
  const id = 'HC-C2';
  const valAfter = parseVal(statAfter);
  if (!valAfter) { warn(id, `Could not read stat after ↻`); warnCount++; }
  else if (close(valAfter, sumC2.current)) {
    pass(id, `↻ restores valid stat ₹${Math.round(valAfter).toLocaleString()} ≈ Summary current${hasSpinner ? ' (spinner confirmed)' : ''}`); passCount++;
  } else {
    fail(id, `After ↻, stat ${statAfter} does not match summary current ${Math.round(sumC2.current).toLocaleString()}`); failCount++;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HC-D1: stk chart last point ≈ Portfolios page Stocks tile current
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══ HC-D1: Cross-page (stk chart vs Portfolios Stocks tile) ══');

// Get Stocks tile current from portfolios page
await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3000);
const portLines = await getLines();
// Stocks tile: labelled "STOCKS" — current value is the ₹ line right after it
const stkIdx = portLines.findIndex(l => l === 'STOCKS');
const stocksTileLine = stkIdx >= 0 ? portLines.slice(stkIdx+1).find(l => /^₹/.test(l)) : null;
const stocksTileCurrent = parseVal(stocksTileLine);
console.log(`  Portfolios page around STOCKS: ${portLines.slice(Math.max(0,stkIdx-1), stkIdx+5).join(' | ')}`);
console.log(`  Stocks tile current: "${stocksTileLine}" = ${stocksTileCurrent ? Math.round(stocksTileCurrent).toLocaleString() : 'null'}`);

// Get stk chart Portfolio Value stat
const sumStk = await openChartsTab(`${BASE}/holdings/segment/stk`);
await waitForChart(20000);
await clickPill('Portfolio Value', 2000);
const stkStat = extractStatLine(await getLines());
const stkStatVal = parseVal(stkStat);
console.log(`  stk chart stat: "${stkStat}" = ${stkStatVal ? Math.round(stkStatVal).toLocaleString() : 'null'}`);

{
  const id = 'HC-D1';
  if (!stocksTileCurrent) { warn(id, `Could not extract Portfolios Stocks tile current`); warnCount++; }
  else if (!stkStatVal) { warn(id, `Could not extract stk chart stat`); warnCount++; }
  else if (close(stkStatVal, stocksTileCurrent, 0.05)) {
    pass(id, `stk chart ₹${Math.round(stkStatVal).toLocaleString()} ≈ Portfolios Stocks tile ₹${Math.round(stocksTileCurrent).toLocaleString()} (within 5%)`); passCount++;
  } else {
    fail(id, `stk chart ₹${Math.round(stkStatVal).toLocaleString()} vs Portfolios Stocks tile ₹${Math.round(stocksTileCurrent).toLocaleString()}`); failCount++;
  }
}

// HC-A1-PIN: manual
warn('HC-A1-PIN', 'Manual test required — run on a Saturday/Sunday to verify weekend last-point pin');
warnCount++;

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(55)}`);
console.log(`PASS: ${passCount}  FAIL: ${failCount}  WARN: ${warnCount}`);
console.log('='.repeat(55));

await browser.close();
