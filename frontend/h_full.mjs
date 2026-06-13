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
  // Navigate to page first (so localStorage is accessible), set state, then reload
  await page.goto(BASE+path,{waitUntil:'networkidle',timeout:30000});
  if(ls){
    await page.evaluate((kv)=>{ for(const k of Object.keys(kv)) localStorage.setItem(k,kv[k]); }, ls);
    await page.reload({waitUntil:'networkidle',timeout:30000});
  }
  await page.waitForTimeout(1500);
  return getLines();
}

// ─── H-SUMMARY ───────────────────────────────────────────────────────────────
const totLines = await nav('/holdings/segment/total', {
  'hp:holdingFilter':'all','hp:viewMode':'cumulative',
  'hp:sortField':'current','hp:sortDir':'desc','hp:showClosed':'false'
});

console.log('\n=== ALL HOLDINGS lines ===');
totLines.slice(0,85).forEach((l,i)=>console.log(i + ': ' + l));

const allHIdx = totLines.indexOf('ALL HOLDINGS');
const summCurrent = parseVal(totLines[allHIdx+1]);
const summXirr    = parseFloat((totLines.find(l=>l.startsWith('XIRR'))||'').replace('XIRR ',''));
const investedLine= totLines.find(l=>l.startsWith('Invested'));
const realizedLine= totLines.find(l=>l.startsWith('Realized'));
const summInvested= parseVal((investedLine||'').replace('Invested',''));
const summRealized= parseVal((realizedLine||'').replace('Realized',''));
// Total gain: find after XIRR
const xirrLineIdx = totLines.findIndex(l=>l.startsWith('XIRR'));
const summTotal   = parseVal(totLines.slice(xirrLineIdx+1, xirrLineIdx+4).find(l=>l.startsWith('+')||l.startsWith('-'))||'');

console.log('\nSummary: cur=' + summCurrent + ' inv=' + summInvested + ' total=' + summTotal + ' real=' + summRealized + ' xirr=' + summXirr);

// Extract card current values
const tabIdx = totLines.indexOf('Dividends');
const holdLines = totLines.slice(tabIdx+1);
const cardCurrents = [];
const cardNames = [];
for(let i=0;i<holdLines.length;i++){
  if(holdLines[i+1] && holdLines[i+1].startsWith('LTP')){
    cardNames.push(holdLines[i]);
    cardCurrents.push(parseVal(holdLines[i+2]));
    i+=2;
  }
}
console.log('\nCard names: ' + JSON.stringify(cardNames));
console.log('Card currents: ' + JSON.stringify(cardCurrents.map(v=>v ? Math.round(v) : 0)));

// H-SUMMARY-1
const openCardSum = cardCurrents.filter(v=>v!=null&&v>0).reduce((a,b)=>a+b,0);
console.log('\nH-SUMMARY-1: open card sum=' + Math.round(openCardSum) + ' summary=' + summCurrent);
if(close(openCardSum, summCurrent)) pass('H-SUMMARY-1','Sum of open card currents = Summary current');
else fail('H-SUMMARY-1','sum=' + Math.round(openCardSum) + ' vs summary=' + summCurrent);

// H-SUMMARY-4: total = unrealized + realized
const unrealized = (summCurrent||0) - (summInvested||0);
const calcTotal = unrealized + (summRealized||0);
console.log('H-SUMMARY-4: unrealized=' + Math.round(unrealized) + ' + realized=' + summRealized + ' = ' + Math.round(calcTotal) + ' vs summTotal=' + summTotal);
if(close(calcTotal, summTotal, 0.02)) pass('H-SUMMARY-4','Total = unrealized + realized');
else fail('H-SUMMARY-4','calc=' + Math.round(calcTotal) + ' vs display=' + summTotal);

// H-SORT-1
let sortOk=true;
for(let j=1;j<cardCurrents.length;j++){
  if(cardCurrents[j]!=null && cardCurrents[j-1]!=null && cardCurrents[j]>cardCurrents[j-1]+1){
    sortOk=false; break;
  }
}
if(sortOk) pass('H-SORT-1','Cards in descending current value order');
else fail('H-SORT-1','Not sorted desc: ' + JSON.stringify(cardCurrents.map(v=>Math.round(v||0))));

// ─── H-FILTER-1: Open filter hides closed ────────────────────────────────────
const openLines = await nav('/holdings/segment/total', {'hp:holdingFilter':'open','hp:showClosed':'false'});
const openTabIdx = openLines.indexOf('Dividends');
const openHoldLines = openLines.slice(openTabIdx+1);
const hasZeroCard = openHoldLines.some(l=>l==='₹0');
if(!hasZeroCard) pass('H-FILTER-1','No zero-current cards in Open filter');
else fail('H-FILTER-1','Found ₹0 card in Open filter');

