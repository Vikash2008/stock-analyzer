import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 430, height: 932 });

function getLines() {
  return page.evaluate(() =>
    document.body.innerText.split('\n').map(l=>l.trim()).filter(l=>l)
  );
}

function parseVal(s) {
  if (!s) return null;
  s = s.replace(/[₹$,\s]/g,'').replace(/^\+/,'');
  let m=1;
  if(s.endsWith('Cr')){m=1e7;s=s.slice(0,-2);}
  else if(s.endsWith('L')){m=1e5;s=s.slice(0,-1);}
  else if(s.endsWith('K')){m=1e3;s=s.slice(0,-1);}
  const n=parseFloat(s); return isNaN(n)?null:n*m;
}

// ── H-SUMMARY ──────────────────────────────────────────────────────────────
console.log('\n=== /holdings/segment/total ===');
await page.goto(BASE+'/holdings/segment/total',{waitUntil:'networkidle',timeout:30000});
await page.waitForTimeout(2500);
const totalLines = await getLines();
totalLines.forEach((l,i)=>console.log(`${i}: ${l}`));
await page.screenshot({path:'C:/tmp/h_total.png',fullPage:true});

// H-SUMMARY-4: Total gain = unrealized + realized
// Extract summary numbers
const summaryText = totalLines.slice(0,15).join('|');
console.log('\n[SUMMARY TEXT]', summaryText);

// ── H-FILTER tests ─────────────────────────────────────────────────────────
// Find settings/gear button
console.log('\n=== FILTER: Looking for gear/settings ===');
const gearBtn = page.locator('button').filter({ hasText: /⚙|☰|filter|settings/i }).first();
const gearCount = await page.locator('button[aria-label], button').filter({hasText:/[⚙]/}).count();
console.log('Gear candidates:', gearCount);

// Try clicking the gear icon (usually has aria-label or SVG)
const allBtns = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button')).map(b=>({text:b.textContent?.trim().slice(0,30), aria:b.getAttribute('aria-label')}))
);
console.log('All buttons:', JSON.stringify(allBtns.slice(0,20)));

// ── H-SORT-1: Default sort = current value descending ──────────────────────
console.log('\n=== H-SORT-1: Default sort check ===');
// Holding cards current values should be descending
const cardVals = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"]'));
  return cards.map(c => c.textContent?.trim().slice(0,80)).filter(Boolean).slice(0,10);
});
console.log('Card samples:', cardVals);

// ── H-GROUP tests ──────────────────────────────────────────────────────────
console.log('\n=== /holdings/segment/total full lines ===');
// Already have totalLines above

// ── H-CARD-1: XIRR color check ─────────────────────────────────────────────
console.log('\n=== XIRR color from DOM ===');
const xirrColors = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  return all
    .filter(el => el.textContent?.includes('XIRR') && el.children.length <= 2)
    .slice(0,10)
    .map(el => ({ text: el.textContent?.trim().slice(0,40), color: getComputedStyle(el).color }));
});
console.log('XIRR elements:', JSON.stringify(xirrColors,null,2));

// ── H-FILTER: Open / Closed / All ──────────────────────────────────────────
console.log('\n=== Filter: Check gear button via SVG ===');
const svgBtns = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button, [role="button"]'))
    .map(b=>({txt: b.innerText?.trim(), title: b.title, cls: b.className?.slice(0,50)}))
    .filter(b=>b.txt||b.title)
    .slice(0,30)
);
console.log('Buttons:', JSON.stringify(svgBtns,null,2));

await browser.close();
