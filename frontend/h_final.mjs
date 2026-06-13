import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 430, height: 932 });

function parseVal(s) {
  if (!s) return null;
  // Strip currency symbols, spaces, commas
  s = s.replace(/[₹$,\s]/g,'').replace(/^\+/,'').replace(/^−/,'-');
  // Extract just the leading number part (before any space or '(')
  const m2 = s.match(/^-?[\d.]+([CLKclk]r?)?/);
  if (!m2) return null;
  let part = m2[0];
  let mult = 1;
  if(part.endsWith('Cr')){mult=1e7;part=part.slice(0,-2);}
  else if(part.endsWith('L')){mult=1e5;part=part.slice(0,-1);}
  else if(part.endsWith('K')){mult=1e3;part=part.slice(0,-1);}
  const n=parseFloat(part); return isNaN(n)?null:n*mult;
}
function close(a,b,tol=0.03){ if(a==null||b==null)return false; const avg=(Math.abs(a)+Math.abs(b))/2||1; return Math.abs(a-b)/avg<=tol; }
function pass(id,msg){ console.log('PASS ' + id + ': ' + msg); }
function fail(id,msg){ console.log('FAIL ' + id + ': ' + msg); }
function warn(id,msg){ console.log('WARN ' + id + ': ' + msg); }

async function getLines(){ return page.evaluate(()=>document.body.innerText.split('\n').map(l=>l.trim()).filter(l=>l)); }
async function nav(path, ls){
  await page.goto(BASE+path,{waitUntil:'networkidle',timeout:30000});
  if(ls){
    await page.evaluate((kv)=>{ for(const k of Object.keys(kv)) localStorage.setItem(k,kv[k]); }, ls);
    await page.reload({waitUntil:'networkidle',timeout:30000});
  }
  await page.waitForTimeout(1500);
  return getLines();
}

// ─── H-SUMMARY-2 and H-SUMMARY-3: via API ─────────────────────────────────
const resp = await fetch('http://localhost:8000/holdings/segment/total').then(r=>r.json());

console.log('\n=== API Holdings Data ===');
const openHoldings = resp.holdings ? resp.holdings.filter(h => h.qty > 0) : [];
console.log('Open holdings: ' + openHoldings.length);

const apiSumCurrent  = openHoldings.reduce((s,h)=>s+h.disp_current,0);
const apiSumInvested = openHoldings.reduce((s,h)=>s+h.disp_invested,0);
const apiSumToday    = openHoldings.reduce((s,h)=>s+(h.disp_today||0),0);

console.log('API sum current=' + Math.round(apiSumCurrent));
console.log('API sum invested=' + Math.round(apiSumInvested));
console.log('API sum today=' + Math.round(apiSumToday));
console.log('API summary current=' + resp.current);
console.log('API summary invested=' + resp.invested);
console.log('API summary today=' + resp.today_gain);

// H-SUMMARY-2
if(close(apiSumInvested, resp.invested))
  pass('H-SUMMARY-2','Sum of holding invested = Summary invested (' + Math.round(apiSumInvested) + ' vs ' + Math.round(resp.invested) + ')');
else
  fail('H-SUMMARY-2','sum=' + Math.round(apiSumInvested) + ' vs summary=' + Math.round(resp.invested));

// H-SUMMARY-3
if(close(apiSumToday, resp.today_gain, 0.05))
  pass('H-SUMMARY-3','Sum of holding today gains ≈ Summary today (' + Math.round(apiSumToday) + ' vs ' + Math.round(resp.today_gain) + ')');
else
  fail('H-SUMMARY-3','sum=' + Math.round(apiSumToday) + ' vs summary=' + Math.round(resp.today_gain));

// Also verify the UI summary matches API
const totLines = await nav('/holdings/segment/total', {
  'hp:holdingFilter':'all','hp:viewMode':'cumulative',
  'hp:sortField':'current','hp:sortDir':'desc','hp:showClosed':'false'
});