// ─── H-FILTER-2: Closed filter ───────────────────────────────────────────────
const closedLines = await nav('/holdings/segment/total', {'hp:holdingFilter':'closed','hp:showClosed':'false'});
const closedTabIdx = closedLines.indexOf('Dividends');
const closedHLines = closedLines.slice(closedTabIdx+1);
// In closed filter, all card currents should be 0
const closedCardCurrents = [];
for(let i=0;i<closedHLines.length;i++){
  if(closedHLines[i+1] && closedHLines[i+1].startsWith('LTP')){
    closedCardCurrents.push(parseVal(closedHLines[i+2]));
    i+=2;
  }
}
console.log('\nClosed filter card currents: ' + JSON.stringify(closedCardCurrents.map(v=>Math.round(v||0))));
const allZero = closedCardCurrents.every(v=>v==null||v===0);
if(closedCardCurrents.length===0) warn('H-FILTER-2','No closed cards found in demo data');
else if(allZero) pass('H-FILTER-2','Closed filter shows only ₹0 current cards');
else fail('H-FILTER-2','Non-zero current in closed filter: ' + JSON.stringify(closedCardCurrents));

// ─── H-FILTER-3: All current = Open current ──────────────────────────────────
const openSumIdx = openLines.indexOf('ALL HOLDINGS');
const openSummCur = parseVal(openLines[openSumIdx+1]);
const allHIdx2 = totLines.indexOf('ALL HOLDINGS');
const allSummCur = parseVal(totLines[allHIdx2+1]);
console.log('\nH-FILTER-3: All cur=' + allSummCur + ' Open cur=' + openSummCur);
if(close(allSummCur, openSummCur)) pass('H-FILTER-3','All current = Open current');
else fail('H-FILTER-3','All=' + allSummCur + ' Open=' + openSummCur);

// ─── H-FILTER-5: Closed Today = — ────────────────────────────────────────────
const closedTodayVals = [];
for(let i=0;i<closedHLines.length;i++){
  if(closedHLines[i]==='Today') closedTodayVals.push(closedHLines[i+1]);
}
console.log('H-FILTER-5 closed Today vals: ' + JSON.stringify(closedTodayVals));
if(closedCardCurrents.length===0) warn('H-FILTER-5','No closed cards in demo data');
else if(closedTodayVals.every(v=>v==='—')) pass('H-FILTER-5','Closed cards show — for Today');
else fail('H-FILTER-5','Some closed cards show Today gain: ' + JSON.stringify(closedTodayVals));

// ─── H-SUMMARY-5: Open + Closed realized = All realized ─────────────────────
const allSummRealLine  = totLines.find(l=>l.startsWith('Realized'));
const openSummRealLine = openLines.find(l=>l.startsWith('Realized'));
const clsdSummRealLine = closedLines.find(l=>l.startsWith('Realized'));
const allReal  = parseVal((allSummRealLine||'').replace('Realized',''));
const openReal = parseVal((openSummRealLine||'').replace('Realized',''));
const clsdReal = parseVal((clsdSummRealLine||'').replace('Realized',''));
console.log('\nH-SUMMARY-5: open=' + openReal + ' closed=' + clsdReal + ' all=' + allReal);
if(openReal!=null && clsdReal!=null && allReal!=null){
  const sumR = (openReal||0) + (clsdReal||0);
  if(close(sumR, allReal, 0.02)) pass('H-SUMMARY-5','Open+Closed realized = All realized (' + Math.round(sumR) + ' vs ' + allReal + ')');
  else fail('H-SUMMARY-5','Sum=' + Math.round(sumR) + ' vs All=' + allReal);
} else warn('H-SUMMARY-5','Could not parse all realized values');

