import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 430, height: 932 });

function parseVal(s) {
  if (!s) return null;
  s = s.replace(/[₹$,\s]/g,'').replace(/^\+/,'').replace(/^−/,'-');
  let m=1;
  if(s.endsWith('Cr')){m=1e7;s=s.slice(0,-2);}
  else if(s.endsWith('L')){m=1e5;s=s.slice(0,-1);}
  else if(s.endsWith('K')){m=1e3;s=s.slice(0,-1);}
  const n=parseFloat(s); return isNaN(n)?null:n*m;
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

// Helper: extract cards from hold lines
function extractCards(lines) {
  const tabIdx = lines.indexOf('Dividends');
  const holdLines = lines.slice(tabIdx+1);
  const cards = [];
  for(let i=0;i<holdLines.length;i++){
    if(holdLines[i+1] && holdLines[i+1].startsWith('LTP')){
      const name = holdLines[i];
      const ltp = holdLines[i+1];
      const current = parseVal(holdLines[i+2]);
      // look for Today and Total values
      let today=null, total=null, invested=null, subLabel=null;
      for(let j=i+3;j<Math.min(i+25,holdLines.length);j++){
        if(holdLines[j]==='Today' && today===null) today=holdLines[j+1];
        if(holdLines[j]==='Total' && total===null) total=holdLines[j+1];
        if(holdLines[j]==='Invested') invested=parseVal(holdLines[j+1]);
        // SubLabel is typically line before XIRR or 2nd line after name
        if(holdLines[j+1] && holdLines[j+1].startsWith('LTP')) break;
      }
      cards.push({name, current, today, total, invested});
      i+=2;
    }
  }
  return cards;
}

// ─── Baseline: All holdings ────────────────────────────────────────────────
const totLines = await nav('/holdings/segment/total', {
  'hp:holdingFilter':'all','hp:viewMode':'cumulative',
  'hp:sortField':'current','hp:sortDir':'desc','hp:showClosed':'false'
});

const allHIdx = totLines.indexOf('ALL HOLDINGS');
const summCurrent  = parseVal(totLines[allHIdx+1]);
const investedLine = totLines.find(l=>l.startsWith('Invested'));
const summInvested = parseVal((investedLine||'').replace('Invested',''));
const todayLine    = totLines.find(l=>l.startsWith('Today'));
const summToday    = parseVal((todayLine||'').replace('Today',''));

console.log('Summary: cur=' + summCurrent + ' inv=' + summInvested + ' today=' + summToday);

const cards = extractCards(totLines);
console.log('\nCards extracted: ' + cards.length);
cards.forEach((c,i)=>console.log(i + ': ' + c.name + ' | cur=' + Math.round(c.current||0) + ' | invested=' + c.invested + ' | today=' + c.today + ' | total=' + c.total));

// H-SUMMARY-2: Invested = sum of card invested values
const sumInvested = cards.reduce((s,c)=>s+(c.invested||0),0);
console.log('\nH-SUMMARY-2: sumCardInvested=' + Math.round(sumInvested) + ' vs summaryInvested=' + summInvested);
if(sumInvested===0) warn('H-SUMMARY-2','Could not extract card invested values');
else if(close(sumInvested, summInvested)) pass('H-SUMMARY-2','Sum of card invested = Summary invested (' + Math.round(sumInvested) + ' vs ' + summInvested + ')');
else fail('H-SUMMARY-2','sum=' + Math.round(sumInvested) + ' vs summary=' + summInvested);

// H-SUMMARY-3: Today = sum of card today gains
const todayVals = cards.map(c=>parseVal(c.today)).filter(v=>v!=null);
const sumToday = todayVals.reduce((s,v)=>s+v,0);
console.log('\nH-SUMMARY-3: sumCardToday=' + Math.round(sumToday) + ' vs summaryToday=' + summToday);
if(todayVals.length===0) warn('H-SUMMARY-3','Could not extract any Today values');
else if(close(sumToday, summToday, 0.03)) pass('H-SUMMARY-3','Sum of card Today gains = Summary Today (' + Math.round(sumToday) + ' vs ' + summToday + ')');
else fail('H-SUMMARY-3','sum=' + Math.round(sumToday) + ' vs summary=' + summToday + ' (diff=' + Math.abs(sumToday-summToday) + ')');

// ─── H-FILTER-4: Show Closed appends closed rows, summary unchanged ────────
const showClosedLines = await nav('/holdings/segment/total', {
  'hp:holdingFilter':'all','hp:viewMode':'cumulative',
  'hp:sortField':'current','hp:sortDir':'desc','hp:showClosed':'true'
});
const allHIdx2 = showClosedLines.indexOf('ALL HOLDINGS');
const summCurrent2 = parseVal(showClosedLines[allHIdx2+1]);
const cards2 = extractCards(showClosedLines);
const closedCards = cards2.filter(c=>c.current===0||c.current===null);
console.log('\nH-FILTER-4: withShowClosed: total cards=' + cards2.length + ' (was ' + cards.length + ') closedCards=' + closedCards.length);
console.log('Summary current with/without showClosed: ' + summCurrent2 + ' vs ' + summCurrent);
if(cards2.length > cards.length && close(summCurrent2, summCurrent))
  pass('H-FILTER-4','Show Closed adds rows ('+cards2.length+' vs '+cards.length+'), summary current unchanged');
else if(cards2.length === cards.length)
  warn('H-FILTER-4','No closed cards in demo data — card count unchanged (' + cards.length + ')');
else
  fail('H-FILTER-4','cards: ' + cards.length + ' → ' + cards2.length + ', summary: ' + summCurrent + ' → ' + summCurrent2);

// ─── H-GROUP-3: Grouped shows company name not portfolio name ─────────────
const groupedLines = await nav('/holdings/segment/total', {
  'hp:holdingFilter':'all','hp:viewMode':'cumulative',
  'hp:sortField':'current','hp:sortDir':'desc','hp:showClosed':'false'
});
const gTabIdx = groupedLines.indexOf('Dividends');
const gH = groupedLines.slice(gTabIdx+1);
// Extract subLabels: they appear 1-2 lines after the name (before "LTP")
// Pattern: name → (subLabel or LTP) → LTP
console.log('\nH-GROUP-3 lines after Dividends tab:');
gH.slice(0,50).forEach((l,i)=>console.log(i+': '+l));

// H-GROUP-3: look for portfolio names appearing as subLabels
const portfolioNames = ['AngelOne', 'IndMoney', 'MF_Groww', 'Vested', 'Zerodha'];
let foundPortSubLabel = false;
let foundCompanySubLabel = false;
for(let i=0;i<gH.length;i++){
  if(gH[i+1] && gH[i+1].startsWith('LTP')){
    // subLabel may be 2 lines before LTP or same line pattern
    // Check the line before LTP line
    const lineBeforeLTP = gH[i]; // this is the name
    // Actually subLabel is after name, check i+1
    // Pattern: name | [subLabel if present] | LTP...
    // If gH[i+1] === LTP line, subLabel is not present
    // Let's check 2 lines after name
    const possibleSubLabel = gH[i] === (gH[i]) && gH[i+1].startsWith('LTP') ? null : gH[i+1];
    if(possibleSubLabel && !possibleSubLabel.startsWith('LTP')){
      if(portfolioNames.some(p=>possibleSubLabel.includes(p))){
        foundPortSubLabel=true;
        console.log('Found portfolio name as subLabel: "' + possibleSubLabel + '"');
      } else {
        foundCompanySubLabel=true;
        console.log('Company subLabel: "' + possibleSubLabel + '"');
      }
    }
  }
}

// Better approach: look for what follows each card name
// Grouped cards: name line → might have subLabel line → LTP line
for(let i=0;i<gH.length-2;i++){
  if(gH[i+1] && gH[i+1].startsWith('LTP')) continue; // no subLabel
  if(gH[i+2] && gH[i+2].startsWith('LTP')){
    // gH[i] = name, gH[i+1] = subLabel, gH[i+2] = LTP
    const subLabel = gH[i+1];
    if(portfolioNames.some(p=>subLabel.includes(p))){
      foundPortSubLabel=true;
      console.log('Portfolio subLabel: "' + subLabel + '" after "' + gH[i] + '"');
    }
  }
}

if(!foundPortSubLabel && foundCompanySubLabel)
  pass('H-GROUP-3','Grouped mode shows company name (not portfolio name) as subLabel');
else if(foundPortSubLabel)
  fail('H-GROUP-3','Found portfolio name used as subLabel in grouped mode');
else
  warn('H-GROUP-3','Could not determine subLabel content from text extraction');

// ─── H-SORT-3: Sort by Total Gain ────────────────────────────────────────
const sortTotalLines = await nav('/holdings/segment/total', {
  'hp:holdingFilter':'all','hp:viewMode':'cumulative',
  'hp:sortField':'totalGain','hp:sortDir':'desc','hp:showClosed':'false'
});
const sortTotalCards = extractCards(sortTotalLines);
console.log('\nH-SORT-3 Sort by Total Gain desc:');
sortTotalCards.forEach((c,i)=>console.log(i + ': ' + c.name + ' | total=' + c.total + ' | cur=' + Math.round(c.current||0)));

// Extract total gain values
const totalGains = sortTotalCards.map(c=>parseVal(c.total));
console.log('Total gain values: ' + JSON.stringify(totalGains.map(v=>v?Math.round(v):null)));
let sortOk=true;
for(let j=1;j<totalGains.length;j++){
  const a=totalGains[j-1], b=totalGains[j];
  if(a!=null && b!=null && b > a+1000){ // allow 1K tolerance
    sortOk=false;
    console.log('Out of order: pos ' + (j-1) + '=' + Math.round(a) + ' > pos ' + j + '=' + Math.round(b));
    break;
  }
}
if(sortOk) pass('H-SORT-3','Cards in descending total gain order');
else fail('H-SORT-3','Cards NOT in descending total gain order');

// Also verify that if a stock has high total gain it appears before lower one
// Compare AAPL vs MSFT: AAPL should have higher total gain
const aaplIdx = sortTotalCards.findIndex(c=>c.name.includes('APPLE'));
const msftIdx = sortTotalCards.findIndex(c=>c.name.includes('MICROSOFT'));
if(aaplIdx>=0 && msftIdx>=0){
  console.log('AAPL at pos ' + aaplIdx + ', MSFT at pos ' + msftIdx + ' (AAPL should be before MSFT)');
  if(aaplIdx < msftIdx) pass('H-SORT-3-AAPL-vs-MSFT','AAPL (+₹2.1L) appears before MSFT (+₹1.2L) in total gain sort');
  else fail('H-SORT-3-AAPL-vs-MSFT','MSFT at pos ' + msftIdx + ' before AAPL at pos ' + aaplIdx);
}

// ─── H-SORT-4: Sort applies to closed rows too ────────────────────────────
const sort4Lines = await nav('/holdings/segment/total', {
  'hp:holdingFilter':'all','hp:viewMode':'cumulative',
  'hp:sortField':'totalGain','hp:sortDir':'desc','hp:showClosed':'true'
});
const sort4Cards = extractCards(sort4Lines);
console.log('\nH-SORT-4 All+ShowClosed sorted by totalGain desc:');
sort4Cards.forEach((c,i)=>console.log(i + ': ' + c.name + ' | cur=' + Math.round(c.current||0) + ' | total=' + c.total));

// Check if any closed card appears in non-alphabetical/unsorted position relative to opens
const closedCardsSorted = sort4Cards.filter(c=>c.current===0||c.current===null);
if(closedCardsSorted.length===0)
  warn('H-SORT-4','No closed cards in demo data to verify sort');
else {
  // Closed cards should appear sorted by their totalGain, not just appended at end
  const totalGains4 = sort4Cards.map(c=>parseVal(c.total));
  let sorted4=true;
  for(let j=1;j<totalGains4.length;j++){
    const a=totalGains4[j-1], b=totalGains4[j];
    if(a!=null && b!=null && b > a+1000){ sorted4=false; break; }
  }
  if(sorted4) pass('H-SORT-4','Closed rows included in totalGain sort');
  else fail('H-SORT-4','Sort order broken when closed rows included');
}

await browser.close();
console.log('\n=== Done ===');