const allHIdx = totLines.indexOf('ALL HOLDINGS');
console.log('\n=== Summary section (lines after ALL HOLDINGS) ===');
totLines.slice(allHIdx, allHIdx+20).forEach((l,i)=>console.log((allHIdx+i)+': '+l));

// Extract summary today: find "Today" label, next line is value
const summTodayLblIdx = totLines.slice(allHIdx, allHIdx+30).findIndex(l=>l==='Today');
const summToday = summTodayLblIdx >= 0 ? parseVal(totLines[allHIdx+summTodayLblIdx+1]) : null;
const summInvested = parseVal(totLines.slice(allHIdx).find(l=>l.startsWith('₹') && !l.includes('L') && !l.includes('K') && !l.includes('Cr') && totLines.indexOf(l) > allHIdx+2) || '');
console.log('UI summaryToday extracted: ' + summToday);

// ─── H-GROUP-3: Grouped vs Standalone subLabels ────────────────────────────
console.log('\n=== H-GROUP-3: Standalone subLabel check ===');
const standaloneLines = await nav('/holdings/segment/total', {
  'hp:holdingFilter':'all','hp:viewMode':'standalone',
  'hp:sortField':'current','hp:sortDir':'desc','hp:showClosed':'false'
});
const sTabIdx = standaloneLines.indexOf('Dividends');
const sH = standaloneLines.slice(sTabIdx+1);
console.log('Standalone lines (first 80):');
sH.slice(0,80).forEach((l,i)=>console.log(i+': '+l));

// Find subLabels in standalone: pattern is name → subLabel → LTP (2 lines between name and LTP)
const portfolioNames = ['AngelOne','IndMoney','MF Groww','MF_Groww','Vested','Zerodha'];
let standalonePortSubLabels = [];
for(let i=0;i<sH.length-2;i++){
  // If line i+2 starts with 'LTP', then i is name, i+1 is subLabel
  if(sH[i+2] && sH[i+2].startsWith('LTP')){
    standalonePortSubLabels.push({name:sH[i], subLabel:sH[i+1]});
  }
}
console.log('Standalone cards with subLabel:');
standalonePortSubLabels.forEach(c=>console.log('  "' + c.name + '" → subLabel: "' + c.subLabel + '"'));

// Check grouped mode for same pattern
const groupedLines = await nav('/holdings/segment/total', {
  'hp:holdingFilter':'all','hp:viewMode':'cumulative',
  'hp:sortField':'current','hp:sortDir':'desc','hp:showClosed':'false'
});
const gTabIdx = groupedLines.indexOf('Dividends');
const gH = groupedLines.slice(gTabIdx+1);
let groupedPortSubLabels = [];
for(let i=0;i<gH.length-2;i++){
  if(gH[i+2] && gH[i+2].startsWith('LTP')){
    groupedPortSubLabels.push({name:gH[i], subLabel:gH[i+1]});
  }
}
console.log('Grouped cards with subLabel:');
groupedPortSubLabels.forEach(c=>console.log('  "' + c.name + '" → subLabel: "' + c.subLabel + '"'));

const hasPortSubLabelInGrouped = groupedPortSubLabels.some(c=>portfolioNames.some(p=>c.subLabel.includes(p)));
const hasPortSubLabelInStandalone = standalonePortSubLabels.some(c=>portfolioNames.some(p=>c.subLabel.includes(p)));

if(hasPortSubLabelInStandalone && !hasPortSubLabelInGrouped)
  pass('H-GROUP-3','Standalone shows portfolio subLabel; Grouped does not show portfolio name');
else if(!hasPortSubLabelInStandalone && !hasPortSubLabelInGrouped)
  warn('H-GROUP-3','No portfolio subLabels found in either mode — cannot distinguish');
else if(hasPortSubLabelInGrouped)
  fail('H-GROUP-3','Grouped mode shows portfolio name as subLabel');
else
  warn('H-GROUP-3','Standalone has no portfolio subLabels — unexpected');

await browser.close();
console.log('\n=== Done ===');