// ─── H-GROUP-1/2: Grouped vs Standalone ──────────────────────────────────────
const groupedLines = await nav('/holdings/segment/total', {'hp:holdingFilter':'all','hp:viewMode':'cumulative'});
const standaloneLines = await nav('/holdings/segment/total', {'hp:holdingFilter':'all','hp:viewMode':'standalone'});
const gTabIdx = groupedLines.indexOf('Dividends');
const sTabIdx = standaloneLines.indexOf('Dividends');
const gNames=[], sNames=[];
const gH = groupedLines.slice(gTabIdx+1);
const sH = standaloneLines.slice(sTabIdx+1);
for(let i=0;i<gH.length;i++){ if(gH[i+1]&&gH[i+1].startsWith('LTP')){ gNames.push(gH[i]); i+=2; } }
for(let i=0;i<sH.length;i++){ if(sH[i+1]&&sH[i+1].startsWith('LTP')){ sNames.push(sH[i]); i+=2; } }
console.log('\nH-GROUP: grouped=' + gNames.length + ' standalone=' + sNames.length);
console.log('Grouped names: ' + JSON.stringify(gNames));
console.log('Standalone names: ' + JSON.stringify(sNames));
if(sNames.length >= gNames.length) pass('H-GROUP-1/2','Standalone(' + sNames.length + ') >= Grouped(' + gNames.length + ')');
else fail('H-GROUP-1/2','Standalone(' + sNames.length + ') < Grouped(' + gNames.length + ')');

// ─── H-SORT-2: Ascending sort ────────────────────────────────────────────────
const ascLines = await nav('/holdings/segment/total', {'hp:holdingFilter':'all','hp:viewMode':'cumulative','hp:sortField':'current','hp:sortDir':'asc'});
const ascTabIdx = ascLines.indexOf('Dividends');
const ascH = ascLines.slice(ascTabIdx+1);
const ascVals = [];
for(let i=0;i<ascH.length;i++){ if(ascH[i+1]&&ascH[i+1].startsWith('LTP')){ ascVals.push(parseVal(ascH[i+2])); i+=2; } }
console.log('\nH-SORT-2 asc: ' + JSON.stringify(ascVals.map(v=>Math.round(v||0))));
let ascOk=true;
for(let j=1;j<ascVals.length;j++){ if(ascVals[j]!=null&&ascVals[j-1]!=null&&ascVals[j]<ascVals[j-1]-1){ascOk=false;break;} }
if(ascOk) pass('H-SORT-2','Ascending sort works');
else fail('H-SORT-2','Not ascending: ' + JSON.stringify(ascVals.map(v=>Math.round(v||0))));

// ─── H-CARD-1: XIRR colors ───────────────────────────────────────────────────
await nav('/holdings/segment/total', {'hp:holdingFilter':'all','hp:viewMode':'cumulative','hp:sortField':'current','hp:sortDir':'desc'});
const xirrData = await page.evaluate(()=>{
  return Array.from(document.querySelectorAll('span'))
    .filter(el=>el.textContent && el.textContent.trim().startsWith('XIRR') && el.textContent.trim().length < 20)
    .map(el=>({text:el.textContent.trim(), bg:getComputedStyle(el).backgroundColor}));
});
console.log('\nH-CARD-1 XIRR elements: ' + JSON.stringify(xirrData));
let colorOk=true;
for(const x of xirrData){
  const isPos = !x.text.includes('-');
  const hasGreen = x.bg.includes('rgb(209') || x.bg.includes('rgb(187') || x.bg.includes('rgb(191') || x.bg.includes('rgb(16');
  const hasRed   = x.bg.includes('rgb(254') || x.bg.includes('rgb(252');
  if(isPos && hasRed){ colorOk=false; console.log('WRONG: positive XIRR has red bg: ' + x.text + ' bg=' + x.bg); }
  if(!isPos && hasGreen){ colorOk=false; console.log('WRONG: negative XIRR has green bg: ' + x.text + ' bg=' + x.bg); }
}
if(xirrData.length===0) warn('H-CARD-1','No XIRR span elements found');
else if(colorOk) pass('H-CARD-1','XIRR colors correct (green=pos, red=neg)');
else fail('H-CARD-1','XIRR color mismatch found');

// ─── H-CARD-2: Today gain non-null for open cards ────────────────────────────
const openL2 = await nav('/holdings/segment/total', {'hp:holdingFilter':'open'});
const oTabIdx2 = openL2.indexOf('Dividends');
const oH2 = openL2.slice(oTabIdx2+1);
const todayVals = [];
for(let i=0;i<oH2.length;i++){ if(oH2[i]==='Today') todayVals.push(oH2[i+1]); }
const withVal = todayVals.filter(v=>v&&v!=='—').length;
const withDash = todayVals.filter(v=>v==='—').length;
console.log('\nH-CARD-2: ' + withVal + ' have Today value, ' + withDash + ' show —');
if(withVal>0) pass('H-CARD-2',withVal + ' open cards show Today gain');
else fail('H-CARD-2','No Today gain on open cards');

await browser.close();
console.log('\n=== Done ===');
