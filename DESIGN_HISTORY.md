# Design Decisions Log — Archive

> Archived from DESIGN.md. See DESIGN.md for the 15 most recent entries.

| Date | Decision | Reason |
|------|----------|--------|
| 2026-05-24 | Migrated from Streamlit to React + FastAPI | Better mobile UX, PWA support, instant navigation |
| 2026-05-24 | Single bundle fetch on load | All filtering client-side â†’ sub-100ms page transitions |
| 2026-05-24 | Render free tier for backend | No credit card, acceptable cold start for personal use |
| 2026-05-24 | Vercel for frontend | Free, auto-deploys from GitHub, global CDN |
| 2026-05-24 | PWA manifest added | "Add to Home Screen" opens standalone (no browser bar) |
| 2026-05-24 | Fixed P&L double-count | Equity + MF_Portfolio (SKIP_PORTS) excluded from all totals |

### 2026-07-02 (session 163)

**Transactions page unified to Holdings' teal design language** — tab bar switched from per-tab teal/sky/violet/rose to the single `#0b3b3a→#0d9488` gradient; txn-count/add-txn row, Report strip (sub-tabs, gear popover, AI Assistant button), Notes strip, and Charts strip (metric pills, sync button) all recolored to teal; per-section chart line colors (`METRIC_HEX`) and gain/loss green/red left untouched as semantic data.

**Deep Research cards recolored to one teal accent** — all 8 `SECTIONS` in `reportLinks.ts` (previously blue/sky/indigo/cyan/emerald/green/blue-50 per card) now share `bg-teal-50`/`border-teal-200`/`accentHex: #0d9488`; the "Research" button switched from per-section outline to a solid `#0b3b3a→#0d9488` pill with bold white text.

**Research Links (Explore tab) made compact + teal** — rows tightened (`py-2.5`→`py-1.5`, `gap-2`→`gap-1.5`), per-site icon colors (blue/purple/orange/red) replaced with a single teal icon/border/text treatment.

**Add Transaction modal (Txn page) merged into Settings** — the inline "Add Txn" pill and separate "Deep Research Settings" gear were both folded into one top-bar Settings popover with three rows (Add Transaction, AI Model, API Key); Model/API Key rows changed from stacked label+full-width-toggle to inline label-left/toggle-right layout, popover widened to `300px` (`max-w-[calc(100vw-24px)]`) with `whitespace-nowrap` on all pills so options never wrap.

**AddTransactionModal (Add Holding) compacted + recolored** — padding/spacing tightened throughout (`p-2.5`→`p-2`, `space-y-2.5`→`space-y-1.5`, shorter header/footer); BUY/SELL toggle and all emerald accents switched to the teal `#0b3b3a→#0d9488` gradient language.

**Holdings Analysis tab (Allocation/Benchmarking/Returns) unified to teal** — sub-tab bar (was orange/sky/emerald per tab) now single teal gradient; "By Sector"/"By Market Cap"/"By Holdings Concentration" headings and their table-header rows (was blue/orange/emerald/violet) recolored teal, each section given a `border-l-4 border-l-teal-500` accent bar; Benchmarking's loading bars, date-filter chip/popover, sector table header, and "By Sector" accent bar switched from sky/green to teal; Returns tab's settings popover rebuilt with the same teal gradient header shell as other Settings modals, Period toggle's sliding indicator changed from white to teal-filled. Per-sector chart/pie colors and green/red gain-loss indicators explicitly left untouched (user confirmed those should stay).

**AnalysisTab "Add Note" button** — height reduced (`py-3`→`py-1.5`) and color changed from blue (`#2563eb`) to the teal `#0b3b3a→#0d9488` gradient.

### 2026-07-02 (session 162)

**FxGainsTab and DividendsTab restyled to match** — all section titles (FX Conversion Gains, Rate Buckets, Timeline, Per Holding, Dividend Income, Year-by-year, By stock) converted to white-text rounded pill badges filled with the `#0b3b3a→#0d9488` gradient. Per-holding/per-stock rows in both tabs gained a relative-magnitude progress bar (teal gradient fill, same style as Rate Buckets). Value/symbol text unified to `#0b3b3a`. Dividends summary strip merged from 4 separate cards into one bordered box under a single pill header, mirroring FX's Section 1 layout.

**Top bar redesign on Overview/Holdings/Txn** — nav bar switched from flush borderless gradient to a bordered box: `border-4` solid `#0b3b3a`, `rounded-t-[14px]` (down from an interim 18px), fill lightened to `#14746f→#14b8a6`. Bar still sits flush against the hero/summary card below (no gap) — border only wraps the bar itself, not merged into one continuous outline with the card.

**LTP added to HoldingCard and SummaryCard** — `HoldingCard.tsx` shows LTP top-right of the holding-name row; `SummaryCard.tsx` gained an optional `ltp?` prop rendered top-right of the label row, wired on `TransactionsPage.tsx` from `holding.current_price`. Fixed a white-screen crash from the initial `HoldingCard` LTP addition — `ltp` was added to the props interface but never destructured in the function signature (`ReferenceError`).

**Holdings page tab bar unified to one accent** — the 4-5 tabs (Holdings/Charts/Analysis/Dividends/FX) previously had per-tab active colors (teal/sky/violet); now all use the same `#0b3b3a→#0d9488` gradient with white text when active.

**Misc Holdings/Txn polish** — back-button label bumped `14px`→`17px`; Holdings search/sort/sector strip recolored to match the new lighter top-bar gradient; page-edge gutter halved (`px-2`→`px-1`) on Overview/Holdings.

### 2026-07-02 (session 164)

**Top-bar corners squared off** — removed `rounded-t-[14px]` from the nav bar on Overview/Holdings/Txn (now flush rectangular corners).

**Holdings search/sort strip flipped to white with teal chrome** — outer strip and search input switched from teal-filled to `bg-white` with a teal border (later softened to `border-teal-100` — the original `border-2 border-teal-600` read as too heavy); search icon enlarged 10px→13px; Sector/Sort text switched from white to `text-teal-700`.

**Page-edge gutters halved again** — Holdings/Overview `px-1`→`px-0.5`, Txn `px-2`→`px-1`.

**DividendsTab top padding removed** — dropped `pt-2` on the root wrapper to close the gap above the Dividend Income box, matching FxGainsTab's no-padding pattern.

**Txn Charts range selector recolored** — active-range pill color was still blue (`#2563eb`, pre-teal-unification leftover) on both the inline and landscape-zoom range bars; switched to teal `#0d9488`.

**Deep Research card header row tightened + top-aligned** — chevron+emoji now `items-start` (was `items-center`, which vertically centered them against the full two-line title+description block instead of aligning with the heading); chevron placeholder shrunk `w-3`→`w-2`, row `gap-2`→`gap-1`, header `px-3`→`pl-1.5 pr-3` to pull content off the left border.

**Quick Stats metric grid recolored to teal** — tile labels `text-emerald-600/70`→`text-teal-600/70`; neutral (non-signal) values `#1e293b`→teal `#0f766e`. ROCE/ROE/ROA/margin/growth tiles keep their green/red `colorNum()` signal coloring untouched (same rule as gain/loss elsewhere).

**HoldingCard compacted** — `py-1.5`→`py-1`, Today/Total divider `mt-1 pt-1`→`mt-0.5 pt-0.5`; right padding bumped `pr-2`→`pr-3.5` so LTP and Total get breathing room from the border.

**SummaryCard Invested/Realized + FX/Dividend rows merged into one shared grid** — was two independent `flex justify-between` rows (each right-aligning to its own container edge), so "Realized" and "Dividend" didn't line up. Now one `grid-template-columns: 1fr auto` grid across both rows — column 2 auto-sizes to the wider of the two labels and hugs the real right edge (matching the XIRR badge), giving true cross-row alignment. Redundant `+` prefix removed from FX gains/Dividend lines since `fmtCompactGainLine()` already prepends a ▲/▼ arrow.

### 2026-07-02 (session 165)

**Top bar switched from filled gradient to outline-only** — Overview/Holdings/Txn nav bar background changed from the `#14746f→#14b8a6` gradient fill to a very light teal (`#e6f7f5`), border kept solid `#0b3b3a`, corners rounded again (`rounded-t-[14px]`, reversing session 164's squaring-off). Text/icons (back label, refresh, settings gear) switched from white to `#0b3b3a` to stay readable against the light fill.


### 2026-07-02 (session 161)

**Dark teal green applied to Charts/Dividends/FX tabs** — Holdings Charts tab metric buttons + range selector, `DividendsTab.tsx`, and `FxGainsTab.tsx` all switched their selected/accent colors from mixed per-metric hues (blue/violet/pink/rose/teal-500) to the shared `#0b3b3a→#0d9488` gradient (or flat `#0b3b3a` for text), matching the summary card. Chart metrics strip's outer container fill/border removed per follow-up (buttons only, no wrapper chrome).

**Top bar + hero/summary card unified across Overview, Holdings, and Txn pages** — `TransactionsPage.tsx` nav bar and per-symbol card rebuilt to match Holdings exactly (same gradient nav bar, same `SummaryCard` component instead of bespoke markup). `PortfoliosPage.tsx`'s "Total Portfolio" hero card also switched from bespoke markup to the shared `SummaryCard` (added `onClick` prop to the component for hero-card navigation). All three nav bars set to `min-h-[46px]` (not `min-h-[30px]` — Tailwind border-box sizing counts padding, so a 30px min-height on a `py-2` bar under-sized it by 16px versus the naturally-30px-content Holdings bar). Gap between nav bar and card set to `mb-[3px]` (halved from `mb-1.5` per follow-up) and the `pt-1` above the nav bar removed on all three, so the bar sits flush at the top everywhere.

**Dividend/FX toggle display bug fixed** — `SummaryCard` was hiding the Dividend/FX row whenever the amount was exactly 0, making "toggle off" indistinguishable from "toggle on but ₹0". Callers (`HoldingsPage.tsx`, `PortfoliosPage.tsx`) now pass `dividends`/`fxGain` whenever their respective toggle is on (not gated on `amount > 0`), and `SummaryCard` renders the row based on the prop being defined, not its value.

### 2026-07-02 (session 159)

**Manage Portfolio / Manage Buckets / Delete Holding modals matched to Settings design language** — headers switched to `linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)` with circular `✕` close button (same shell as `ManageBucketsModal`/Settings popover); Delete Holding's boxes/borders/toggle recolored from rose to emerald, keeping red only on the actual Delete/Continue destructive buttons.

**ManagePortfolioModal repositioned + compacted** — moved from centered overlay to anchored top-right (`right` computed via `calc((100vw-576px)/2 + 0.75rem)` so it hugs the app's `max-w-xl` column edge on desktop instead of the raw browser edge); option rows tightened (smaller padding/text) with labels colored `#0b3b3a`.

**ManageBucketsModal redesigned** — bucket list is now white cards with a tinted header strip and icon-based delete (trash icon) instead of plain text rows; label rows use a grip-dots drag handle; width reduced to 320px, "add label" input moved into the bucket header row (next to hide-toggle/delete), and "+ Create bucket" moved to the top next to the bucket count for a smaller, denser modal.

### 2026-06-29 (session 156)

**Dividends loading progress bar** — replaced "Fetching… ~30s" spinner with determinate `h-1` teal bar showing `loadedCount / totalCount` symbols. Same bar used during background re-fetch (replaces infinite-sweep animation when `totalCount > 0`).

**PriceChart "Fetching more data…" indicator** — background-fetch indicator upgraded from `text-[9px] text-slate-400 "Refreshing…"` to `text-xs text-slate-500 "Fetching more data…"` for visibility on 5Y/All load.

### 2026-06-21 (session 146)

**In-app dialogs replace native browser confirm()/select() in Delete/Copy Holdings modals**
- `window.confirm()` and a native `<select>` for "Add a broker" looked like a system popup, not part of the app. Replaced with a rose-styled in-app confirm overlay (Cancel/Continue) in Delete Holding, and a custom button+list dropdown in Copy Holdings, matching each modal's existing visual language.

**Manage Buckets: label reorder via drag handle, not tiny ▲▼ buttons**
- The old up/down buttons were small (9px text) and fiddly on mobile. Replaced with a single grip handle (≡, 44px touch target) using native Pointer Events — press and drag, list reorders live as you cross another row's midpoint, no new dependency added.

### 2026-06-21 (session 145)

**XIRR 0(0%)-not-dash rule moved from display layer to the math layer**
- Session 143 established "default to 0(0%) instead of —" for no-data XIRR, but each card was implementing this differently — `BreakCard` defaulted `null`→`0.0%` at render time while `SummaryCard` didn't, so the same null computation showed inconsistently across pages. Fixed by making `computeXIRR`/`xirr()` themselves return `0` for "no signal yet" (too few cashflows, no sign mix, sub-1-day span) — every card now renders identically off one source of truth, and `—` is reserved for an actual solver failure

### 2026-06-22 (session 150)

**Deep Research settings gear moved from pill-bar into the top nav banner**
- Now matches the back-button-left/gear-right pattern every other page uses; only renders when the Deep Research sub-tab is active. Modal redesigned to match the app's standard popover shell (gradient header + bordered section boxes) instead of a plain white dropdown, using violet to tie to Deep Research's own accent color.

**AI Assistant button restyled to stand out**
- Flat solid-violet pill → fuchsia→violet→indigo gradient with a soft colored glow shadow + white ring, now alone at the far right of the pill bar since the gear moved out.

**In-chat context-scope picker added instead of per-card AI icons**
- Considered a separate Gemini icon per research card; rejected as redundant since each card isn't an independent live action. Instead added an "Asking about: X ▾" picker inside the existing chat sheet so one question can target a single card or all cards — switchable mid-conversation, not locked at open time.

**Quick Stats footer links (Yahoo Finance / Analyst Ratings) removed**
- Redundant with the Research Links pills tab; cut to declutter the card footer.

### 2026-07-02 (session 160)

**Overview + Holdings top bar / hero card parity** — both pages' nav bar and hero/summary card iterated to a shared final shape: rectangular bar (no rounding), `mb-1.5` gap, card with square top corners + `rounded-b-[18px]` bottom, drop shadow kept. `HoldingsPage.tsx` nav bar matched to Overview's `px-4 py-2` sizing.

**Overview font-size pass** — bumped text across `BreakCard`, asset-class tiles, hero card, Breakdown toggle, and Explore search results (symbol/name/exchange) for legibility; micro uppercase labels (Today/Total) nudged 8→9px.

**HoldingCard tweaks** — right padding reduced (`px-3`→`pl-3 pr-2`), border darkened `#eef1f5`→`#cbd5e1`, name/subLabel color set to `#0b3b3a`.

**Holdings search/sort/sector strip** — background switched from `bg-teal-50` to the nav bar's exact `#0b3b3a→#0d9488` gradient; sort button and sector filter (inactive state) now bold white text with no separate pill background, matching each other.

**Settings modal copy** — "Backup (with tags)" renamed to "My Portfolio".

**ManageBucketsModal** — "Add label" control redesigned with the `+` button moved inside the input box (absolute-positioned icon) instead of beside it; placeholder changed `+label`→`Add label`; general text sizes bumped modal-wide (header 13→15px, bucket name 11→13px, label chip 11→13px) while the New-bucket/Add-label input text stays smaller (11px) than surrounding text since it sits inside a box.

**AddTransactionModal ("Add Holding") restyled** — replaced old `bg-gradient-to-r from-emerald-600 to-teal-500` header + `×` text-button with the Settings-modal shell (`#0b3b3a→#0d9488` header gradient, circular `✕` close button, `#f8fafc` body); section card backgrounds switched to `bg-emerald-50/60`, section labels recolored to `#0b3b3a`, submit button gradient matched to the app's primary CTA style.

### 2026-07-02 (session 158)

**Dark-green theme unified across Holdings + Overview** — `HoldingsPage.tsx` nav bar switched to same `linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)` as Overview; `SummaryCard.tsx` rebuilt as dark hero card (Invested/Realized row + conditional FX/Dividend row + Today/Total gains row); `HoldingCard.tsx` restyled to compact card — XIRR pill beside value, gain% pill, light green/red background tint by total gain, ▲/▼ tickers everywhere via shared `fmtCompactGainLine`.

**Settings modals reverted to anchored top-right dropdown** (both pages) — user preferred this over the bottom-sheet tried earlier; `w-[320px] max-w-[calc(100vw-24px)]`, own `maxHeight`/scroll. Row/button/toggle colors unified to the `#0b3b3a→#0d9488` gradient + `emerald-50/60` row bg across Overview Settings, Holdings Settings, and `ManageBucketsModal.tsx`.

**Overview card palette restricted to green/blue only** — removed stray purple (`#8b5cf6`) from `BROKER_GROUPS`; `CARD_COLOR_PALETTE` now cycles teal/blue/cyan/emerald/sky; Explore modal widened to full mobile width (dropped outer `px-4`); Breakdown heading + toggle enlarged and recolored to match `#0b3b3a`.

### 2026-07-02 (session 157)

**Overview page design language** — dark navy hero card (`linear-gradient(150deg, #10243f 0%, #0b3b3a 100%)`) with teal radial glow; all non-hero cards use `#0d9488` teal left-border accent (red `#f43f5e` when returns negative); settings modal converted to full-width bottom sheet; explore modal redesigned with same dark header, teal pill search, avatar result rows, blue recent chips.

**Compact card pattern** — non-hero cards: `px-2 py-1.5`, label `text-[9.5px] mb-0.5`, value `text-[14px]`, bottom gains row `mt-1 pt-1`; asset tiles and BreakCard use same pattern; `CARD_COLOR_PALETTE` added for dynamic bucket labels.

**Holdings mockup** — `design-mockups/holdings-page.html` created matching overview design language: dark hero, compact holding rows with left-accent border (green pos / red neg), avatar circles, teal filter strip.

### 2026-06-28 (session 154)

**ManageBucketsModal compacted** — drag handle `w-11 h-11` → `w-7 h-7`, label rows `py-1` → `py-0.5`, bucket cards `p-3` → `p-2`, scroll area `px-4 py-4` → `px-3 py-2.5`, header `py-3` → `py-2`. User explicitly requested compact; touch targets intentionally below 44px in this modal.

**Quick Stats duplicate refresh button removed** — top "Refresh" pill (next to "Updated" timestamp) removed; only the "Retry" button (shown when stats unavailable) remains. Timestamp moved to below the Retry button. Spinner now uses `refetchQueries` instead of `resetQueries` so it stays active until data arrives.
| 2026-05-24 | Added Stocks + MF tiles to PortfoliosPage | Quick segment overview with XIRR + today % |
| 2026-05-24 | By Broker / By Type breakdown toggle | Replaces flat portfolio list; portfolio cards now include realized P&L in return % |
| 2026-05-24 | XIRR added to bundle | Computed per portfolio + stk/mf/total using existing portfolio_xirr(); shown on hero + tiles |
| 2026-05-24 | 7 historical line charts on HoldingsPage | Client-side via usePortfolioHistory + xirr.ts; no new backend endpoint needed |
| 2026-05-24 | PortfoliosPage header cleanup | Removed currency toggle; IST timezone on timestamp; bigger section labels; Stocks/MF tiles match hero 3-row layout |
| 2026-05-24 | Range selector segmented control | iOS-style bg-slate-100 pill replaces scrollable border buttons |
| 2026-05-24 | SummaryPage removed | Unreachable from UI â€” dead code removed |
| 2026-05-24 | XIRR on HoldingCard | Client-side per-symbol XIRR (BUY/SELL cashflows + terminal value Ã— 100) |
| 2026-05-24 | XIRR on BreakCards (Overview) | Broker: from xirr_by_portfolio bundle; Type: computed client-side |
| 2026-05-24 | By Type default on Overview | More useful than By Broker as landing view |
| 2026-05-24 | TransactionsPage Charts tab | 8-metric pills: Price (PriceChart + range) + 7 historical series scoped to one holding |
| 2026-05-24 | Sort control on HoldingsPage | 7 sort fields, asc/desc toggle, default Current Value â†“ |
| 2026-05-24 | Back label via nav state | Transactions page back button reflects origin (portfolio or segment name) |
| 2026-05-24 | Analysis tab with Notes | localStorage per portfolio:symbol; add/edit/delete; IST timestamp on each note |
| 2026-05-24 | Today/Total labels on all cards | Subtle 9px slate-400 label before each gain value; consistent across all card types |
| 2026-05-24 | Compact number format for gains | fmtCompact/fmtCompactGainLine: â‚¹23.4K instead of â‚¹23,432; avoids long numbers in tight layouts |
| 2026-05-24 | shrink-0 whitespace-nowrap on gain spans | Prevents Today/Total gain labels from wrapping to next line on narrow cards |
| 2026-05-24 | Company name only on HoldingCard | Show subLabel (company) instead of SYMBOL Â· company; falls back to symbol if no name |
| 2026-05-24 | Bold slate-700 name labels on all cards | Name/label row: font-bold text-slate-700 (was text-slate-400) for visual prominence |
| 2026-05-24 | Stocks/MF tiles layout restructured | 3 rows: label / value+XIRR / Today+Total â€” prevents overflow in half-width tiles |
| 2026-05-24 | Timestamp + refresh moved to page bottom | Cleaner hero-first view; timestamp sits at footer of PortfoliosPage |
| 2026-05-24 | Phase 5/6 removed from roadmap | Items dropped; no further backlog tracked |
| 2026-05-24 | Stocks/MF tiles changed to full-width stacked | Prevents mobile overflow; matches BreakCard style (9px label, 15px value, same 3-row layout) |
| 2026-05-24 | Pull-to-refresh: blocked native, added custom swipe gesture | Native reload caused full React restart + white screen; custom gesture does data-only refresh |
| 2026-05-24 | Chart loading progress on HoldingsPage | usePortfolioHistory fires N parallel queries; expose loadedCount+totalCount to show real X/Y % bar |
| 2026-05-24 | Chart loading Step 1/2 on TransactionsPage | Single-symbol fetch â†’ no real %; Step 1/2 label at 50% is honest; Step 2 (useMemo) is synchronous so never shown |
| 2026-05-24 | useForceRefresh: removed invalidateQueries | Prevented white screen during refresh by keeping stale data visible |
| 2026-05-24 | Bottom bar sync: right-aligned â†» + timestamp as one tappable unit | Cleaner than split layout; icon spins until data updates |
| 2026-05-24 | PWA service worker via vite-plugin-pwa | Precaches app shell on first load; instant open, no white screen on reopen; autoUpdate SW on new deploy |
| 2026-05-24 | Persistent chart cache via TanStack Query persister (localStorage, 7-day) | Scoped to ['history'] queries only; chart data survives app restarts; force refresh clears it |
| 2026-05-24 | SummaryCard XIRR layout â€” row 3 XIRR left / Total right | Matches HoldingCard 3-row layout for visual consistency across all cards |
| 2026-05-24 | TransactionsPage top card: XIRR unstyled, Today/Total labels, fmtCompactGainLine | Font consistency with HoldingsPage; no rogue bold styles |
| 2026-05-24 | PWA auto-reload on SW update (controllerchange listener in App.tsx) | autoUpdate activates new SW silently but doesn't reload page; listener forces reload so Vercel deploys are immediately visible |
| 2026-05-24 | skipWaiting + clientsClaim in Workbox config | Without these, new SW waits for all tabs to close before activating â€” on mobile PWA this never happens; now activates immediately on every deploy |
| 2026-05-24 | Sync icon (â†») on Charts tab header in TransactionsPage | Clears per-symbol history cache and re-fetches; spins 1.2s; only visible when Charts tab active |
| 2026-05-27 | visibilitychange SW update check in App.tsx | Mobile PWA resumes from background without triggering navigation; explicit reg.update() on visibilitychange ensures latest code loads on every foreground |
| 2026-05-27 | Keep-alive ping via GitHub Actions | Cron every 14 min hits /health to prevent Render free tier cold start; jitter may occasionally miss 15-min window |
| 2026-05-27 | Realized P&L bug fix for segment views | summaryStats now iterates data.realized directly (with segment classification via getSegmentType) instead of filteredHoldings symbol-by-symbol â€” fully-exited positions were previously excluded |
| 2026-05-27 | Open/Closed/All toggle on HoldingsPage | Closed positions derived from data.realized (symbols with realized entries but no open holding); shown as HoldingCards with current=0 and XIRR from BUY+SELL cashflows only |
| 2026-05-27 | Grouped/Each + Open/Closed/All on one line as sliders | iOS-style segmented controls (translateX sliding indicator); text-[8px], very compact; replaces separate pill buttons on separate lines |
| 2026-05-27 | Each mode: company name as subLabel | Was showing portfolio (broker) name in standalone mode; now always shows company name |
| 2026-05-24 | Static data/names.json for company names on Render | Render free tier has ephemeral disk â€” yfinance info calls fail after each deploy; names.json committed to git ensures names always load correctly |
| 2026-05-24 | serializers.py sanitizes inf values | _clean() now handles math.isinf() alongside math.isnan(); all scalar fields and xirr_by_portfolio also wrapped in _clean() |
| 2026-05-27 | Settings gear icon on HoldingsPage | Replaces plain header; opens popover with Open/Closed/All slider, Show Closed toggle (All mode only), Grouped/Standalone slider (segment only) |
| 2026-05-27 | Filter-aware summary card | displayStats + filteredSummaryXirr useMemos update XIRR + realized P&L when Open/Closed/All filter changes; Open realized = All âˆ’ Closed to ensure Open + Closed = All exactly |
| 2026-05-27 | Show Closed toggle (All mode, display only) | Appends closed rows to sorted open list; no impact on summary stats |
| 2026-05-27 | Sort fix for closed rows | Extracted sortFn applied equally to both open and closed row arrays; closed rows were previously unsorted |
| 2026-05-27 | Scroll save/restore via sessionStorage | HoldingsPage saves window.scrollY on holding card click; restores on back; TransactionsPage always opens at top |
| 2026-05-27 | "Analysis" tab renamed "Notes" on TransactionsPage | Tab type changed from 'analysis' to 'notes'; display label unchanged |
| 2026-05-27 | TxRow redesign with GainGrid | Left: date + qtyÂ·price/sh = invested amount; Right: current value (invested) + 3-col CSS Grid (qty/dir | label | gain+pct); minWidth:210 ensures 1fr col aligns across all cards |
| 2026-05-27 | FIFO same-date BUY lot fix | dateQtyAttributed Map distributes qtyRealized sequentially across same-date BUY lots in FIFO order; fixes Axis Bank double-realized bug |
| 2026-05-27 | UI-only fix rule in CLAUDE.md + memory | Trigger: "UI fix" / "UI only" / "quick UI fix" â†’ edit reported file directly, max 2 tool calls, no analysis |
| 2026-05-27 | XIRR fix â€” closed positions in segment view | closedRows now tracks all portfolios per symbol; xirrMap + filteredSummaryXirr use row.portfolios for closed rows instead of filtPorts (open-only) |
| 2026-05-27 | XIRR fix â€” "All" filter mode | filteredSummaryXirr computes client-side for all 3 modes; was returning data.xirr_stk for "All" which mixed Indian + US stocks |
| 2026-05-27 | TxRow redesign â€” 2-row Ã— 3-col layout | Badge pill outside grid; R1: date/unreal/curValue; R2: invested/real/totalGain; green/red card tint; date format 6 Dec'25 |
| 2026-05-27 | HoldingsPage default filter = All, showClosed = false | Landing state shows all positions in summary but hides closed rows in the list by default |
| 2026-05-27 | Charts pre-fetch on page load (no tab gate) | enabled=!!data instead of activeTab==='charts'&&!!data; data ready before user taps Charts tab |
| 2026-05-27 | No loading bar for charts | Removed histLoading progress block from HoldingsPage and TransactionsPage; chart appears silently when ready |
| 2026-05-27 | History cache preserved on force refresh | Removed qc.removeQueries(['history']) from useForceRefresh; chart data survives pull-to-refresh |
| 2026-05-27 | â†» sync icon added to HoldingsPage Charts tab | Mirrors TransactionsPage behaviour; invalidates all ['history'] queries in background; old chart stays visible |
| 2026-05-27 | TransactionsPage â†» changed to invalidateQueries | Was removeQueries (blanked chart); now keeps old data visible while silently re-fetching |
| 2026-05-27 | PriceChart X-axis range-aware tickFormatter | Long ranges (2y/3y/5y/All): "Oct '23"; short ranges (1m/3m/6m/1y): "12 Oct"; 1d: "HH:MM" |
| 2026-05-27 | PriceChart 1d intraday range | Fetches 5-min bars via /api/history?period=1d; X-axis shows time; cached 5 min on backend; BUY/SELL markers not shown for intraday |
| 2026-05-27 | Portfolio bundle persisted to localStorage | shouldDehydrateQuery now includes 'portfolio' alongside 'history'; instant reopen after swipe-up â€” shows stale data immediately, background-refetches silently |
| 2026-05-27 | All charts default range = 1y | PriceChart was 'All'; now '1y' matching HoldingsPage + TransactionsPage |
| 2026-05-27 | Stocks/MF tiles side-by-side | Changed from full-width stacked (space-y-2) to grid grid-cols-2 gap-2; fonts reduced: value 15pxâ†’13px, labels 9pxâ†’8px, gains 10pxâ†’9px |
| 2026-05-27 | BreakCard compact prop | compact=true uses 13px value / 8px labels / 9px gains / gap-0.5 â€” used in all 2-col grid layouts |
| 2026-05-27 | By Type breakdown grouped sections | TYPE_GROUPS constant; Stocks section (Indian+US) + Mutual Funds section (Indian+US MF); each section has subtle left-line pill + section label + 2-col compact grid |
| 2026-05-27 | By Broker breakdown grouped sections | BROKER_GROUPS constant; Indian Stocks / US Stocks / Mutual Funds sections; same left-line + label + 2-col compact grid layout |
| 2026-05-27 | Breakdown label sizing | "Breakdown" title: 9px font-bold text-slate-500; section labels (Stocks, Indian Stocks, etc.): 7px text-slate-400 non-bold |
| 2026-05-27 | XIRR By Type includes closed positions | cardXirrMap now iterates all data.transactions + classifies by getSegmentType via yfMap lookup; was filtering by holdingKeys (open-only) |
| 2026-05-27 | PriceChart 5d range added | RANGES now includes '5d'; RANGE_DAYS['5d']=7; X-axis shows weekday name "Mon"/"Tue" |
| 2026-05-27 | All chart X-axis tickFormatter per range | HoldingsPage + TransactionsPage: t field changed from pre-formatted locale string to ISO date; tickFormatter: 1m/3m/6m="12 Oct", 1y="Jan", 2y+="Oct '23" |
| 2026-05-27 | 1d intraday timestamps converted to IST | Backend tz_convert('Asia/Kolkata') before strftime; was showing UTC (3:50â€“9:55 instead of 9:15â€“3:30) |
| 2026-05-27 | 1d chart % uses prev_close from intraday response | Backend _fetch_intraday now returns prev_close (yesterday's daily close); PriceChart uses (last_bar - prev_close)/prev_close instead of first-bar delta â€” correctly captures gap-up/gap-down |
| 2026-05-27 | Analysis tab on HoldingsPage â€” Allocation + Benchmarking | Allocation: stacked bar + sector rows (color, count, %, value). Benchmarking: per-sector XIRR vs benchmark (transaction-matched composite); per-holding benchmark XIRR on own tx dates so index ETFs show ~0% alpha; collapsible sector rows expand to show Stock \| XIRR \| Index \| Alpha |
| 2026-05-27 | Sector taxonomy (sectors.ts) â€” 9 buckets | Banking, Finance, Healthcare, IT, Growth, Tech (all US), Smallcap (MFs), Equity (ELSS+Parag Parikh), Other; SECTOR_COLOR + SYMBOL_SECTOR + SECTOR_BENCHMARK maps |
| 2026-05-27 | useBenchmarkXirr â€” per-holding benchmark XIRR | holdingBench Map tracks simulated benchmark cashflows per yf_symbol; holdingBenchXirr map in output allows expanded rows to show per-holding alpha vs own-date-simulated benchmark |
| 2026-05-27 | Allocation sub-tab redesign (session 10) | allocGroupedRows + allocXirrMap always use cumulative (one row per symbol) regardless of viewMode; sector row shows Allocation%/Value/XIRR/Today columns; holding cards are bg-slate-50 rounded with space-y-1.5; columns left-aligned with consistent fixed widths (w-[52px]/w-[48px]/w-[40px]/w-[80px]); ticker removed from holding rows; sector name shows "(X holdings)"; "By Sector" label above; # column removed |
| 2026-05-27 | Today gain inline format in Allocation | Shows "+â‚¹1.2K (+0.5%)" on one line (was two stacked lines); applies to both sector row and holding card rows |
| 2026-05-27 | Market Cap section in Allocation sub-tab | Second collapsible section below By Sector; buckets: Large Cap / Mid Cap / Small Cap / US Stocks (ETF/MF bucket removed); sectors.ts extended with MarketCapKey, MARKET_CAP_COLOR, SYMBOL_MARKET_CAP (all 63 symbols), getMarketCapForHolding(); same column layout as sector section |
| 2026-05-27 | Allocation sub-tab â€” collapsible By Sector / By Market Cap sections | Each section wrapped in `border border-slate-200 rounded-xl`; section headers are tappable buttons with â–²/â–¼ chevron; state: sectorSectionOpen + mktCapSectionOpen (both default true); collapses header row + all cards together |
| 2026-05-27 | Market cap bucket reclassification | ETF/MF bucket removed; MarketCapKey now 4 values: Large Cap / Mid Cap / Small Cap / US Stocks; small cap funds + SBI Contra â†’ Small Cap; ITBEES + ELSS funds + digital India funds + Parag Parikh â†’ Large Cap; MON100 + MAFANG + S&P 500 fund + NASDAQ 100 fund â†’ US Stocks; PIIND â†’ Mid Cap; WEALTH â†’ Small Cap; FORTIS + HEALTHY â†’ Large Cap |
| 2026-05-27 | Benchmarking sub-tab â€” allocation-style redesign | Overall card: bg-green-50/border-green-100, green label, Your XIRR colored green/red; sector list wrapped in bordered collapsible "By Sector" section (border-slate-200 rounded-xl) matching Allocation tab; benchSectorSectionOpen state added |
| 2026-05-27 | Benchmarking column order | Columns: Sector Name \| XIRR \| Index (XIRR) \| Alpha; "Index (XIRR)" is a merged column showing "BENCHMARK_LABEL (benchXirr%)" in one cell (w-[86px] overflow-hidden); Alpha colored green/red |
| 2026-05-27 | Benchmarking â€” centered alpha bar | Zero-centered bar (h-1.5 sector rows, h-1 holding rows); green extends right for positive alpha, red extends left for negative; width = |alpha| / maxAlpha Ã— 50%; center divider line at 50%; holding rows restructured to div wrapper to accommodate bar below flex row |
| 2026-05-27 | Benchmarking holding rows â€” per-holding alpha | Alpha computed as hXirr âˆ’ hBenchX per holding row; shows same benchmark label as parent sector in merged Index (XIRR) cell |
| 2026-05-28 | Allocation accordion sections | By Sector open by default, By Market Cap collapsed; opening one collapses the other (accordion pattern) |
| 2026-05-28 | Solid tab colors on HoldingsPage | Holdings=bg-blue-500, Charts=bg-emerald-500, Analysis=bg-violet-500 (was light bg-*-50); chart metric pills=emerald-500; Allocation=amber-500, Benchmarking=sky-500 |
| 2026-05-28 | Allocation/Benchmarking as metric-pill style buttons | Same scrollable pill pattern as chart metric buttons (border, bg-white inactive / colored active) |
| 2026-05-28 | Sector/MktCap XIRR â€” pooled cashflows fix | allocSectorXirrMap + allocMktCapXirrMap useMemos compute XIRR from combined cashflows; was weighted average of per-holding XIRRs (mathematically incorrect, gave inflated ~94%) |
| 2026-05-28 | Content border on HoldingsPage tabs | Active tab content wrapped in border border-slate-200 rounded-xl p-3; tab row sits above outside the border |
| 2026-05-28 | Tab content border removed | Outer border removed for all tabs (Holdings, Charts, Analysis) |
| 2026-05-28 | Colored tinted strips below tab row | Charts tab: sky-50/sky-100 strip with metric pills + â†»; Analysis tab: violet-50/violet-100 strip with Allocation/Benchmarking pills; Holdings tab: no strip |
| 2026-05-28 | Chart metric pills â€” unique colors per metric | METRIC_COLOR map: Portfolio Value=blue-500, Invested=violet-500, Unrealized Gains=teal-500, Realized Gains=amber-500, Total Gains=emerald-500, Return %=sky-500, XIRR Trend=rose-500 |
| 2026-05-28 | Benchmarking overall card â€” inline label+value | Label and value on same line (flex row); three items (Your XIRR, Benchmark, Alpha) use flex-1 + 8px spacer to align with sector columns below |
| 2026-05-28 | Benchmarking columns redesign | Sector+XIRR merged into one flex-1 cell "Banking (+18.5%)"; "Index (XIRR)" renamed "Benchmark (XIRR)"; all 3 columns equal flex-1; gap reduced to gap-1 |
| 2026-05-28 | Benchmarking section headers colored | "By Sector" in Benchmarking = text-sky-600; "By Sector"=text-blue-600, "By Market Cap"=text-orange-600, "By Holdings Concentration"=text-emerald-600 in Allocation |
| 2026-05-28 | By Holdings Concentration section in Allocation | New accordion section; Top 5/10/20 iOS toggle (default 10); PieChart (Recharts) with PIE_COLORS array; right-side coverage stat "Top X stocks covers Y%"; legend with color dot + nameÂ·ticker + value + XIRR in parentheses + alloc%; accordion-linked with By Sector and By Market Cap |
| 2026-05-28 | /get_ready slash command | .claude/commands/get_ready.md â€” reads 6 boot files in parallel, outputs compact session status (last completed + pending backlog) |
| 2026-05-28 | Critical Rules section in CLAUDE.md | 5 rules: do only what's asked, keep files in context, ask if stuck 30s, use context not files, cache all reads |
| 2026-05-28 | Returns sub-tab on Analysis tab (HoldingsPage) | 3rd Analysis pill (green-500); Sector pills (All + each sector, colored by SECTOR_COLOR); Period toggle (Year / Month iOS slider); Metric toggle (Return % / Gains / XIRR iOS slider); Year selector row (month mode only, auto-resets on sector change); rows = label + colored value + proportional bar; YTD/MTD in slate-400; XIRR = cumulative annualized from first tx to end of that period |
| 2026-05-28 | usePortfolioHistory exposes symbolPriceMap | New return field: Map<yf_symbol, Map<dateStr, price>>; hoisted from series useMemo; enables consumers (Returns tab) to compute per-sector daily value series without extra network calls (cache hits only) |
| 2026-05-28 | Returns sub-tab controls â†’ gear icon popover | Sector pills + iOS sliders replaced by single gear icon (âš™) on summary line extreme right; popover contains Sector list (with color dots), Period slider (Year/Month), Year pills (month mode only), Metric slider |
| 2026-05-28 | Returns sub-tab histogram | Horizontal bar cards replaced by Recharts BarChart; green bars positive, red bars negative, semi-transparent for YTD/MTD; summary line shows total P&L (currentâˆ’invested+realized) for selected sector above chart |
| 2026-05-28 | Analysis strip â†’ pill buttons matching Charts tab | Segmented slider replaced with colored pill buttons: Allocation=amber-500, Benchmarking=sky-500, Returns=green-500; matches Charts tab metric pill pattern |
| 2026-05-28 | Clarifying-questions rule added to CLAUDE.md | Rule 6 in Critical Rules: ask clarifying questions before complex/data-logic tasks; two failed attempts = mandatory pause; added to Working Style too |
| 2026-05-28 | Returns histogram fixed for "all sectors" â€” use portSeries.total | Root cause: sectorValueSeries.get('all') only tracked open holdings; closed positions dropped to 0 on sell. Fix: for returnsSector==='all', periodData reads portSeries.total (unrealized + cumulative realized P&L). Gains = total[end]âˆ’total[start], no netInvested subtraction needed. Sum of all year bars â‰ˆ current total P&L â‰ˆ 68L. Sector-specific views unchanged (sectorValueSeries â€” known limitation). |
| 2026-05-29 | classifyClean helper in PortfoliosPage | Replaced portfolio-level realizedForPorts in typeCards/stk tile/mf tile with per-entry classifyClean(portfolio, cleanSymbol). Fixes double-counting of Zerodha realized gains when Zerodha holds MON100/MAFANG (us_stock) alongside Indian stocks. P3/P4/P5/P8 invariants now hold. |
| 2026-05-29 | Total segment realized = 0 bug fixed | segFilter for segment='total' was New Set(['total']) â€” getSegmentType never returns 'total'. Fixed to ['indian_stock','us_stock','indian_mf','us_mf']. X1 cross-page invariant now holds. |
| 2026-05-29 | Number Correctness Rules added to CLAUDE.md | 21 rules (P1â€“P8, H1â€“H6, T1â€“T3, X1â€“X7, D1â€“D5) documented as reference; all verified and passing after this session's fixes. |
| 2026-05-29 | Upstox broker card fix (portfolioCards) | portfolioCards() seeds agg with non-SKIP portfolios found only in rmap (fully closed, no open holdings); fixes 0.47L gap between Stocks tile and By Broker stock cards sum |
| 2026-05-29 | HoldingsPage filtRealized segment fix | For segment views, filtRealized now iterates data.realized directly with SKIP_PORTS+segment filter instead of pre-filtering by filtPorts (open portfolios only); Realized Gains chart endpoint now matches Summary card for all segments including Upstox |
| 2026-05-29 | Return % chart formula corrected (A6) | usePortfolioHistory tracks cumRealCost alongside cumReal; returnPct = totalGain/(invested+realCostVals)Ã—100; was (curâˆ’inv)/inv which ignored realized cost basis â€” gap was up to âˆ’53pp for MF segment |
| 2026-05-29 | testcases.md created | 10 manual test cases: Portfolios page (P-BROKER-1, P-TYPE-1, P-STOCKS-MF) + Holdings Charts tab (H-CHART-A1 through A6, B1, C1, D1) + cross-page invariants (X1â€“X7); includes expected values, status, known limitations |
| 2026-05-29 | testcases.md exhaustive rewrite | 60+ cases covering Overview (hero, tiles, type, broker, refresh), Holdings tab (summary, filters, grouping, sort, cards), Charts tab, Analysis tab (Allocation x9, Benchmarking x7, Returns x12 including SUMLINE-1 through 5), Transactions page, cross-page invariants, known limitations |
| 2026-05-29 | Returns summary line text format | Year mode: "all sectors Â· by year" or "Banking Â· by year"; Month mode: "all sectors Â· 2026" or "Banking Â· 2026" â€” shows vintage of selected period, not a static phrase |
| 2026-05-29 | Returns summary line number = period-specific gains | Year mode: sum of all year bars (total portfolio gains); Month mode: sum of selected year's monthly bars (that year's gains). Was incorrectly showing all-time `allocGroupedRows` total (excluded fully-closed positions). Fixed via `summaryGains = periodData.reduce(s + r.gains, 0)` and `summaryLabel` from mode+year state. |
| 2026-05-29 | Returns default metric changed to Gains | `returnsMetric` initial state changed from 'returnPct' to 'gains'; Gains (INR) is more immediately useful than Return % as a landing view |
| 2026-05-29 | Holdings tab list width matches SummaryCard | Removed `p-3` wrapper div from Holdings tab content; holding cards now flush with page px-4 padding, same width as the summary card above |
| 2026-05-29 | Allocation sector rows â€” count, merged column, visual tray | `(X holdings)` â†’ `(#X)` saves space for full sector name on mobile; Value + XIRR columns merged into single `w-[90px]` "Value (XIRR)" cell; expanded holdings area uses `bg-slate-50 rounded-b-lg` tray with `bg-white border border-slate-100` holding rows for clear visual separation from next sector; sector card border upgraded to `border-slate-200`, spacing `mb-1`â†’`mb-2` |
| 2026-05-29 | Closed holdings â€” TxRow BUY cards | Removed `if (!holding) return null` guard in `txGains`; uses `currentPrice = holding?.current_price ?? 0`; fully-sold BUY lots now return `status:'sold'` with realized gain instead of null | 
| 2026-05-29 | Closed holdings â€” TxRow sold status r1right | `status:'sold'` branch now sets `r1right = â‚¹0 (â‚¹0)` matching `status:'realized'` SELL card behaviour |
| 2026-05-29 | Closed holdings â€” TransactionsPage summary card | `holdingXirr` guard removed `\|\| !holdingList.length` â†’ XIRR computed from BUY+SELL cashflows for closed positions; `anyHolding` fallback finds open holding of same symbol across portfolios for LTP/name/yf_symbol; `lastSellPrice` fallback if completely closed; current value always renders `fmt(cur)` = â‚¹0; invested shows â‚¹0 |
| 2026-05-29 | Closed holdings â€” HoldingCard LTP on HoldingsPage | `closedRows` builds `priceMap` (any open portfolio for same symbol) + `lastSellMap` (latest SELL tx per symbol); `ltp` uses `priceMap.get(sym) ?? lastSellMap.get(sym)?.price ?? null` |
| 2026-05-29 | Returns sub-tab â€” XIRR metric removed | Metric toggle reduced to 2 options: Return % / Gains; slider indicator width 50%; state type narrowed to `'returnPct' \| 'gains'` |
| 2026-05-29 | Returns sub-tab â€” ComposedChart with indigo cumulative line | Changed BarChart â†’ ComposedChart; bars = period-specific value (left Y-axis); indigo Line = cumulative return % (right Y-axis, always %, `portSeries.returnPct` series); YTD/MTD bar cumul overridden with live `displayStats` value to match summary tile exactly; dual Y-axis with indigo ticks on right |
| 2026-05-29 | Returns sub-tab â€” summary line switches by metric | Gains mode: `+â‚¹68.2L Â· all sectors Â· by year`; Return % mode: `+37.83% Â· total return Â· now` (live from displayStats, not from series) |
| 2026-05-29 | Returns sub-tab â€” Return % bar = period gain % | `returnPct = period_gains / startPortfolioValue * 100` where startPortV = `portSeries.value[prevEnd]` (open market value) or `portSeries.invested[prevEnd]` fallback; denominator is portfolio market value at start of period, not cumulative invested |
| 2026-05-29 | Chart last point pinned to live prices | `usePortfolioHistory` appends/overrides the last data point using `h.disp_current` + `h.disp_invested` (live prices from bundle) so chart endpoint = summary card exactly. Interior historical points still use EOD closes. Fix eliminates 1â€“2L gap between Unrealized/Total Gains chart stat and summary card. |
| 2026-05-29 | Benchmarking pill: FX asymmetry for Indian USD-tracking ETFs | MON100/MAFANG (INR ETFs tracking USD index) show alpha = INR depreciation component (~21% for MON100). Correct behaviour â€” benchmark simulation is pure USD-return comparison; actual XIRR includes FX tailwind. ITBEES (INRâ†’INR) correctly shows ~0% alpha confirming simulation mechanics. Documented in testcases.md AN-BENCH-3. |
| 2026-05-29 | Benchmarking "Others" sector hidden when no open holdings | `benchSectors.filter(s => s.holdingCount > 0)` added before render â€” sectors with only closed positions (no open holdings) no longer appear in the By Sector list; consistent with Allocation tab which also only shows open positions |
| 2026-05-29 | NIFTYBEES.NS sector reclassified Other (was Equity) | Removes confusing "Equity" sector label from Stocks portfolio benchmarking breakdown; benchmark unchanged (both Equity and Other use ^NSEI) |
| 2026-05-29 | Benchmarking period XIRR â€” Option B (opening balance at T1) | Replace BUY-filter date logic with proper period XIRR: portfolio value at T1 injected as opening cashflow (actual = `symbolPriceMap` price Ã— qty Ã— fx; bench = `histMap` price Ã— simulated units); cashflows [T1, T2] collected as before; terminal at T2 (live prices if T2=today, else `symbolPriceMap` at T2). Both overall card and sector rows update. `usePortfolioHistory` gains `extraSymbols?` param so closed-symbol historical prices populate `symbolPriceMap`. Hook call moved before `useBenchmarkXirr` in HoldingsPage. `benchTxnsDate` memo replaced with `benchPeriodStart`/`benchPeriodEnd`. |
| 2026-05-29 | INTC, SOUN, FIG added to Tech sector in sectors.ts | Three closed US positions (Intel, SoundHound, Forge Global) were defaulting to Other; now correctly routed to Tech (^NDX benchmark) |
| 2026-05-29 | 40+ historically traded Indian symbols classified in SYMBOL_SECTOR | Root cause of benchmarking alpha discrepancy: ~68 closed positions (Groww/AngelOne/Zerodha history) all defaulted to Other (^NSEI benchmark). Fixed by classifying Banking (HDFCBANK, KOTAKBANK, BANKBEES, BANKBARODA, CANBK, PNB, EQUITASBNK, AUBANK, CSBBANK, CUB, UJJIVANSFB, ESAFSFB, BANDHANBNK, INDUSINDBK), Finance (BAJAJFINSV, MANAPPURAM, M&MFIN, ABSLAMC, 5PAISA, SAMMAANCAP, LICI, POLICYBZR, PAYTM), Healthcare (DIVISLAB, GLAND, ZYDUSLIFE, ZYDUSWELL, AMRUTANJAN), IT (INFY, TCS, KPITTECH, TATAELXSI, HAPPSTMNDS), Equity (NIFTYBEES). Consumer/FMCG stocks left as Other. SYMBOL_MARKET_CAP updated in parallel with correct Large/Mid/Small Cap buckets. |
| 2026-05-29 | debug_benchmark.py â€” Python benchmark debug script | Replicates useBenchmarkXirr.ts logic; prints per-holding XIRR, closed positions with sector, open-only vs open+closed sector/overall XIRRs side-by-side; useful for future alpha discrepancy debugging |
| 2026-05-29 | Benchmarking holding rows â€” name truncation + always-visible XIRR | Name span: `text-slate-600 truncate min-w-0`; XIRR span: `shrink-0` colored; both wrapped in `flex items-center gap-1 flex-1 min-w-0` â€” long fund names no longer push XIRR off-screen |
| 2026-05-29 | benchTxns Upstox fix â€” fully-closed portfolios included | `benchTxns` extends `filtPorts` with all portfolios from `closedRows`; previously `filtPorts` only covered portfolios with open holdings, so Upstox (fully-closed) was excluded from all benchmarking cashflows |
| 2026-05-29 | Benchmarking date range filter | Collapsible config row at top of Benchmarking pill: shows "ðŸ“… All dates" or "ðŸ“… Jan 2023 â†’ today" + Active badge; expanded panel has From/To month+year selects, "Use today as end date" iOS toggle, Apply/Clear buttons; `benchTxnsDate` memo filters only BUY transactions to the date window (all SELLs always kept so exits are captured); `txnYears` memo derives available years from data.transactions |
| 2026-05-29 | Consumer sector added to sectors.ts | New SectorKey 'Consumer' (pink-500 #ec4899); benchmark ^CNXFMCG (Nifty FMCG); 15 symbols: HINDUNILVR, ASIANPAINT, DMART, PAGEIND, EMAMILTD, HAVELLS, WHIRLPOOL, BERGEPAINT, MANYAVAR, SYMPHONY, TTKPRESTIG, VGUARD, MARICO, ITC, VOLTAS; these were all closed positions previously defaulting to Other (^NSEI) which gave artificially bad alpha |
| 2026-05-29 | Smallcap benchmark changed ^NSMCAP250 â†’ NIFTY_MIDCAP_100.NS | ^NSMCAP250 and ^CNXMID both return 404 from yfinance; NIFTY_MIDCAP_100.NS confirmed working; used as proxy for DELTACORP, TARSONS, GREENPANEL, ORIENTELEC, PVRINOX (5 closed small-cap positions moved from Other to Smallcap) |
| 2026-05-29 | TECHM.NS added to IT sector | Was defaulting to Other (^NSEI); correctly classified as IT (^CNXIT) |
| 2026-05-29 | debug_benchmark.py â€” full diagnostic overhaul | Added Upstox to INDIAN_STOCK_PORTS; synced SYMBOL_SECTOR with sectors.ts exactly; added print_unclassified_summary() to show all symbols not in SYMBOL_SECTOR with invested amounts; added Consumer + Smallcap sectors; key finding: overall Indian stocks alpha (open+closed) = +5.0% with final classification |
| 2026-05-29 | debug_benchmark.py excludes US_ETF_SYMS from Indian stocks | Root cause of debug vs UI gap (17.43% vs 13.2% actual XIRR): debug was including MON100/MAFANG (Zerodha US ETFs, classified us_stock by UI) in Indian stocks pool. Fix: add ~txns['yf_symbol'].isin({'MON100.NS','MAFANG.NS'}) filter. UI 3.1% alpha is the correct Indian-stocks-only figure. |
| 2026-05-29 | Stock sector reclassifications in sectors.ts + debug_benchmark.py | LAXMIMACH/INDIAMART/DREAMFOLKS/IRCTC/EASEMYTRIP â†’ Growth (^CRSLDX); TATAINVEST/IBREALEST â†’ Finance (Nifty Fin Svc); NYKAA â†’ Consumer (^CNXFMCG). All were previously unclassified â†’ defaulted to Other/^NSEI benchmark. |
| 2026-05-29 | Benchmarking sector cards match Allocation style | `border border-slate-100 rounded-lg mb-1` â†’ `border border-slate-200 rounded-lg mb-2`; consistent visual language across both sub-tabs |
| 2026-05-29 | Benchmarking sectors sorted by allocation % | `[...benchSectors.filter(s => s.holdingCount > 0)].sort((a, b) => b.currentValue - a.currentValue)` â€” sectors and holdings within each sector sorted by current value desc |
| 2026-05-29 | Benchmarking Sector(XIRR) column wider | All three levels (header, sector row, holding row) changed from `flex-1` â†’ `flex-[2]` for Sector(XIRR) column; Benchmark(XIRR) and Alpha remain `flex-1` â€” sector name has more room, Benchmark label shifts right |
| 2026-05-29 | Returns sub-tab: Return % toggle removed | `returnsMetric` state hardcoded to `'gains'`; Metric toggle section removed from gear popover; `fmtV`/`yTickFmtR`/`metricLabel` simplified to gains-only; summary line always shows `+â‚¹X Â· sector Â· period` |
| 2026-05-29 | Returns chart full width + cumulative return % line | Right Y-axis hidden (`width=0`, `tick={false}`) so it scales the indigo cumulative line without consuming space; chart margin.right=4; chart fills full container width |
| 2026-05-29 | Returns gear icon inline with summary text | Summary line div uses `gap-2`; value span has `whitespace-nowrap`; label span has `flex-1 min-w-0 truncate` â€” gear icon stays on same row regardless of text length |
| 2026-05-30 | Global sector added to sectors.ts | New SectorKey `'Global'` (indigo `#6366f1`); benchmark `^GSPC` (S&P 500); `'S&P 500'` added to BENCHMARK_LABEL; 4 US-themed MFs classified: Motilal S&P 500 (moved from Tech), ICICI Pru US Bluechip, Franklin US Feeder, Nippon US Opp |
| 2026-05-30 | 56 new MF symbols classified in sectors.ts | All 70 MF symbols now explicitly classified (0 unclassified); adds Equity (large cap/bluechip/flexicap/ELSS/focused/contra), Smallcap (mid cap + small cap MFs), IT (technology sector MFs), Finance (banking & finance MFs), Healthcare (pharma MF), Global (S&P 500 MFs), Other (debt/liquid/international MFs) |
| 2026-05-30 | SBI Contra reclassified Smallcap â†’ Equity | SBI Contra (`0P0000XVJR.BO`) is a multi-cap contra fund; was incorrectly in Smallcap (Nifty Mid 100 benchmark); moved to Equity (^NSEI) which matches its actual mandate |
| 2026-05-30 | Other sector excluded from Benchmarking pill | `Other` sector hidden from By Sector list (same `holdingCount > 0` filter); also excluded from `overallActual`/`overallBench` cashflow accumulation in `useBenchmarkXirr.ts` (6 spots); fixes -11.62% alpha drag from Axis Liquid (â‚¹15.2L) benchmarked vs Nifty 50 in MF open+closed view |
| 2026-05-30 | Portfolio Manager header on OverviewPage | Emerald-to-teal gradient (`from-emerald-600 to-teal-500`), white title `text-[18px] font-bold`; sync â†» + IST timestamp right-aligned on same row in `text-emerald-100` (idle) / white (spinning); replaces old bottom-of-page timestamp bar |
| 2026-05-30 | Charts tab: show cached charts on hard refresh | `usePortfolioHistory` removed `isLoading` gate from `symbolPriceMap` and `series`; both computed from whatever queries have data; `isLoading` now includes `isFetching` so sync icon tracks full refetch cycle |
| 2026-05-30 | Charts tab sync icon spins until refetch done | `useEffect` clears `syncing` when `!histLoading`; removed hardcoded 1.2s `setTimeout`; icon keeps spinning through full invalidate+refetch cycle |
| 2026-05-30 | Charts tab: progress bar on first load | Shows `"Loading X / Y symbols Z%"` + sky-400 fill bar when `histLoading && loadedCount < totalCount`; hidden on hard refresh (all cache restored instantly) and during sync refetch |
| 2026-05-30 | Overview refresh banner: 1.5s auto-dismiss | Split `refreshing` into `bannerVisible` (cleared after 1500ms setTimeout) + `refreshing` (cleared when fetch resolves); banner disappears quickly, bottom â†» icon stays spinning until prices return; banner timer cleaned up on unmount |
| 2026-05-30 | Benchmarking â†» sync icon on Analysis strip | Added to same row as Allocation/Benchmarking/Returns pills (`shrink-0` flush right); only visible when Benchmarking sub-tab active; `benchSyncing` state; invalidates both `['history']` and `['benchmark-hist']` queryKeys; spins until `benchLoading` goes false via `useEffect` |
| 2026-05-30 | 1d local cache â€” portfolio bundle staleTime 30minâ†’1d | No auto background-refetch; manual â†» is the only refresh trigger for live prices; matches user expectation of daily-fresh data |
| 2026-05-30 | benchmark-hist queries persisted to localStorage | Added `benchmark-hist` to `shouldDehydrateQuery` in App.tsx; fixes "Loading benchmark dataâ€¦" blank screen on every app restart â€” Benchmarking tab now shows instantly on 2nd+ opens within 1 day |
| 2026-05-30 | localStorage maxAge 7d â†’ 1d | All persisted queries (portfolio + history + benchmark-hist) expire after 1 day; consistent with 1d staleTime |
| 2026-05-30 | Returns tab stale-while-revalidate | Changed `histLoading ?` to `!portSeries && histLoading ?` â€” shows chart from stale portSeries during sync refetch instead of blank "Loading price historyâ€¦" text |
| 2026-05-30 | useIsRestoring loader screen in App.tsx | `PersistQueryClientProvider` restores localStorage cache before pages render; without a gate, benchmark queries mounted during restoration see empty cache â†’ `isLoading=true` persists. Fix: `AppRoutes` inner component calls `useIsRestoring()`; renders `LoadingScreen` (slate-900 bg, emerald-to-teal gradient title, spinning â†») while restoring; pages only mount after cache is fully hydrated â€” benchmark data found immediately on hard refresh |
| 2026-05-30 | Benchmark sync icon â€” isFetching exposed | `useBenchmarkXirr` previously only returned `isLoading` (true on initial load only); on â†» invalidate, queries are `isFetching` but `isLoading=false` â†’ `benchSyncing` cleared instantly, icon never spun. Fix: added `isFetching` to BenchmarkOutput return; `HoldingsPage` destructures `benchFetching`; `useEffect` now waits for `!benchLoading && !benchFetching` before clearing `benchSyncing` |
| 2026-05-31 | Report tab added to TransactionsPage (between Charts and Notes) â€” Option B: Quick Stats card (yfinance ticker.info) + 6 Perplexity deep-link section cards + Full Report button; tab union `'transactions'\|'charts'\|'report'\|'notes'` |
| 2026-05-31 | Report tab Quick Stats card â€” P/E (trailing+fwd), MCap (INR crores / USD T/B), Beta, gradient 52W range bar with blue dot, analyst rec badge + target + upside %; all fields nullable; `partial` flag shows notice when yfinance data incomplete |
| 2026-05-31 | Report tab 6 Perplexity section cards â€” Business Overview, Latest Results & Concall, Growth Catalysts, Key Risks, Industry Outlook, Valuation vs Peers; Indian queries use FY2025/concall framing, US use Q1 2025/earnings; Full Report button fires one comprehensive query |
| 2026-05-31 | Report tab sync â€” â†» in tab bar; `invalidateQueries(['quickstats', yf])`; `reportSyncing` state; 1.5s timeout; quickstats persisted to localStorage via shouldDehydrateQuery |
| 2026-05-31 | quickstats backend â€” `GET /api/quickstats`; 60s in-memory burst + 24h per-symbol disk cache stored as `{SYMBOL:{data,ts}}` under permanent `"quickstats"` cache layer; `_TTL["quickstats"]=None` |
| 2026-05-31 | Sync error feedback on Overview â†» â€” `refreshError` state + `errorTimer` ref; shows "Sync failed Â· retry" in red-300 for 5s on fetch failure; auto-clears | Makes Render cold-start / network failures visible instead of silent spin-stop |
| 2026-05-31 | staleTime+gcTime=Infinity for all queries + localStorage 3 days â€” portfolio, history, benchmark-hist, quickstats, useHistory (incl. 1d intraday was 5min/10min); maxAge 1dâ†’3d | Zero auto-refresh across entire app; all data manual-â†» only; 3-day offline persistence |
| 2026-05-31 | Loading/Syncing X/Y progress bars on Charts + Benchmarking â€” HoldingsPage Charts tab: "Loading/Syncing price historyâ€¦ X / Y Â· Z%" + sky bar on first load AND sync â†»; TransactionsPage Charts tab: same (1 symbol); Benchmarking first load: blocking progress bar replaces "Loading benchmark dataâ€¦"; Benchmarking sync: non-blocking bar above content | Consistent progress UX across all loading states; "Loading" = cold, "Syncing" = warm refetch |
| 2026-05-31 | usePortfolioHistory exposes fetchingCount â€” `queries.filter(q => q.fetchStatus === 'fetching').length`; enables sync progress: completedCount = totalCount - fetchingCount |
| 2026-05-31 | useBenchmarkXirr exposes loadedCount/totalCount/fetchingCount â€” same pattern as usePortfolioHistory; enables Benchmarking progress bar |
| 2026-05-31 | Dark branded loader on cold start/empty cache â€” LoadingSkeleton replaced with full-screen slate-900 bg, emerald-to-teal gradient "Portfolio Manager" title, spinning â†»; matches App.tsx LoadingScreen style |
| 2026-05-31 | 75s timer progress bar on LoadingSkeleton â€” fills linearly via 500ms setInterval (150 ticks); at 75s bar completes and text flips to "Taking a bit more timeâ€¦"; no time number shown |
| 2026-05-31 | Closed holdings LTP from symbolPriceMap â€” closedRowsWithLtp memo (after usePortfolioHistory) patches ltp with latest date entry from symbolPriceMap; falls back to last sell price if history not loaded |
| 2026-05-31 | PriceChart history start fixed to 2000-01-01 â€” was firstTxDate(transactions) so chart was capped at first buy; now fetches full available history; range selector slices independently of transactions |
| 2026-05-31 | Benchmarking terminal value uses symbolPriceMap not stale bundle â€” `useBenchmarkXirr` period XIRR T2=today path now uses `qtyHeld Ã— symbolPriceMap at termStr` (same data source as benchmark histMap); fallback to `filteredHoldings.disp_current` when symbol missing from map. Eliminates mobile/localhost XIRR mismatch when portfolio bundle is stale but symbolPriceMap is freshly synced. |
| 2026-05-31 | Charts â†» moved from metric pills strip to tab row â€” sync icon now lives right of Holdings/Charts/Analysis pills (only visible when Charts tab active); `text-[10px]` IST timestamp shown to its left after first sync; sky-50 strip now contains metric pills only (no â†») |
| 2026-05-31 | Benchmarking sync timestamp â€” `text-[10px]` IST timestamp added left of â†» in violet-50 strip; only visible when Benchmarking sub-tab active; `benchLastSynced` state set via useRef transition tracking (benchLoading||benchFetching falseâ†’trueâ†’false) |
| 2026-05-31 | Benchmarking loader â€” indeterminate pulse when benchLoadedCount=0 (benchmark indices return near-simultaneously so progress bar stays at 0% then jumps); full-width `animate-pulse` bar used until any query resolves; switches to real % progress once count > 0 |
| 2026-05-31 | Sync timestamps show on initial cache load â€” removed useRef guard; `histLastSynced` set when `!histLoading && loadedCount > 0`; `benchLastSynced` set when `!benchLoading && !benchFetching && benchSectors.length > 0`; fires on first render if data in localStorage cache |
| 2026-05-31 | Sync timestamp format unified â€” `HH:MM DD Mon` (24h, no PM, no IST) e.g. "14:32 31 May" across all 3 sync icons (Charts, Benchmarking, Overview); Overview dropped "IST" suffix; uses `getHours/getMinutes/getDate` + `toLocaleString month:short` |
| 2026-05-31 | Sync pills â€” Charts: `bg-emerald-50 border-emerald-200` pill, `text-emerald-500` â†» + `text-emerald-600` timestamp; Benchmarking: `bg-sky-50 border-sky-200` pill, `text-sky-500` â†» + `text-sky-600` timestamp; both use `rounded-full px-2 py-0.5`; â†» always first, timestamp to right |
| 2026-05-31 | Benchmarking sync pill moved out of violet-50 strip â€” now in tab row (same position as Charts pill); violet-50 strip is pills-only; pill only visible when `activeTab === 'analysis' && analysisSubTab === 'benchmarking'` |
| 2026-05-31 | Charts sync pill moved inside sky-50 metrics strip â€” right-aligned `bg-sky-100 border-sky-200 text-sky-500`, `text-[9px]`, single `<button>` with `flex items-center` so â†» and datetime are mid-inline; removed from tab row |
| 2026-05-31 | Benchmarking sync pill moved to date filter row (inside Benchmarking content) â€” teal `bg-teal-100 border-teal-200 text-teal-500`; `ml-auto` pushes it to extreme right; single `<button>` mid-aligned; date filter column capped at `w-1/3`; chevron `â–¼/â–²` moved to leftmost position before ðŸ“… icon; accordion gap `mt-1.5â†’mt-0.5` |
| 2026-05-31 | Hero card (PortfoliosPage) â€” dark gradient `linear-gradient(135deg, #064e3b, #0f766e)`; white value text; emerald-300 labels; gain/loss in emerald-300/red-300; XIRR as frosted glass chip (`rgba(52,211,153,0.2)` bg); rounded-[14px] |
| 2026-05-31 | Stocks tile â€” fixed emerald type-identity bg (`linear-gradient(135deg,#ecfdf5,#f0fdf4)`) + emerald left border regardless of gain/loss; MF tile â€” fixed indigo bg (`linear-gradient(135deg,#eef2ff,#f5f3ff)`) + indigo left border |
| 2026-05-31 | Breakdown toggle (PortfoliosPage) â€” iOS-style sliding white pill on slate-100 track (replaces plain rounded-full border buttons) |
| 2026-05-31 | Section labels (Breakdown By Type/By Broker) â€” colored dot + bold colored text per section type; TYPE_GROUPS+BROKER_GROUPS extended with `color` field; TYPE_ACCENT map added for BreakCard accent colors per type (indian_stock=emerald, us_stock=sky, indian_mf=amber, us_mf=violet) |
| 2026-05-31 | BreakCard â€” `accentColor` prop added; type view passes TYPE_ACCENT color; broker view keeps gain/loss coloring; XIRR shown as green/red chip badge (`#d1fae5`/`#fee2e2` bg) |
| 2026-05-31 | HoldingCard XIRR chip â€” `text-[8px] font-semibold rounded-full px-1.5 py-0.5` chip; bg `#d1fae5`/`#fee2e2`; text `#065f46`/`#991b1b` |
| 2026-05-31 | SummaryCard â€” 3px gradient top strip (`#10b981â†’#0d9488` or `#f43f5eâ†’#e11d48`); card uses `overflow-hidden`; content wrapped in inner `px-3 py-2.5` div; XIRR as same chip as HoldingCard |
| 2026-05-31 | Overview page 3-color scheme â€” Total Portfolio card: light teal `#f0fdfaâ†’#ccfbf1`, dark slate text, teal left border; Stocks tiles (all By Type + By Broker): `STOCK_CARD_STYLE` green `#d1fae5â†’#ecfdf5â†’#f0fdf4`, accent `#34d399`; MF tiles (all By Type + By Broker): `MF_CARD_STYLE` navy-blue `#dbeafeâ†’#eff6ffâ†’#f8faff`, accent `#93c5fd`; `PORTFOLIO_CARD_STYLE` + `TYPE_CARD_STYLE` maps point to shared constants; BreakCard accepts `cardBg` prop |
| 2026-05-31 | Portfolio Manager banner â€” height reduced `py-3â†’py-1.5`; width full (no mx margin) |
| 2026-05-31 | Benchmarking XIRR truncation fix â€” Benchmark(XIRR) column split into two spans: label (`truncate`) + XIRR value (`shrink-0 whitespace-nowrap`); both sector row and holding row fixed |
| 2026-05-31 | HoldingsPage Package 1 "Light Banking" overhaul â€” iOS segmented tab bar on `bg-slate-100` track; active tab colored pill: Holdings=`bg-teal-100 text-teal-700`, Charts=`bg-sky-100 text-sky-700`, Analysis=`bg-violet-100 text-violet-700`; Holdings strip (`bg-teal-50 border-teal-100`) replaces floating count+sort row â€” contains count text left + funnel sort icon + label + direction right; Charts strip colour matches sky tab; SummaryCard: white bg + `shadow-sm` + `highlight` prop (gradient bg + accent); stocks=green highlight, total=teal, default=green; MF pages show same green (blue limited to overview); HoldingCard: `shadow-sm` + very light tint `#f7fef9`/`#fffbfb` based on gain/loss |
| 2026-05-31 | HoldingsPage Charts strip â€” `METRIC_STYLE` map with `active` (gradient pill), `inactive` (tinted pill), `line` (hex for chart stroke), `strip` (Tailwind bg+border per metric), `sync` (dark gradient Tailwind classes); strip bg + border + pill colors + chart line color + progress bar color all change per active metric; chart card wrapped in `bg-white rounded-xl shadow-sm border border-slate-100 p-3`; whitespace between strip and card reduced (`pt-1 pb-3`); sync button: dark gradient pill in strip, white â†» + timestamp |
| 2026-05-31 | TransactionsPage full makeover â€” iOS segmented tab bar (Txns=teal, Charts=sky, Report=violet, Notes=amber); per-tab strips (teal-50 txns count, violet-50 report+sync, amber-50 notes, metric-colored charts strip); `METRIC_HEX` map uses inline styles for strip bg/border, pill gradient active, tinted inactive, dark gradient sync button â€” avoids Tailwind JIT dynamic class issue; 'Price' metric gets indigo color; overview card gets `shadow-sm` + 3px gradient top strip; TxRow bg changed from strong fill `#f0fdf4`/`#fff1f2` to whisper tint `#f7fef9`/`#fffbfb` matching HoldingCard; charts sync button shows datetime after first sync |
| 2026-05-31 | HoldingsPage Analysis strip â€” `bg-violet-50 border-violet-100` always (matches violet Analysis tab); sub-tab pills use inline gradient styles: Allocation=amber-orange gradient active + `#fff7ed` inactive, Benchmarking=sky-cyan gradient + `#f0f9ff` inactive, Returns=emerald-green gradient + `#f0fdf4` inactive; benchmarking sync moved from date-filter row into strip itself (sky gradient pill, white â†» + timestamp, only visible when Benchmarking active) |
| 2026-05-31 | Analysis tab holding rows (Allocation + Benchmarking) made tappable â€” `<div>` â†’ `<button>` with onClick navigate to `/transactions/:port/:sym`; saves scroll position via sessionStorage; passes `portfolios` state same as HoldingCard |

| --- Sessions 64-87 (2026-06-01 to 2026-06-05) --- | --- | --- |
| 2026-06-05 | Peer Comparison Matrix extended timeouts — `_heavy = req.section_id in ("peers",)` flag in `/api/gemini`; peers section gets 70s+85s timeouts (1a:thinking / 1b:no-thinking) vs default 45s+55s; needed for niche stocks (Dr Lal PathLabs, etc.) where peer lookup requires more LLM compute time |
| 2026-06-05 | 3rd Gemini API key + 3-pill selector — `GEMINI_KEY_3` added to `_load_keys()` in `gemini.py`; `useKey` type expanded from `0\|1` to `0\|1\|2`; `localStorage('gemini:key_index')` stores '0'/'1'/'2'; gear popover replaced toggle with 3 circular `w-7 h-7 rounded-full` pills labelled 1/2/3 in both TransactionsPage and ResearchPage; `GEMINI_KEY_3` must be added to Render env vars for production |
| 2026-06-05 | Gemini icon on Deep Research cards — resized to 16×16px; fill changed from `text-violet-400 fill="currentColor"` to gradient `#4285f4 → #9334e9` (blue-to-purple) via SVG `<linearGradient id="gg-${section.id}">` — unique ID per card prevents SVG DOM conflicts when multiple cards render the same symbol |
| 2026-06-05 | Collapsible Sources in chat (`DeepResearchChat.tsx`) — `expandedSources: Record<string, boolean>` state; removed always-visible source chip links below grounded messages; added "Sources" button on model name row right side (globe SVG + "Sources" text + chevron ▾/▴); tapping toggles `expandedSources[msgId]`; source list expands below with `border-t border-slate-100` divider; `shrink-0 gap-3` on flex row prevents model name / Sources button overlap |
| 2026-06-05 | AI Assistant empty response fix (3.1 Lite) — two root causes: (1) retry loop used `break` on empty text, returning immediately instead of retrying; (2) `force_lite` prompt instructed model to "Actively use Google Search" but 3.1 Lite has no search tool → API returned tool-call-only response → `_extract_text` returned ""; fix: retry loop changed to for-loop (attempt 0 → sleep 2 → attempt 1); separate `force_lite` prompt for both `/api/gemini` and `/api/gemini/chat` removes all Google Search instruction |
| 2026-06-05 | Deep Research Chat UI redesign — removed global "Ask about [Name]" button (was below all cards, shown when ≥1 card generated); removed per-card 💬 Ask button (was below each expanded card's content); added Gemini sparkle icon (✦, 13px SVG) on LEFT of Refresh/Research/Show Results button on each card's title line — clicking opens chat modal scoped to that card's context; added "AI Assistant" violet-600 pill button (Gemini icon + label, 10px text) on top bar strip LEFT of model toggle in both TransactionsPage and ResearchPage — calls `chatOpenerRef.current?.open()`; removed context selector pill row from DeepResearchChat modal (the "All Cards / Business Overview / etc." line); `selectedContext` still set from `initialContextId` on open, user cannot change it mid-session; `chatOpenerRef` ref pattern: parent holds `MutableRefObject<{open:(contextId?)=>void}\|null>`, child `ReportTab` registers via `useEffect`, parent calls `chatOpenerRef.current?.open()`; modal `w-full max-w-xl` = full-width on 412px Pixel 10 (mobile-friendly, confirmed) |
| 2026-06-05 | Deep Research Chat — bottom sheet modal per stock — `DeepResearchChat.tsx`; fixed inset-0 flex items-end justify-center pointer-events-none wrapper; inner div max-w-xl w-full pointer-events-auto bg-white rounded-t-2xl; height 75dvh; drag handle bar at top; context selector: horizontal scrollable pills (All Cards + one per generated card emoji+label); thread: right-aligned violet bubble for user, left-aligned slate-50 bubble for assistant; react-markdown rendering in assistant bubbles; loading dots (3× animate-bounce, staggered delay); source links below grounded answers (up to 5 domain names, tappable); 🌐 Live badge + model name below assistant message; localStorage persistence per yf_symbol key `gemini:chat:{yf_symbol}` (7-day TTL); per-card 💬 Ask button at bottom of each expanded card; global 💬 Ask about [Name] button below all cards (visible when ≥1 card generated); both open same modal with context pre-selected; context selector resets to trigger source on reopen |
| 2026-06-05 | Deep Research Chat grounding — `/api/gemini/chat` uses same grounding cascade as `/api/gemini` (2.5 Flash + Google Search grounding 1a:thinking 45s / 1b:no-thinking 55s → 3.1 Lite fallback); prompt explicitly instructs model to NOT limit answer to context and to search web for historical/trend data not in context; sources returned and displayed as tappable domain links |
| 2026-06-05 | Sync across navigation — `useForceRefresh` now uses `qc.fetchQuery` (routes through TanStack Query machinery); `isFetching` from `usePortfolio` is `true` during in-flight refresh even after navigation; PortfoliosPage spinner driven by `refreshing \|\| isFetching` so it shows correctly on remount; auto-refresh on mount: `useEffect` with `data?.as_of` dep triggers refresh if cached data is >30 min old |
| 2026-06-05 | ResearchPage (Explore page) QuickStats reliability — `enabled` changed from `activeTab === 'report'` to always `true` (overview card needs `qs` on all tabs); `isPending` replaces `isLoading` for loading prop so Quick Stats tab shows "Loading stats…" throughout entire first-load+retry cycle (not "Stats unavailable" during 15s retry gaps); overview card shows "Stats unavailable" only when all retries exhausted, "Loading…" while retrying |
| 2026-06-05 | CSV upload demo mode — ⚙ settings popover in Portfolio Manager banner (right of ↻ sync); `relative` wrapper on gear button so popover is `absolute top-full right-0 z-10 mt-1 w-56 rounded-xl bg-white shadow-lg border border-slate-100`; `fixed inset-0 z-[9]` invisible overlay for click-outside dismiss (same pattern as TransactionsPage gear); content: CURRENT FILE section (filename·size, import date, or "Demo Data"), ↓ Download button, divider, IMPORT NEW FILE section with 📂 Browse & Import button; progress bar replaces button during import (0%→20%→40%→fake-smooth-85%→100%); panel stays open during import, backdrop click disabled; on completion: "✓ Portfolio updated" for 1.2s then auto-closes; `queryClient.setQueryData` injects response instantly without page reload |
| 2026-06-05 | ZoomChartOverlay landscape fix — overlay now uses `document.documentElement.requestFullscreen()` + `screen.orientation.lock('landscape')` instead of CSS `rotate(90deg)`; CSS rotation broke: (1) chart canvas didn't fill full screen width, (2) touch events stayed in portrait coordinate space so crosshair/pan were non-functional; requestFullscreen required for orientation.lock to work in Chrome browser context (PWA works without it); both wrapped independently so either can fail silently; close button calls `screen.orientation.unlock()` + `document.exitFullscreen()`; overlay container is plain `fixed inset-0 z-[200]` with no rotation |
| 2026-06-04 | ZoomChartOverlay Y-axis left — price scale moved from right to left; `leftPriceScale: { borderColor: '#1e293b', visible: true }`, `rightPriceScale: { visible: false }`, series `priceScaleId: 'left'` |
| 2026-06-04 | Explore Opportunities Go button removed — input is now `w-full` (was in a `flex gap-2` row with the Go button); Enter key and autocomplete tap still navigate; cleaner single-input UX |
| 2026-06-04 | Explore page Charts tab — tab bar now Research \| Charts \| Notes; Charts tab: sky-50 strip with "Price" pill (whitespace-nowrap, natural width) + sky sync ↻ button matching HoldingsPage style exactly; PriceChart wrapped in bg-white rounded-xl shadow-sm border border-slate-100 p-3 card; PriceChart gains hideLegend prop (hides BUY/SELL lines + Legend component) and showZoom prop (shows ⤢ button top-right of stat row) |
| 2026-06-04 | ZoomChartOverlay — new component replacing Recharts in the zoom overlay; uses lightweight-charts v5 (pinch zoom, pan, crosshair with dashed H+V lines + axis price/date labels built-in); toolbar: ✛ Crosshair (default, blue) / ↔ Range (green) mode pills in dark track; Range mode: tap point 1 (status bar shows date + price), tap point 2 → shows +X.XX% and abs move in floating badge + Reset button; all data passed as allChartData (full history, user can zoom to any period) |
| 2026-06-04 | Explore page overview card redesign — CAGR 1Y: text-[14px] font-semibold (larger, right of current price, no ago price shown); bottom row: 52W range (left) + CAGR 5Y (right, text-[10px]); sector label top-right (5Y CAGR moved to bottom); "1Y Returns" renamed to "CAGR 1Y", "5Y CAGR" renamed to "CAGR 5Y" |
| 2026-06-04 | Explore page (ResearchPage /research/:symbol) overview card redesign — company name only (no ticker below; locName → qs.company_name → yf_symbol fallback); right column next to name: sector/industry + 5Y CAGR (no MCap there); price row: price (left, 20px) + 1Y return % and 1Y ago price stacked (right, smaller); 52W range below price; back button color fixed to text-[#2563eb] matching HoldingsPage; max-w-xl mx-auto added for laptop compatibility; ResearchPage officially called "Explore page" |
| 2026-06-04 | Explore New Opportunities — renamed from "Explore New Holdings"; section header replaced with emerald gradient banner matching Portfolio Manager header (from-emerald-600 to-teal-500, rounded-xl, py-1.5, full width); mt-8 gap above banner; search input: bg-green-50 border-green-200 placeholder-emerald-400; autocomplete dropdown: bg-white border-green-200 with green-tinted hover; Go button: bg-emerald-600; recent search pills: bg-green-50 text-emerald-700 border-green-200; onFocus re-shows cached suggestions |
| 2026-06-04 | Explore New Holdings — new section at bottom of PortfoliosPage breakdown; debounced search input (300ms) + Go button; autocomplete dropdown from /api/search (Yahoo Finance proxy, EQUITY+ETF only); recent searches (last 5) as tappable pills (localStorage key `research:recent`); navigates to /research/:symbol with company name in location.state |
| 2026-06-04 | ResearchPage (/research/:symbol) — new page for researching any stock not in portfolio; sticky header with back button + overview card (price, MCap, 52W from quickStats) + 2-tab bar (Research=violet, Notes=rose); Research tab: violet strip with Quick Stats/Deep Research sub-tabs + model toggle + gear (exact same pattern as TransactionsPage); Notes tab: AnalysisTab with portfolio="research" (localStorage key `notes:research:SYMBOL`); reuses ReportTab + AnalysisTab unchanged |
| 2026-06-04 | PWA update toast — on `controllerchange` event (new SW activated), show green pill toast "✓ App updated · Built 4 Jun 16:45" (IST, from __BUILD_TIME__ injected by vite.config.ts) for 2.5s before window.location.reload(); plain DOM element, no React; __BUILD_TIME__ declared in vite-env.d.ts |
| 2026-06-04 | Quick Stats auto-retry — useQuickStats throws on partial:true response so TanStack Query auto-retries 2× with 15s delay; backend no longer caches partial results to disk or memory; fixes Render cold-start "Stats unavailable" UX |
| 2026-06-04 | Deep Research — Gemini 2.5 Flash two-stage retry: attempt 1a = 45s with full thinking + grounding; on timeout, attempt 1b = 55s with `thinking_budget=0` (no thinking); UI loading panel shows "Retrying without extended thinking…" at 45s mark; only falls through to 3.1 Lite if both attempts fail |
| 2026-06-04 | Deep Research — "Retry 2.5" button removed from unavailable state; replaced with plain "Refresh" button that uses whatever model is currently selected in the top-bar config toggle (useLite prop) |
| 2026-06-04 | Deep Research — sources moved inline with headings; bottom sources list removed; h1/h2/h3 headings each get a small ↗ external-link icon mapped sequentially to sources[0], sources[1], etc.; 3.1 Lite results show no icons (no grounding = no sources) |
| 2026-06-04 | Chart zoom — landscape overlay on Charts tab (HoldingsPage + TransactionsPage); zoom icon (⤢) at top-right of chart card (inside white card, `bg-slate-100` button); tapping opens `fixed inset-0 z-[200]` overlay; inner div `width:100dvh height:100dvw transform:rotate(90deg)` simulates landscape without Screen Orientation API (works iOS + Android); dark `#0f172a` bg; reuses `rechartsData`/`metricSeries`; dark-themed LineChart + range selector; TransactionsPage also handles Price metric (PriceChart in white card); ✕ or tap-outside to close |
| 2026-06-04 | XIRR pill consistency — `shrink-0` added to all XIRR pill spans (HoldingCard, SummaryCard, BreakCard) so they never get squeezed right; Stocks/MF tiles on PortfoliosPage now have same `rounded-full px-1.5 py-0.5` pill background as all other cards (was plain colored text); `pillBlue` prop on BreakCard switches positive XIRR to blue (#bfdbfe bg / #1e40af text) for MF cards — applies to MF tile, indian_mf/us_mf type cards, MF_ broker cards |
| 2026-06-04 | PortfoliosPage auto-refresh — `visibilitychange` listener added alongside `setInterval`; triggers refresh when tab/PWA becomes visible after 30+ min hidden; `lastRefreshedAt` ref tracks time of last refresh; both mechanisms update the ref so no double-trigger; fixes mobile PWA background throttling of `setInterval` |
| 2026-06-04 | Deep Research — `_extract_text` fix for gemini-2.5-flash thinking model — function now returns `(text, reason)` tuple; filters `thought=True` parts first (`parts_no_thought` path) then falls back to all parts; `print` log emitted to backend console when 2.5 Flash text extraction fails, showing `extract_reason` and candidate count; prevents silent fallback to 3.1 Lite when thinking parts confuse `.text` property |
| 2026-06-04 | Deep Research — model result toggle (⇄ swap) — `altStates` Record persists previous model's result in memory + localStorage (`:alt` suffix key, 7d TTL); `handleAltSwap` swaps current ↔ alt in both state and localStorage; `handleGenerate` saves current result to alt before overwriting on Refresh; attribution line: single-row `⇄` icon (sky-400, text-[11px]) before model+date text; tapping icon swaps instantly with no API call; no alt = no icon; fallback indicator `⚠ ·` stays inline on same line |
| 2026-06-04 | Deep Research — `requestedLite` field — stored in each `SectionResult` alongside model/savedAt; records whether 2.5 Flash (`false`) or 3.1 Lite (`true`) was requested at fetch time; `fallback = requestedLite === false && model === 'gemini-3.1-flash-lite'` triggers `⚠ ·` amber prefix in attribution; distinguishes intentional 3.1 Lite from 2.5 Flash fallback |
| 2026-06-04 | Deep Research — fallback unavailable UX — `showUnavailable` state per section; clicking ⇄ on a fallback card (⚠) toggles "unavailable" view instead of swapping alt; ⇄ shows even without alt when `fallback===true`; unavailable view: ⚠️ + "Results not available / Please try with other model" placeholder + "Retry 2.5" button; attribution shows `⚠ · 2.5 Flash · unavailable`; ⚠ removed from normal 3.1 Lite attribution (warning only when viewing unavailable, not when 3.1 Lite is working fine) |
| 2026-06-04 | Research tab — model toggle redesigned — replaced two-button track (`[🌐 2.5 Flash][⚡ 3.1 Lite]`) with single tap-to-toggle rounded-full pill; active state shown inline: `🌐 2.5 Pro` (violet-100/violet-700) or `⚡ 3.1 Lite` (slate-100/slate-500); saves horizontal space on 412px mobile; `setReportUseLite(v => !v)` on tap |
| 2026-06-04 | Deep Research card colors — vibrant blue/green palette (all cards bumped from -50 bg → -100 bg, -200 border → -300, -500 accent → -600/-700); business: slate → blue-700; results: sky → teal; financial: teal → emerald; technical: green → blue-600; 4 blue-family + 4 green-family split; accentHex drives 4px left + 2px top border prominence |
| 2026-06-04 | Notes strip — `flex items-center` for vertical centering of "Personal notes" label; text left-aligned (default) |
| 2026-06-01 | Report tab — Screener.in as data source for Indian stocks — `_fetch_screener()` scrapes top-ratios section (PE, P/B, ROCE, ROE, Div Yield, MCap, 52W High/Low); Screener values override yfinance for Indian stocks; yfinance retained as supplemental source for Fwd PE, EPS TTM, Beta, Net Margin, Rev Growth; `_compute_roce()` (Pretax Income / Invested Capital × 100) used for US stocks only since Screener not applicable |
| 2026-06-01 | Report tab — Quick Stats card 3×4 fundamentals grid — replaces old 4-cell row + inline div yield; Row 1 Valuation: PE · Fwd PE · P/B · PEG; Row 2 Returns: ROCE · ROE · ROA · Net Margin; Row 3 Context: EPS TTM · Rev Growth · MCap · Beta; `fmtPct` (v×100), `fmtRatio`, `colorNum` helpers; ROCE displayed as direct % (backend returns percentage value, not fraction); ROE/ROA/Net Margin as decimal fractions via fmtPct; cells use `bg-slate-50 rounded-lg p-1.5`, label `text-[9px]`, value `text-[11px] font-semibold` |
| 2026-06-02 | Report tab — PE History chart — 5Y quarterly PE data from Macrotrends iframe endpoint (`/assets/php/fundamental_iframe.php?t={TICKER}&type=pe-ratio&frequency=Q`); `v1`=price, `v2`=TTM EPS, `v3`=PE; Recharts LineChart 80px tall; dashed ReferenceLine at current PE; Min/Avg/Max row below; US stocks only (`pe_history: null` for Indian) |
| 2026-06-02 | Report tab — Quick Stats grid expanded to 4×4 — Row 1 Valuation: PE/Fwd PE/P-B/D-E; Row 2 Returns: ROCE/ROE/ROA/Net Margin; Row 3 Growth: Rev 1Y/Rev 3Y/EPS 1Y/EPS 3Y; Row 4 Context: EPS TTM/PEG/MCap/Beta; gap reduced to `gap-1.5` |
| 2026-06-02 | Report tab — loading progress bar — thin `h-0.5` sliding blue bar at top of Quick Stats card on first load (`loading=true`) and on sync (`syncing=true`); `@keyframes qs-progress` via inline `<style>` tag; card uses `overflow-hidden` to clip bar to rounded corners |
| 2026-06-02 | Report tab — Revenue Segments SEC EDGAR card removed — parsed garbage numbers; `_fetch_sec_segments()` call removed from quickstats.py; `revenue_segments` field removed from types.ts and ReportTab.tsx |
| 2026-06-02 | Report tab — Perplexity replaced by Gemini 2.5 Flash — 7 section link cards replaced with inline expandable cards; each card has Generate button (idle/error) or ↻ (done); Generate calls POST /api/gemini with google-genai SDK + Google Search grounding; response renders inline via react-markdown + remark-gfm (tables, headers, bullets); localStorage persistence per gemini:{yf_symbol}:{sectionId}; ↻ passes force_refresh=true to bypass 1h backend cache; elapsed timer in loading panel (0–5s: "Querying live sources…", 5–12s: "Reading search results…", 12s+: "Composing answer…"); FORMAT_SUFFIX appended to all prompts instructs Gemini to use markdown tables + bold headers + no preamble |
| 2026-06-02 | Report tab — "Latest Results & Concall" for Indian stocks — now embeds `https://stock-analyzer-2nqw.onrender.com/api/filing/{symbol}/text` at top of Perplexity prompt; backend fetches PDF from BSE, extracts plain text via pdfplumber, serves at stable public URL; Perplexity reads the text URL instead of trying to fetch BSE directly |
| 2026-06-02 | Report tab — Revenue Segments card — new 7th section in SECTIONS array; query asks for segment names, INR crore, % of total, YoY growth %, EBITDA margin %, key KPIs; `site:nsearchives.nseindia.com OR site:bseindia.com` operator for Indian; direct question format (no "find/fetch" language) to avoid Perplexity multi-step fetch loops; PDF reading not possible via Perplexity fetch_url (limitation noted) |
| 2026-06-02 | Report tab — PEG ratio fallback computation — if yfinance returns null (all Indian stocks), compute `PEG = trailing_pe / (earnings_growth × 100)` in `_fetch()` after Screener overlay |
| 2026-06-02 | Report tab — source link + ↻ force-refresh button at top of Quick Stats card — source link = `screener.in/company/{SYM}/` for Indian stocks, `finance.yahoo.com/quote/{SYM}` for US; ↻ button calls backend with `force_refresh=true` (busts 24h disk cache) then `invalidateQueries(['quickstats', yf_symbol])`; `useQueryClient` used directly in ReportTab; button spins via `animate-spin` while refreshing |
| 2026-06-02 | Revenue Segments card (US stocks) — `_fetch_sec_segments()` in quickstats.py; 3-step SEC EDGAR XBRL: ticker → CIK via `sec.gov/files/company_tickers.json` (in-memory cached per process) → latest 10-K accession via `data.sec.gov/submissions/CIK{}.json` → `FilingSummary.xml` keyword match (disaggregation/segment information/segment reporting/geographic/etc.) → R-file HTML table parsed via XBRL viewer class selectors (`ro`/`re` rows, `pl` labels, `num*` values); fallback to generic `<tr>` parsing; scale detection from "in millions/thousands" text; `revenue_segments: {period, items[{name, value_m, pct}]}` field added to QuickStats response + TypeScript type; card rendered between PE History and Analysis sections (US only); rows: segment name (truncate) + `$XB`/`$M` + `XX%` + blue proportional bar; returns null for Indian stocks |
| 2026-06-01 | HoldingsPage Allocation tab rows tappable — By Sector, By Market Cap, and Concentration section rows now navigate to TransactionsPage on tap; changed from `<div>` to `<button>` with same onClick pattern as Benchmarking tab; Concentration "Other" bucket has empty key so navigation is skipped |
| 2026-06-01 | HoldingsPage search/filter strip — single-row strip replaces two-row layout; [🔍 search input] [Sector ▾] [sort ↓] all on one line; count ("X open · Y closed") moved into search input placeholder text (dynamic, reflects Open/Closed/All toggle); sector filter button uses `text-teal-600 font-medium` inactive state matching sort button; search icon uses `text-teal-600`; `visibleRows` memo applies search + sector filter on top of `sortedRows`; `symbolSectorMap` memo maps navSym → SectorKey for both open and closed holdings |
| 2026-06-01 | TxRow 2-column mobile layout — replaced 3-col grid (`1fr 1.3fr 1fr`) with 2-col (`1fr 1.3fr`); left col = Date + Invested, right col = stacked gains (Cur value → Unreal → Real → Total); partial positions get extra rows for realised + total; fixes truncation on 412px screens where each 3-col cell was only ~113px |
| 2026-06-01 | PriceChart BUY/SELL dot size by transaction value — `buildChartData` computes `qty × price` for each trade txn, scales radius linearly r=3 (smallest) → r=10 (largest) across all trades; `buyR`/`sellR` stored on ChartPoint; multiple same-date trades use max value; `BuyDot`/`SellDot` read `payload.buyR`/`payload.sellR` |
| 2026-06-01 | Closed holdings charts — `holdingArrForCharts` useMemo in TransactionsPage builds synthetic `Holding[]` (qty=0, avg_cost from BUYs, yf_symbol from first transaction) when no open position; passed to usePortfolioHistory so all 7 historical metrics render; yf_symbol fallback now uses `symTxns[0].yf_symbol` instead of clean symbol |
| 2026-06-01 | TypeScript cleanup — `BenchmarkOutput` interface gains `loadedCount`/`totalCount`/`fetchingCount`; inner useMemo `Omit<>` extended to exclude `isFetching`; `tsconfig.json` lib `ES2020→ES2022` for `Array.at()` support; zero `tsc --noEmit` errors |
| 2026-06-01 | Boot context reduction — `DESIGN.md` (607→396 lines), `ROADMAP.md` (185→55 lines), `project_react_fastapi.md` (315→82 lines); old entries archived to `DESIGN_HISTORY.md` + `ROADMAP_ARCHIVE.md`; saves ~574 lines per session boot |
| 2026-05-31 | Allocation tab sunburst reverted to accordion â€” `@nivo/sunburst` tooltip crashed with `undefined` datum on center/root hover (TypeError: Cannot read properties of undefined reading 'depth'); reverted to 3-section accordion: By Sector (open default), By Market Cap (collapsed), By Holdings Concentration (collapsed); restored states `expandedAllocSectors`, `expandedMktCapBuckets`, `sectorSectionOpen`, `mktCapSectionOpen`, `concentrationSectionOpen`; removed `allocView`, `selectedAllocSector`, `sunburstSectorData`, `sunburstMktCapData`, `AllocNodeDatum` |
| 2026-05-31 | Allocation accordion 4-column layout â€” matches production design; columns: Sector (dot + name + count) \| Alloc (% + colored bar below) \| Value (XIRR) \| Today (gain + %); 7px uppercase column headers; `sectorData` + `mktCapData` useMemos now include `todayGain` (summed from `h.disp_today_gain`); alloc bar width = `s.pct%` of 52px column; Today shows `â€”` when gain is 0 |
| 2026-05-31 | Allocation tab restored to 1933ab7 baseline â€” reverted all session-48 changes; back to clean accordion with inline `fmtTodayGain` helper, `h-1.5` full-width alloc bar below sector row, `gap-1.5` layout throughout |
| 2026-05-31 | Allocation column header banner â€” `bg-violet-100 rounded-lg mx-1 py-1.5 px-2` full-width strip with `text-violet-700 font-semibold` labels; applied to both By Sector and By Market Cap sections |
| 2026-05-31 | Allocation column alignment â€” Alloc: `text-center`; Value (XIRR): `text-right`; Today: `text-right`; applied consistently to headers, sector data rows, and holding rows in both By Sector and By Market Cap |
| 2026-05-31 | Benchmarking column header banner â€” `bg-green-100 rounded-lg mx-1 py-1.5 px-2` with `text-green-700 font-semibold`; columns: Sector (XIRR) / Benchmark (XIRR) / Alpha |
| 2026-05-31 | Benchmarking date filter moved inline â€” ðŸ“… button now sits flush right on the "By Sector" header row; config panel expands inline inside the card below the header; standalone date filter block above the table removed |
| 2026-05-31 | Returns histogram border card â€” ComposedChart wrapped in `bg-white rounded-xl shadow-sm border border-slate-100 p-3 mt-1`; matches Charts tab chart card style |
| 2026-05-31 | Returns bar value labels â€” `LabelList` with custom SVG `<text>` renderer; shows `+â‚¹12L` / `âˆ’â‚¹3L` in green/red above each bar; only in year mode with â‰¤ 8 bars |
| 2026-05-31 | Returns year selector multi-select â€” `returnsYears: number[]` replaces `returnsYear: number`; gear popover year pills toggle on/off (min 1 always selected); multi-year month view shows months across all selected years with labels `Jan '23`, `Feb '24`; summary line shows range `2023â€“2025` for multi-year |
| 2026-05-31 | ^NDX benchmark fix (backend) â€” `history.py` `_fetch` retries `yf.download` with `auto_adjust=False` when first attempt returns empty; newer yfinance on Render silently returns empty DataFrame for US index symbols with `auto_adjust=True`; Indian indices unaffected |
| 2026-05-31 | Font size bump attempt (reverted) â€” all text below 10px bumped to 10px minimum (column headers 7pxâ†’10px, card labels 9pxâ†’10px, chart axes 8pxâ†’10px); user preferred original compact sizes; reverted in full (git revert e845fd7); original font sizes remain unchanged |
| 2026-05-31 | Charts + Analysis tab horizontal padding removed â€” Charts wrapper `px-3 pt-1 pb-3` â†’ `pt-1 pb-3`; Analysis wrapper `p-3` â†’ `pt-2`; content now flush with page `px-4` edges, matching Holdings tab |
| 2026-05-31 | Font size bump applied selectively â€” minimum 10px re-applied to HoldingsPage, TransactionsPage, HoldingCard, SummaryCard, TxRow, PriceChart, ReportTab; PortfoliosPage kept at original compact sizes (8px/9px labels) â€” half-width grid cards overflow with larger fonts |
| 2026-06-03 | Sticky header on HoldingsPage + TransactionsPage — outer wrapper changed to `h-[100dvh] flex flex-col`; sticky section (`shrink-0 px-4 pt-4 bg-white`) holds: back/settings, summary/overview card, tabs, tab-specific strips (Holdings search strip, Charts metric pills, Analysis sub-tabs, Report sub-tabs, Notes strip); scrollable section (`flex-1 overflow-y-auto px-4 pb-4`) holds only list/chart/research content; applies to all tabs on both pages |
| 2026-06-03 | Gear icon popover click-outside-to-close — added `fixed inset-0 z-[9]` overlay behind the gear popover in TransactionsPage; same pattern as sector/sort dropdowns on HoldingsPage; tapping anywhere outside now dismisses it |
| 2026-06-03 | Quick Stats partial error card — `ReportTab.tsx` condition changed from `qs ?` to `(qs && !qs.partial) ?`; when backend returns `{partial:true}` (yfinance timeout/rate-limit), shows "Stats unavailable / Retry" card instead of grid full of dashes; Retry calls `force_refresh=true` to bust disk cache |
| 2026-06-03 | quickstats.py _TimeoutAdapter removed — yfinance updated API now requires curl_cffi session; passing a `requests.Session` throws `YFDataException`; removed `_TimeoutAdapter` class + `import requests`; `_yf_ticker()` now returns plain `yf.Ticker(symbol)` |
| 2026-06-03 | Deep Research 8-card redesign — 7 SECTIONS → 8; cards: Business Overview/Moat (slate) · Industry Outlook/Macro (blue) · Latest Earnings/Guidance (sky) · Valuation Metrics (indigo) · Peer Comparison Matrix (cyan) · Financial Health/Trends (teal) · News/Sentiment/Red Flags (emerald) · Technical Analysis Setup (green); each card uses inline style `borderLeftWidth:4 borderTopWidth:2 borderLeftColor/borderTopColor:accentHex` matching SummaryCard pattern (strong left accent); card bg is light 50-shade fill; header right: "Research" (idle outline) / "Show Results" (done solid, expands) / "Refresh" (done solid when expanded, triggers force-refresh) button + tiny `text-[8px]` attribution text "Results fetched by 2.5 Flash on D Mon HH:MM" below button (done state only); footer legend removed; bottom sync link removed; `fmtSavedAt` updated to include HH:MM time; `fmtModelName` helper added |
| 2026-06-03 | Research tab button color distinction — Quick Stats inactive state changed to `bg-emerald-100 text-emerald-700 border-emerald-200` (emerald tones) to visually distinguish it from Deep Research which uses violet; previously both were bg-violet-200 |
| 2026-06-03 | 30-min auto-refresh fix — `refetchInterval` removed from `usePortfolio` hook (it called backend without force_refresh, backend returned disk-cached prices with same as_of); replaced with `setInterval` in PortfoliosPage every 30 min that calls `handleRefresh()` via a ref to avoid stale closure; `handleRefresh` uses `forceRefresh()` → `fetchPortfolio(currency, true)` guaranteeing fresh yfinance prices and updated timestamp |
| 2026-06-03 | Inactive pill borders + backgrounds — all strip pill bars (Charts metric pills on HoldingsPage + TransactionsPage, Research sub-tabs Quick Stats/Deep Research, model toggle 2.5 Flash/3.1 Lite, Analysis sub-tabs Allocation/Benchmarking/Returns): inactive state gains `border border-[color]-200` (visible outline) + `bg-[color]-100` fill (light tinted bg) so pill shape is always readable against the strip; active state unchanged (solid filled color + white text) |
| 2026-06-03 | Gemini API keys moved to env vars — `GEMINI_KEY_MAIN` / `GEMINI_KEY_BACKUP` read via `os.environ.get()` at request time; `_load_keys()` replaces `_KEYS` list; local `.env` provides values for dev; Render env vars required for production; git history rewritten (squash) to remove keys from all commits |
| 2026-06-03 | Tab button design unified — both HoldingsPage and TransactionsPage: active tabs darkened to 200-shade (teal-200/sky-200/violet-200 + matching 800 text); Notes tab amber→rose-200; Charts strip fixed to sky-50/sky-200 regardless of selected metric; inner bar buttons (metric pills, sub-tab pills, model toggle) gain `border border-[color]` active / `border border-transparent` inactive; Realized Gains pill color amber→pink (bg-pink-600, line #ec4899); sync button in Charts strip fixed to sky gradient |
| 2026-06-03 | quickstats.py reliability — `_TimeoutAdapter` (10s per-call timeout via HTTPAdapter.send) passed to all yfinance HTTP calls via `_yf_ticker()`; `get_quickstats` wrapped in top-level try/except returning `{"partial": True}` on unhandled error; disk cache read/write wrapped separately; prevents 503 from Render 30s kill on slow yfinance/Screener.in calls |
| 2026-06-03 | Quick Stats "Stats unavailable" fix — `isFetching: qsFetching` added to useQuickStats destructure in TransactionsPage; `loading={qsLoading || qsFetching}` passed to ReportTab so loading spinner persists through retry wait gap (not just during active fetch) |
| 2026-06-03 | Report tab — Deep Research / Quick Stats sub-tabs — violet Report strip in TransactionsPage replaced with full sub-tab bar (`bg-violet-50 border-violet-100`); left: `[Deep Research \| Quick Stats]` pill toggle (`bg-violet-100` track, `bg-white text-violet-700` active pill); right: model toggle + gear when Deep Research active, ↻ sync when Quick Stats active; `reportTab`/`useLite`/`useKey`/`gearOpen` states lifted to TransactionsPage; passed as props to ReportTab |
| 2026-06-03 | Report tab — API key toggle — gear icon (SVG) in strip right side (Deep Research only); tap opens absolute popover (`right-0 top-full z-10 shadow-lg`); iOS toggle switch (`h-6 w-11 rounded-full`, grey/blue track, white thumb slides); label "Backup Key"; no dot indicator on gear; toggle OFF = Main (`_KEYS[0]`), toggle ON = Backup (`_KEYS[1]`); persisted in localStorage `gemini:key_index` |
| 2026-06-03 | Report tab — `_read_api_key` simplified to use `_KEYS[index]` directly — removed env var/.env lookup that was reading backup key from local `.env`; both keys hardcoded in `_KEYS` list in gemini.py; no env var override needed |
| 2026-06-03 | Report tab — API key toggle (pending) — Main/Backup pill toggle in Analysis header; `key_index` sent in POST body; backend picks from hardcoded `_KEYS` list; persisted in localStorage |
| 2026-06-03 | Report tab — model toggle (2.5 Flash / 3.1 Lite) — iOS pill toggle in Analysis header; `useLite` state; `force_lite` sent in POST body; backend skips attempt 1 when true; cache key includes force_lite; selection persists in localStorage per toggle (existing results unchanged until ↻) |
| 2026-06-03 | Report tab — card header shows model used — `🌐 2.5 Flash` (blue) or `⚡ 3.1 Lite` (grey) + date replaces dot + "Updated"; `model` field in GeminiResponse + SectionState + localStorage; determines which icon/label to show |
| 2026-06-03 | Report tab — accordion + auto-expand — generating a card auto-expands it and collapses all others; tapping chevron also collapses all others before expanding the tapped one; accordion enforced via full reset of expandedSections state |
| 2026-06-03 | Report tab — footer legend — two rows below last card: 🟢 Gemini 2.5 Flash + Google Search (live data) · ⚪ Gemini 3.1 Flash Lite (training data · fallback when search quota exhausted) |
| 2026-06-03 | Research tab (renamed from Report tab) — Quick Stats is default sub-tab; sub-tab buttons: Quick Stats=emerald-500 active, Deep Research=violet-600 active; both `rounded-md font-medium` solid active / text-only inactive inside `bg-violet-100` track |
| 2026-06-03 | Quick Stats emerald design language — card `border-emerald-200` + 3px gradient top strip; grid cells `bg-emerald-50` with `text-emerald-600/70` labels; 52W range label/dot/current-price in emerald; all dividers `border-emerald-100`; loading/sync progress bar `bg-emerald-500`; footer: Screener.in sky pill (left), Analyst Ratings emerald pill → Yahoo Finance `/analysis/` (right); Refresh button removed from footer |
| 2026-06-03 | Pill style unified across all strip controls — `rounded-md font-medium`, solid color active (white text, shadow-sm), text-only transparent inactive; pills sit inside tinted track container (`rounded-lg p-0.5`); applied to: TransactionsPage Charts strip, HoldingsPage Charts strip, HoldingsPage Analysis strip (Allocation=orange-500, Benchmarking=sky-500, Returns=emerald-500) |
| 2026-06-03 | HoldingsPage METRIC_STYLE refactored — active: solid color (no gradient), inactive: text-only (no bg/border); added `trackBg` hex field for per-metric track background tint |
| 2026-06-03 | `normalizeRec()` + `recColor()` — yfinance `"none"` recommendationKey displayed as "Neutral" (slate color `#64748b`) in Quick Stats analyst row; handled both frontend (cached data) and backend (new fetches) |
| 2026-06-03 | Report tab — gemini.py fallback improved — attempt 1: gemini-2.5-flash with grounding (confirmed working, ~20 RPD free); attempt 2: gemini-3.1-flash-lite plain (500 RPD); `_is_fatal_error` replaces `_is_grounding_error` — any non-auth error (503, 429, timeout) falls through to attempt 2; attempt 2 retries once after 3s sleep on transient error |
| 2026-06-02 | Report tab — Gemini model: `gemini-3.1-flash-lite` (500 RPD, 15 RPM free tier); Google Search grounding removed (grounding quota is account-level, exhausts across projects; Gemini 3.x has 0/0 grounding quota on free tier); cards now use training data only; grounding can be re-enabled when billing is set up; `.env` key read at request time (not module load) so key rotations take effect without restart |
| 2026-06-02 | Report tab — Gemini cards collapsible by default — chevron `▶`/`▼` on far left of header; collapsed = header only; tapping left side toggles; state resets on symbol switch; `expandedSections: Record<string, boolean>` state |
| 2026-06-02 | Report tab — card header layout — left: `▶/▼` (fixed `w-3`) + emoji + title/description; right: "Updated DD Mon + ↻" when done, "Generate/Retry" when not; `savedAt` stored in SectionState + localStorage; `fmtSavedAt()` helper |
| 2026-06-02 | Report tab — 7-day localStorage cache — `savedAt: Date.now()` written alongside text/sources; on load, entries older than `7 * 24 * 3600 * 1000` ms discarded and removed; `setExpandedSections({})` on symbol switch |
| 2026-06-02 | Report tab — error reason display — `SectionState` type changed to `{ error: string }` (was `'error'` string literal); catch captures `err.message`; shown as `text-[9px] text-red-400 max-w-[130px]` below Retry button |
| 2026-06-02 | Report tab — markdown heading sizes — h1: `text-[15px]` bold; h2: `text-[13px]` bold; h3: `text-[12px]` semibold slate-600; body `text-[11px]`; previously all near-identical causing visual flatness |
| 2026-06-02 | Report tab — bullet alignment — reverted to `list-outside pl-5` (was changed to `list-inside`); `list-outside` wraps long lines under text not marker; `li` gets `pl-0.5` for spacing |
| 2026-06-02 | Report tab — table fix — removed `w-full` from table (was forcing 412px squeeze); `td` gets `whitespace-nowrap align-top`; `overflow-x-auto` wrapper unchanged; columns now size to content and scroll horizontally |
| 2026-05-31 | PortfoliosPage XIRR overflow fix â€” compact BreakCard XIRR chip: `text-[8px]` + `whitespace-nowrap shrink-0`; Stocks/MF tile XIRR span same; prevents text wrapping to new line in grid-cols-2 layout |

## Archived from DESIGN.md (sessions 99–141, 2026-06-06 to 2026-06-19)

> Moved here 2026-06-21 to keep DESIGN.md's live log under the ~100-line cap. Raw entries kept as-is (not reformatted to table rows).

### 2026-06-19 (session 141)

**Sync-status banners — green for confirmations, amber for warnings**
- "Charts/Dividends already up to date"/"recently updated" banners changed from dark `bg-slate-800` to `bg-emerald-600 text-white font-bold` per user request — green reads as a positive confirmation
- New "N symbols didn't refresh" banner (dividends) uses `bg-amber-600` instead, deliberately distinct from the green ones — it's a warning (data may be stale/incomplete for those symbols), not a confirmation

### 2026-06-19 (session 139)

**Charts "Refresh" button — "already up to date" toast for the no-op case**
- Clicking Refresh within the existing 30-min staleness window (`REFRESH_MS`) previously did nothing visible — the request still went out but the backend served cached data unchanged, leaving the user unsure if it had worked
- Added a transient toast (`fixed top-3 left-1/2 -translate-x-1/2`, dark `bg-slate-800` pill, 3s auto-dismiss via `setTimeout`) reading "Charts already up to date", shown instead of firing the refetch at all when `Date.now() - histLastSynced < REFRESH_MS` — same visual language as other ephemeral status banners (dark pill, white text, rounded-full), distinct from the emerald "new version available" banner style used for persistent/actionable banners in `App.tsx`

### 2026-06-18 (session 132)

**Background-sync UI pattern — "Refreshing…" indicator**
- Standardized small-text background-revalidation indicator across all chart surfaces: `text-[9px] text-slate-400`, spinning `↻` + `Refreshing…`, right-aligned. Used in `PriceChart.tsx` (replacing the old inline pulsing "Updating…" next to the price) and as a new block in `HoldingsPage.tsx`/`TransactionsPage.tsx` Charts tabs
- Rule going forward: the big labeled progress bar (`Loading…`/`Syncing… X/Y · pct%`) is reserved for (a) a true cold load with nothing cached yet, or (b) an explicit manual sync tap — never for a passive, already-rendered-from-cache background refetch

**Overview cards — 1D/ALL/XIRR label gap reduced to single NBSP**
- Was two NBSP characters (session 131's fix); reduced to one per user request — same NBSP mechanism, just one character instead of two, across all 9 spots (BreakCard, hero, Stocks/MF tiles)

**SummaryCard FX/Dividends layout — matched then refined from HoldingCard**
- First pass: replaced SummaryCard's separate "FX gains"/"Dividends" rows with HoldingCard's combined right-aligned `· FX` / `· DIV` line
- Refined per follow-up: FX moved to its own left-aligned row directly under "Invested", using full text ("FX gains") instead of the `· FX` abbreviation; Dividends stays as the `· DIV` line. Two different placements by design — not a revert

**Settings modal z-index bug — pattern to watch for**
- `HoldingsPage.tsx`'s nav-bar header had no `position`/`z-index` of its own; an absolutely-positioned popover inside it still loses to a later, non-positioned sibling (the scrollable content area) in stacking order, since z-index only resolves within a stacking context and the header never established one. Fix: add `relative z-20` to the header wrapper itself, not just the popover. Same risk likely applies to any other absolutely-positioned popover anchored inside a non-positioned ancestor on this page.

### 2026-06-17 (session 131)

**Overview page — 1D/ALL/XIRR spacing bug fix (follow-up to session 130)**
- Session 130's `{'  '}` (two regular space characters) had no visible effect after shipping — browsers collapse consecutive regular spaces in rendered HTML regardless of how many appear in JSX source, so the requested gap silently disappeared in production
- Fixed by using actual non-breaking spaces (`  `) instead of regular spaces at all 6 spots (BreakCard + hero + Stocks/MF tiles, both the 1D/ALL value gap and the XIRR pill gap) — NBSP is never collapsed by `white-space: normal`, so this renders reliably
- Lesson: literal space characters in `{'...'}` JSX expressions are not a reliable spacing mechanism in this codebase; use NBSP for inline text gaps, or flex `gap-*` when the two parts are already separate elements

### 2026-06-17 (session 130)

**Overview page — XIRR/gain % precision + spacing (BreakCard + hero + Stocks/MF tiles)**
- XIRR now shown to 1 decimal place (was 2) — local `fmtPct1`/inline `.toFixed(1)` added in `PortfoliosPage.tsx` rather than touching the shared `fmtPct`/`fmtCompactGainLine` in `fmt.ts`, since those are also used by TransactionsPage/HoldingCard/SummaryCard/TxRow/ReportTab and the request was scoped to Overview cards only
- 1D/ALL gain percentages also switched to 1 decimal via new local `fmtCompactGainLine1` helper (same scoping reason)
- Added a 2-space gap (`{'  '}`) between the `1D`/`ALL`/`XIRR` labels and their values on all three card types

**Holdings page — Benchmarking pill (Analysis tab)**
- "Overall" stat card redesigned: added left accent border (green/red, matching `BreakCard` style) + an alpha visualization bar underneath the 3 stat columns, matching the per-sector rows below it instead of being a flat box
- Date filter icon: 📅 emoji → funnel SVG (same path used elsewhere in the app's filter UI) for icon-language consistency
- Date filter config panel converted from an inline block (was pushing the sector list down when opened) to an absolutely-positioned overlay popover anchored to the button — same pattern as the Settings and Returns config popovers; narrowed to `w-[190px]`
- Removed the separate "Use today as end date" toggle — the To-month/year selects are now directly editable and default to the current month/year; `benchPeriodEnd` resolves to "today" automatically whenever the selected To-date matches the current month
- Popover border/Apply button kept in the sky theme already used for the Benchmarking pill itself, for color consistency with the rest of that tab

### 2026-06-17 (session 129)

**Overview page XIRR pill re-indent (BreakCard + Stocks/MF tiles)**
- User reported XIRR pill "too much right indented," wanted it starting closer to the value's left edge — re-added `-ml-1.5` to the wrapping `<div className="flex items-center">` on both BreakCard (line ~182) and Stocks/MF tile (line ~1107)
- Note: session 128 had removed a `-ml-1.5`/`-ml-2` negative margin, attributing the alignment issue instead to a missing `flex items-center` wrapper. This session's re-add is a different, explicit user preference (visual indent reduction), not a regression of the session 128 fix — the `flex items-center` wrapper fix is still in place; this just nudges the pill left within it.

### 2026-06-17 (session 128)

**Overview page card redesign (BreakCard + hero + Stocks/MF tiles)**
- XIRR pill indent fixed: removed `-ml-1.5`/`-ml-2` negative margin that pulled it too far left; wrapped in `flex items-center` (the plain `<div>` wrapper had no flex, so its line-box "strut" came from the page's default font/line-height instead of the 9-10px pill content — this, not the negative margin, was the real cause of the XIRR/ALL vertical misalignment that `leading-none` alone didn't fix)
- Vertical spacing: `gap-y-0` → `gap-y-2` between the value/1D row and XIRR/ALL row
- Current value font bumped: BreakCard 13/15px → 15/17px (compact/non-compact); Stocks/MF tiles 13px → 15px
- Card padding `p-2` → `p-2.5`, label margin `mb-1` → `mb-1.5` for less cramped feel
- Non-hero cards (By Type/By Broker/Stocks/MF): "1D"/"ALL" labels + XIRR pill text → 9px (was 10px); `+` sign stripped from XIRR via `.replace(/^\+/, '')` (hero card XIRR keeps the `+` and 10px)
- Page-level `px-4` → `px-2` on Overview/Holdings/Transactions outer wrapper to reduce side white space

**TransactionsPage summary card**
- Inline overview card's Value/1D/XIRR/ALL block converted from `flex justify-between` to the same `grid grid-cols-[auto_1fr] items-center gap-y-0` pattern as `SummaryCard.tsx`, for the same alignment fix

**PWA update banner**
- Added a dismiss "×" button next to "Update" — dismissing just hides the banner (`setUpdateReady(false)`), doesn't reload or skip the already-downloaded update; banner reappears on next visibility check

### 2026-06-17 (session 126)

**Card row alignment fixed — flex-col → CSS Grid**
- Session 125's "guarantees perfect vertical alignment" claim for the 1D/ALL layout was wrong: independent `flex-col` columns size each row to their own tallest child, so the XIRR pill (taller, has padding) and the ALL row (plain text) drifted apart by ~15-20px depending on font size
- Replaced with `grid grid-cols-[auto_1fr] items-center gap-y-0` — row 1 = value + 1D, row 2 = XIRR/fallback + ALL; grid rows are shared across both columns so they align within 1px regardless of content height
- Applies to: `SummaryCard.tsx`, `HoldingCard.tsx`, `PortfoliosPage.tsx` (BreakCard + hero card + Stocks/MF tiles + segment tiles)
- `gap-y-0` chosen over `gap-y-0.5`/`gap-y-1` per user request for compact cards — row heights from content alone already give enough visual separation

**XIRR pill wrapping bug (narrow tiles)**
- In 2-column tiles (Stocks/MF, segment Breakdown cards), the `XIRR +33.29%` pill would wrap to two lines when the percentage had more digits, breaking the grid alignment above it
- Fixed: `whitespace-nowrap` added to the XIRR pill span in both `BreakCard` and the separate Stocks/MF tile block in `PortfoliosPage.tsx`

**Filters toggle pill bug (Status / View segmented controls)**
- Sliding indicator assumed equal-width segments (`w-1/3`/`w-1/2` flex-1), but buttons sized to their own text content ("Closed" wider than "Open"/"All") — indicator drifted and visually covered part of the longer label's text
- Fixed: gave both toggles a fixed container width (`w-[150px]`) + `text-center`/`whitespace-nowrap` on buttons so segments are truly equal

**Settings popover (Holdings page gear icon) — redesigned**
- Action rows (Add New Holdings / Charts / Dividends / Benchmarking analysis) consolidated here; sync icons removed from each tab's own top bar (Charts strip, Dividends tab header, Benchmarking pill row) for a cleaner per-tab UI
- Row background lightened to `bg-emerald-50/60` (was solid `bg-emerald-50`)
- Status + Show Closed merged into one card (single border, internal `border-t` divider) instead of two separate bordered boxes
- "Show Closed" label restyled to match "Status"/"View" pattern (`text-[10px] text-slate-400 uppercase tracking-widest`), kept label-left/toggle-right (not right-indented — tried indenting, reverted per feedback)
- All 4 action buttons made uniform: `w-[70px]`, no icon, single short verb ("Add"/"Refresh"/"Update"); button shows "Syncing…" as text during sync instead of a spin icon
- Datetime moved outside/below the button, centered (`items-center`, not `items-end` — right-aligned looked off-center under a centered button)
- Benchmark XIRR hook (`useBenchmarkXirr`) enabled flag changed from `activeTab === 'analysis' && !!data` to `!!data` — otherwise the new settings-popover refresh button did nothing and the timestamp never appeared until the user had visited the Analysis tab at least once

**TransactionsPage tab bar height**
- "Txns/Charts/Research/Notes" segmented control `py-1` → `py-2` (was too short relative to the rest of the page)

### 2026-06-16 (session 125)

**1D / ALL text pills on all cards**
- Clock SVG (Today) → `1D` text pill; sigma SVG (Total) → `ALL` text pill; color `#065f46` (dark emerald, same as XIRR positive)
- Fixed width `inline-block w-[22px] text-right` on both labels so they column-align across rows
- Restructured card layout: single `flex items-start justify-between` row; left = `flex-col` (currency value + XIRR pill); right = `flex-col items-end` (1D row stacked above ALL row) — guarantees perfect vertical alignment
- Applies to: `HoldingCard.tsx`, `SummaryCard.tsx`, `PortfoliosPage.tsx` (BreakCard + hero card + broker/segment tiles), `TransactionsPage.tsx` (inline summary card)
- Hero card XIRR uses `px-2 -ml-2`; all other cards use `px-1.5 -ml-1.5` to align XIRR text with left content edge

**Positive gain sign removed**
- `fmtCompactGainLine` in `fmt.ts`: `gain >= 0 ? '+' : '−'` → `gain >= 0 ? '' : '−'`
- Positive values now show bare number; negative values still show `−` (en-dash) in red

**Nav bar — final state (session 125)**
- `pt-2` → `pt-4` on both pages (matches overview page top spacing)
- Back icon: SVG chevron (`path d="M15 18l-6-6 6-6"`, strokeWidth 2.5) replaces `‹` character — vertically centres with text
- Back label: `text-[15px] font-bold` (was `text-[10px] font-medium`)
- **HoldingsPage**: `justify-between` — back button (left) + gear icon (right); no centered portfolio title
- **TransactionsPage**: back button only (no gear, no title); `backLabel` strips " Holdings" suffix — shows raw portfolio name
- `getCsvMeta()` cross-checks `portfolio:csv` content exists; shows "Demo Data" if content missing despite meta present

### 2026-06-16 (session 124)

**Nav bar redesign — Holdings + Transactions pages**
- Replaced bare back-button-only bar with iOS-style nav: `‹ Back label` (left) + bold centered title (right spacer balances)
- Back button: `‹` chevron (text-[20px]) + small label (text-[10px]); `min-h-[44px] min-w-[60px]` touch target
- Title: `text-[15px] font-bold text-white truncate flex-1 text-center`
- HoldingsPage title = `label` (portfolio/segment name); TransactionsPage title = `co || decoded.symbol`
- Gear icon bumped `w-6 h-6` → `w-8 h-8` with `active:bg-white/20` hover state

**Explore modal header — full-width green bar**
- Removed `mx-4` inset from header div; changed `rounded-xl` → `rounded-t-2xl` to match modal container corners

**Icon labels — Today / Total / Filters**
- "Today" replaced with 9×9 clock SVG (`viewBox="0 0 12 12"`, circle + hands path)
- "Total" replaced with 9×9 sigma Σ SVG (path traces Σ shape)
- "Filters" section header prefixed with 9×9 funnel SVG
- Text labels removed everywhere; icons only (PortfoliosPage, HoldingCard, SummaryCard, TransactionsPage, HoldingsPage)
- Icon spans: `flex items-center gap-[3px]` wrapper; `style={{flexShrink:0}}` on SVG

**Font size floor — 10px minimum**
- All `text-[8px]` (11 occurrences) and `text-[9px]` (81 occurrences) bumped to `text-[10px]` across 12 files
- Dynamic `lblSize`/`gainSize` in PortfoliosPage BreakCard both resolve to `text-[10px]`

**Transactions page default tab**
- `useState` default changed from `'transactions'` → `'charts'` so Price chart opens first

### 2026-06-06

**Deep Research top bar — model toggle moved into gear, iOS key selector**
- Model toggle (⚡/🌐 Lite/Pro pill) removed from top bar strip; moved into gear popover as first row ("Model" label + pill button)
- API Key selector redesigned from 3 circular `w-7 h-7` numbered pills → iOS segmented control: `bg-slate-100 rounded-full p-0.5` container with `flex-1 rounded-full` segments; active = `bg-white shadow-sm text-slate-700`; inactive = `text-slate-400`; labels "Key 1" / "Key 2" / "Key 3"
- Top bar strip now shows only: [AI Assistant pill] [gear icon] — two items instead of four
- AI Assistant button: kept as text pill (`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full`) — icon-only version was tried and reverted (looked bad)
- Gear popover layout: `flex flex-col gap-2.5`; Model row `flex items-center justify-between gap-4`; API Key section `flex flex-col gap-1.5` with segmented row below label

### 2026-06-12 (session 102)

**Search modal — keyboard-aware positioning**
- Added `inputFocused` state to `PortfoliosPage.tsx`; on input `onFocus` → switches outer flex from `items-center` to `items-start pt-4` so modal pins to top of viewport when mobile keyboard opens
- Max-height expands from `70dvh` → `92dvh` when input is focused (keyboard shrinks viewport; need more of remaining space)
- Suggestions changed from `absolute top-full` dropdown to inline block within the scrollable container (`flex-1 overflow-y-auto`) — fixes suggestions being clipped behind keyboard and only 2 rows showing; now all results visible and scrollable
- "Searching…" indicator also changed from absolute to inline (`mt-1` block), consistent with suggestions

### 2026-06-14 (session 112)

**Closed position LTP — null initial, history patch**
- `HoldingsPage.tsx` `closedRows`: initial `ltp` always `null` (was `priceMap.get(sym) ?? null` from backend holdings, which could return stale/sell-date price); `closedRowsWithLtp` useMemo already patches from `symbolPriceMap` history — that patch is now the sole LTP source
- `TransactionsPage.tsx`: removed `lastSellPrice` fallback from `ltp` computation entirely; `ltp` now `anyHolding?.current_price?.toFixed(2)` OR history last-price from `txPriceMap` (destructured from `usePortfolioHistory`); `usePortfolioHistory` `enabled` changed from `chartMetric !== 'Price' && !!data` → `!!data` so history always loads regardless of chart tab (needed for LTP even on Price tab)
- Dead code removed: `priceMap` + `lastSellMap` inside `closedRows` useMemo (HoldingsPage)

**HoldingsPage scroll restore on back navigation**
- Scrollable container is `<div className="flex-1 overflow-y-auto">` — not `window`; `window.scrollY` was always 0; `window.scrollTo` had no effect
- Fix: `scrollRef = useRef<HTMLDivElement>()` attached to the scrollable div; all 5 save sites use `scrollRef.current?.scrollTop ?? 0`; restore sets `scrollRef.current.scrollTop = y`
- Restore effect fires on `sortedRows.length > 0` (not `data`) so it waits until closed cards are actually in the DOM; double `requestAnimationFrame` ensures browser has painted before setting scrollTop; effect placed after `sortedRows` useMemo (avoids temporal dead zone)

**Price chart cache alignment**
- `PriceChart.tsx` `start` changed `'2000-01-01'` → `'2015-01-01'`; makes `lsKey = ${yf_symbol}:2015-01-01` match what `usePrefetchHoldingCharts` writes → `placeholderData` hits localStorage cache → chart renders instantly
- `useHistory.ts` daily `queryKey` changed from `['history',yf_symbol,start]` → `['history',yf_symbol]` to share React Query in-memory cache with `usePortfolioHistory` (same key); intraday keeps `['history',yf_symbol,'1d']`
- Trade-off: "All" range starts from 2015 (not 2000); pre-2015 history lost

### 2026-06-16 (session 122)

**Add Transaction Modal — design language (`AddTransactionModal.tsx`)**
- New modal for BUY/SELL transactions; entry points: HoldingsPage gear → "Add Holding" and TransactionsPage "+ Txn" button
- Gradient header `bg-gradient-to-r from-emerald-600 to-teal-500`; white body `bg-white`; section cards `bg-emerald-50 rounded-xl border border-emerald-100 p-3`
- Design rule enforced: colored elements *inside* cards (emerald-50), outside body stays white — initial prototype had it inverted (colored bg + white cards); swapped to match app-wide pattern
- Portfolio + Type in one row; Date + Quantity + Price in 3-column grid (`grid grid-cols-3 gap-2`); no "copy to portfolios"; no "Your Holdings" quick-picks
- `lockSymbol` prop: stock shown as read-only badge when opened from TransactionsPage (pre-filled)
- Price pre-fill: checks existing holding `current_price` first, then `/api/quickstats` with spinner; 300ms debounced `/api/search` autocomplete

**Settings panel restructure — PortfoliosPage (`PortfoliosPage.tsx`)**
- `w-72` → `w-80`; rows compacted from `py-2.5` → `py-2`
- **Data section**: Import CSV (moved first), Portfolio file, Demo file
- **Configuration section**: Dividends toggle, FX gains toggle, Currency toggle
- **Updated on footer**: `border-t border-slate-100`; left "Updated on" label; right `v{__APP_VERSION__} · {datetime} IST`
- `__APP_VERSION__` injected via Vite `define` block from `package.json` at build time; `vite-env.d.ts` extended

**HoldingsPage gear popover redesign (`HoldingsPage.tsx`)**
- Gradient header + white body `bg-white p-2`; matches settings modal pattern
- Two labelled sections: "Filters" (Status / Show Closed / View rows) and "Actions" (Add Holding button)
- Section labels: `text-[9px] font-semibold text-emerald-600 uppercase tracking-widest`
- Row cards: `bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-2`; left label `text-[9px] text-slate-400 uppercase`; right pill with `bg-emerald-500` active fill, `text-white`
- `min-w-[270px]` so Status + View fit on one row without wrapping

**Breakdown toggle color — PortfoliosPage (`PortfoliosPage.tsx`)**
- Active breakdown toggle pill: `bg-emerald-500 text-white` (was `bg-white text-slate-700`)

**Gradient nav bar — HoldingsPage + TransactionsPage**
- Pattern: `bg-gradient-to-r from-emerald-600 to-teal-500` applied to inner nav row only via `-mx-4 px-3 py-1.5 mb-3`; outer wrapper stays `bg-white px-4 pt-0`; back-button `text-emerald-100 active:text-white`
- No centered title in nav bar — portfolio/holding name shown on summary card below; redundant in nav
- Gear icon in HoldingsPage nav (`text-emerald-100`); TransactionsPage nav has back button only

### 2026-06-16 (session 123)

**Nav bar — contained width, rounded, white gap above**
- Removed `-mx-4` full-bleed; nav bar now contained within page `px-4` padding — aligns with summary card edges
- Added `rounded-xl` to nav bar div
- Outer wrapper `pt-0` → `pt-2` so there's a small white gap above the nav bar
- Back button: `text-emerald-100` → `font-semibold text-white` for better legibility; no centered title (name already in summary card below)

**HoldingsPage gear popover — compact row cards**
- Row card vertical padding `py-2` → `py-1` on all three rows (Status, Show Closed, View)
- Body gap `gap-2` → `gap-1`; body padding `p-2` → `px-2 py-1.5`
- Pill button inner padding `py-[4px]` → `py-[3px] px-2` for tighter pill feel
- Action button (Add Holding) also `py-2` → `py-1`

### 2026-06-16 (session 121)

**fmtUSD — full numbers in USD mode (`fmt.ts`)**
- `fmtUSD` no longer abbreviates under $1M; `$7.8K` → `$7,821` (comma-formatted); only abbreviates ≥$1M as `$1.23M`
- `fmtCompact` retains K abbreviation for compact card lines (unchanged)

**CSV import — always store INR in query cache (`PortfoliosPage.tsx`)**
- Import POST was sending the live `currency` prop (could be `'USD'`), getting USD-denominated response, then `setQueryData(['portfolio'])` stored USD values in the INR cache
- Hardcoded `currency: 'INR'` in import POST params — `usePortfolio` always subscribes to `['portfolio']` expecting INR; FX conversion is client-side only
- Bug symptom: total portfolio 2.12 Cr displayed as 2.24L (values divided by ~95.5 USD/INR rate)

**Charts tab — sync icon + progress bar (`HoldingsPage.tsx`)**
- Sync button: `invalidateQueries` → `refetchQueries({ type: 'active' })` — old approach set queries stale async so the `useEffect([syncing, histLoading])` cleared the spinner before fetching actually started; new approach sets `fetchStatus='fetching'` immediately so `histLoading` stays true until data arrives
- Progress bar: `h-1` → `h-1.5`; transition `duration-300` → `duration-700` to smooth visual batch jumps; ghost pulse (`opacity-20 animate-pulse` on full bar width) shows activity when count is stuck between batches; spinning `↻` on label so user always sees active loading regardless of counter

**usePortfolioHistory — retry on fetch failure (`usePortfolioHistory.ts`)**
- `retry: 0` → `retry: 2, retryDelay: 8_000` so transient failures (e.g. backend cold start right after CSV import) auto-retry twice with 8s gaps
- `fetchSymHistory` previously caught all errors and returned empty data (success state, blocking retry); now throws on non-OK response so TanStack retry actually fires

### 2026-06-15 (session 120)

**HoldingCard — FX + Dividends layout (`HoldingCard.tsx`)**
- FX and Dividends moved from two separate right-aligned rows into a single right-aligned sub-line under the Total G/L row
- Labels `· FX` and `· DIV` use `text-slate-400` (same muted style as "Today" and "Total" labels for consistency)
- Values use `text-teal-600 font-semibold`; `fmtCompactGainLine` already includes `+` sign — no manual prefix
- Dot prefix on each label (`· FX`, `· DIV`) acts as separator; `gap-1.5` between the two items when both present
- Render: only when `fxAmt > 0 || divAmt > 0`; each item conditional independently

**Settings popover — permanent demo file row (`PortfoliosPage.tsx`)**
- New "Demo file" row added between Portfolio file row and Import CSV row; always visible regardless of uploaded CSV
- Download button calls `window.open(API_URL_SETTINGS + '/api/demo-csv', '_blank')` — always fetches latest demo from backend
- Sub-label: "Sample portfolio · ~1 Cr · 32 stocks" — descriptive context for new users
- Styling mirrors existing Portfolio file row exactly (`bg-white border border-emerald-200 rounded-lg`, `w-8 h-8 bg-slate-200` button)

**SEC EDGAR link fix (both pages)**
- Changed from `CIK=${sym}&type=10-` (direct ticker lookup, fails for new/foreign listings) → `company=${sym}&CIK=&type=` (name/ticker search, no filing-type filter)
- Fixes "No matching Ticker Symbol" for foreign private issuers (20-F filers) and recently listed tickers; tooltip desc updated to "10-K / 20-F & earnings filings"
- Applies to both `ResearchPage.tsx` and `TransactionsPage.tsx`

### 2026-06-14 (session 113)

**DividendsTab — year/month filter and period total**
- Filter bug root cause: was comparing against `s.month_pattern` (historical month numbers from all past dividends) instead of actual `ev.ex_date` months — a stock with a February dividend would always show regardless of which month was selected
- Fix: `visibleSymbols` filters on actual event dates: `ev.ex_date.slice(0,4)` for year, `parseInt(ev.ex_date.slice(5,7), 10)` for month; AND logic (year AND month both must match if both selected)
- Period total: `periodTotal` useMemo computes sum across all `activeSymbols` events (not just visible ones) that match the active year+month filter; shown as teal pill badge in chart header when any filter is active; `null` when no filter active (no badge shown)
- Filter applies to both the chart data AND the symbol table (visibleSymbols drives both)

**Trendlyne URL fix**
- Added `/NSENB/` exchange segment to Trendlyne URLs for Indian stocks: `https://trendlyne.com/equity/NSENB/${sym}/`
- Applies to both `ResearchPage.tsx` and `TransactionsPage.tsx`

### 2026-06-15 (session 119)

**FX tab — per-holding accordion with lot-level table**
- Per Holding section converted from static rows → accordion: tap holding to expand lot-level table
- Table columns: Date · Shares · USD (qty×cost_usd) · Rate (buy_fx_rate INR/USD) · FX Gain per lot
- Column widths: `grid-cols-[90px_40px_52px_44px_1fr]` fixed grid for mobile alignment; `tabular-nums` on all numeric cells
- Date formatted as `fmtDate()` → "14 May '21" (day Mon 'YY); `lot.date.slice(0,10)` guards against ISO timestamps
- Total row at bottom of expanded section: teal-50 background, confirms per-holding sum
- Lots sorted oldest → newest; lot count shown as "N lots" badge in header
- Negative FX gains (header + lot rows + total row) → `text-red-500`; positive → `text-teal-700`
- `expandedHoldings: Set<string>` state added alongside existing `expandedYears`

### 2026-06-13 (session 108)

**Settings modal full redesign (PortfoliosPage gear icon)**
- All rows follow one consistent pattern: left = label (`text-[12px] font-medium text-slate-700`) + subtitle (`text-[11px] text-slate-400`), right = action button / control
- Modal header: `bg-gradient-to-r from-emerald-600 to-teal-500` strip with "Settings" title + × close button; matches page header style
- Modal body: `bg-emerald-50` background; rows wrapped in `p-2 flex flex-col gap-1.5`
- Each row: `bg-white border border-emerald-200 rounded-lg px-3 py-2.5` — visible card with green border outline
- 5 rows: Portfolio file (download icon btn), Import CSV (upload icon btn + slim progress bar), Include dividends (teal toggle), Display currency (pill switcher), About (Updated on datetime)
- Backdrop: `bg-black/40 z-[998]`; modal: `z-[999] w-72`; removed `overflow-hidden` (was clipping row borders at container corners)
- Download button: `bg-slate-200 text-slate-600`; import button: `bg-emerald-200 text-emerald-700`

**Currency toggle — consistency + persistence**
- `App.tsx`: `currency` state initialises from `localStorage.getItem('currency')` → survives page reload; `handleCurrencyChange` writes to localStorage
- `PortfoliosPage.tsx`: removed single global `scale = 1/usd_inr`; replaced with `usdScale(isUsd)` + `usdCur(isUsd)` helpers applied per-card
- Hero card + Stocks/MF tiles: always `'INR'` — they aggregate mixed currencies so USD conversion is meaningless
- Type breakdown cards: `us_stock`/`us_mf` → USD when toggled; `indian_stock`/`indian_mf` → always INR
- Broker breakdown cards: `USD_PORTS` (Vested/IndMoney US/IndMoney Mummy) → USD when toggled; all other portfolios → always INR
- `usePortfolioHistory.ts`: fixed today-pin bug — `h.disp_current` is always INR from backend; was overriding last chart point with raw INR value while rest of series was in USD → chart Y-axis spiked to ~3 Cr; fix: `const todayFx = currency === 'USD' ? 1 / usdInr : 1` applied to `disp_current` + `disp_invested` before pinning

### 2026-06-10 (session 99)

**Settings popover redesign (PortfoliosPage gear icon)**
- Replaced full-width download button with compact emerald file card: `bg-emerald-50 border border-emerald-100 rounded-xl`; CSV badge (`w-9 h-9 bg-emerald-600` with "CSV" text); filename + size·date on two lines; download = small `w-8 h-8` icon button with `border-emerald-200` on right side of card
- Section labels ("Current File", "Import New File") removed; import button simplified to "Import CSV" with upload SVG icon
- Build version added at bottom: `text-[11px] text-slate-300` formatted as `10 Jun 2026, 14:32 IST`
- Popover width: `w-60` (up from `w-56`); `rounded-2xl` (up from `rounded-xl`)

**PWA update banner — manual + top strip**
- Removed auto-reload after 2.5s (was an intrusive DOM element + setTimeout); removed `main.tsx` controllerchange auto-reload
- New: `updateReady` React state in `App.tsx`; on `controllerchange` sets state → shows persistent top strip banner
- Banner: `fixed top-0 left-0 right-0 bg-emerald-50 border-b border-emerald-200 px-4 py-2`; left: "New version available" (`text-[12px] text-emerald-700`); right: "Update" button (`bg-emerald-100 border-emerald-300 rounded-full`)
- SW update check: runs on visibility change + `setInterval` every 30 min (covers users who never background the app)
- Version shown only in settings popover; no persistent badge in normal UI

**Deep Research gear — 3-way model selector**
- Model toggle changed from binary pill (2.5 Flash ↔ 3.1 Lite) to 3-segment control: `2.5 Flash | 2.5 Lite | 3.1 Lite`
- Layout: `bg-slate-100 rounded-full p-0.5` container; active = `bg-white text-violet-700 shadow-sm`; inactive = `text-slate-400`; `text-[12px] px-2.5 py-1`
- State: `reportUseLite` (bool) + `reportUse31` (bool); `force_31: bool` param added to `GeminiRequest` / `ChatRequest`

**Deep Research — model failure error labels**
- When gemini-2.5-flash fails, returns `gemini25_{reason}` error code with `detail` field (actual exception text)
- Frontend maps codes → labels: quota→"Quota exceeded", timeout→"Timed out", overloaded→"Model overloaded — try 3.1", empty→"Empty response", other→"2.5 Flash unavailable"
- Button shows "Try 2.5 Lite" (purple) instead of generic "Retry" for all gemini25_* errors

### 2026-06-12 (session 103)

**Dividends tab — color scheme and layout**
- 4th tab on HoldingsPage (after Holdings / Charts / Analysis); tab pill: `bg-amber-200 text-amber-800` active, same inactive style as other tabs
- Summary strip: 2×2 grid of amber-50 tiles (Total Earned, Projected/Year) + slate-50 tiles (Stocks paying, Best year)
- TDS warning banner: `bg-orange-50 border-orange-100` with warning SVG; shown when `total_dividends_inr > 5000` (India ₹5K TDS threshold)
- Year chart: Recharts BarChart; current year bar `#f59e0b` (amber-500), prior years `#fcd34d` (amber-300); tooltip `bg-#fffbeb border-#fde68a`
- Month calendar: 12-month horizontal grid; active months `bg-amber-400 text-white`, inactive `bg-slate-100 text-slate-300`; derived from all symbols' month_pattern arrays
- Per-stock rows: exchange badge (NSE=blue, BSE=orange, US=slate); right side: amber-600 total + YoC %; chevron expands to event table
- Event table columns: Ex-date (80px) | Shares | Per share (60px, `$` vs `₹` by currency) | Earned (60px, amber-700)
- `DividendsTab.tsx` — standalone component; `useDividends()` hook drives data; `useForceRefreshDividends()` on refresh icon
- Toggle (include dividends in returns): amber switch in gear popover (`PortfoliosPage.tsx`); dispatches `window.Event('dividends-toggle')` for cross-page sync; persisted in `localStorage('settings.includeDividends')`
- SummaryCard/HoldingCard: `dividends?: number` prop; amber "Dividends +₹X" footer row when prop > 0; included in totalGain computation
- TransactionsPage: collapsible "Dividends received" section; driven by `useDividendForSymbol(symbol)` which reads from query cache

### 2026-06-10

**Explore section — FAB + Bottom Sheet (PortfoliosPage)**
- Removed inline "Explore New Opportunities" section (was `mt-32` below breakdown cards — awkward scroll, duplicate header)
- Replaced with fixed teal FAB (`bottom-6 right-4`, `w-14 h-14`, `rounded-full`, `bg-emerald-500`, search icon SVG)
- Tapping FAB opens bottom sheet: `fixed inset-x-0 bottom-0 z-50`, `rounded-t-2xl`, `65dvh` max height, slide-up `transition-transform duration-300`
- Sheet contains: drag handle nub, gradient header (same `from-emerald-600 to-teal-500`), ✕ close button (`min-h-[44px] min-w-[44px]` for touch target), search input, autocomplete dropdown, "Recent" label + pills
- Backdrop: `fixed inset-0 z-40 bg-black/40`, tap to dismiss
- `navigateToResearch()` calls `setSheetOpen(false)` before `navigate()` so sheet closes on result tap
- Added `pb-24` to the page container so FAB doesn't overlap last card

### 2026-06-12

**Dividends tab redesign — teal color scheme, year/month filter, search, yield badge**
- All amber/orange dividend colors replaced with teal/cyan across 6 files (DividendsTab, HoldingCard, SummaryCard, TransactionsPage, PortfoliosPage, HoldingsPage)
- TDS banner removed from DividendsTab summary strip
- Year filter: clickable Recharts Bar cells; selected bars `#0d9488`, unselected `#cbd5e1` when any selected, all `#5eead4` when no selection; multi-select (`Set<string>`)
- Month filter: 12-grid MonthCalendar; selected=`bg-teal-600 text-white ring-1 ring-teal-400`; active-unselected=`bg-teal-200 text-teal-700`; inactive months disabled with `bg-slate-100 text-slate-300`
- Year+month filters combined with AND; "clear filter" link appears when either active; stock count `(X/Y)` badge when filtered
- Search input with SVG magnifying glass at top of symbol list; `focus:border-teal-300`; case-insensitive match on symbol
- Dividend yield shown as teal pill badge `bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full` on each symbol row; `projected_annual` shown as `~X/yr` in right column
- State reset on portfolio/segment switch via `key={portfolio ?? ''}:${segment ?? ''}` prop on DividendsTab
- Dividend yield shown as teal pill badge `bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full` on each symbol row; `projected_annual` shown as `~X/yr` in right column

**Portfolio-scoped dividends**
- `GET /api/dividends?portfolio=X` — backend filters txns to single portfolio in `_compute()` before all share calculations; per-portfolio 24h cache key `dividends:{portfolio}`
- DividendsTab props: `currency`, `portfolio?`, `filterSymbols?`; `useDividends(portfolio)` with TanStack Query key `['dividends', portfolio ?? '']`
- `filterSymbols` only active for segment filter (client-side); portfolio scoping handled entirely by backend
- `useDividendForSymbol` reads from global `['dividends', '']` cache (TransactionsPage use case, no portfolio filter)
- Closed holdings included automatically — backend scopes by portfolio and includes all ex-dates where shares > 0, regardless of current open/closed status

**Currency toggle in gear icon (PortfoliosPage)**
- `[₹ INR] [$ USD]` pill selector added to settings popover (after dividends toggle, before version footer)
- Container: `flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5`; active segment: `bg-white text-slate-700 shadow-sm`; inactive: `text-slate-400 active:text-slate-600`

**Explore search — bottom sheet → centered modal**
- FAB tap now opens a centered modal instead of a bottom sheet
- Container: `fixed inset-0 z-50 flex items-center justify-center px-4`; fade animation (`opacity-0/100 pointer-events-none/auto duration-200`)
- Inner card: `bg-white rounded-2xl shadow-2xl w-full` with `maxWidth: 480, maxHeight: 70dvh`
- Drag handle removed (no longer a bottom sheet); header, search input, autocomplete, recent pills unchanged
- Backdrop (`fixed inset-0 z-40 bg-black/40`) still closes on tap

### 2026-06-09

**File import progress bar — asymptotic easing to 99%**
- Previous: hard cap at 85% via `Math.min(pct + 3, 85)` caused visible freeze while POST was in-flight
- Fix: `pct += (99 - pct) * 0.05` per 180ms tick — asymptotic approach, bar keeps moving, never stalls; jumps to 100% on response
- Fix: `pct += (99 - pct) * 0.05` per 180ms tick — asymptotic approach, bar keeps moving, never stalls; jumps to 100% on response

**Toggle/flag persistence across navigation — localStorage**
- HoldingsPage: `holdingFilter`, `showClosed`, `activeTab`, `viewMode`, `sortField`, `sortDir`, `sectorFilter` persisted under `hp:*` keys
- PortfoliosPage: `mode` (By Type / By Broker) persisted under `pp:mode`
- Pattern: lazy `useState(() => localStorage.getItem(key) ?? default)` + single `useEffect` write-back

**Closed-position summary card gain color fix — TransactionsPage**
- Bug: `gainPos = gain >= 0` used unrealized gain only; for closed positions `cur=0, inv=0 → gain=0 → always green`
- Fix: `gainPos = (gain + realGain) >= 0` — matches the displayed total (`gain + realGain` on line 413)
- Applies to both open positions (unrealized + partial-sell realized) and fully closed positions

### 2026-06-14 (session 117)

**FX Gains feature — toggle + 5th tab**
- Toggle lives in PortfoliosPage gear icon (amber, mirrors dividends teal pattern); dispatches `fxgains-toggle` event; HoldingsPage listens via event listener
- 5th tab "FX" in HoldingsPage shown only when toggle ON (injected into tabs array conditionally); amber-200/amber-800 active class; auto-switches back to 'holdings' if toggle turned OFF while on 'fx' tab
- FX gain formula (per holding): `fx_gain_INR = total_invested_usd × (current_rate − avg_buy_fx_rate)` where `avg_buy_fx_rate` = FIFO-weighted INR/USD rate across remaining open lots
- `buy_fx_rate` read from CSV col 13 (`Purchase Exchange Rate`); `fillna(1.0)` for INR rows; stored in `_Lot.buy_fx_rate` in portfolio.py FIFO engine
- `fx_lots` array in bundle: per-lot open positions for USD portfolios (`{symbol, yf_symbol, portfolio, date, qty, cost_usd, buy_fx_rate}`); `FxGainsTab` derives all 4 sections purely client-side
- XIRR recalculation when FX toggle ON: BUY cash flows use `tx.buy_fx_rate` (actual INR spent at purchase) instead of current `data.usd_inr`; SELL stays at current rate; applies in `xirrMap`, `filteredSummaryXirr` (HoldingsPage) and `stkXirr`, `heroXirr`, `cardXirrMap` (PortfoliosPage)
- `FxGainsTab.tsx` sections: (1) amber-50 summary strip, (2) rate bucket bars grouped by 5-INR bands, (3) year/month collapsible timeline, (4) per-holding table with avg buy rate → current rate + FX gain %
- Color: amber throughout (amber-50 bg, amber-200/700 text/border) — distinct from dividends (teal) and analysis (violet)

### 2026-06-20 (session 143)

**Manage Portfolio: Add/Delete/Copy split into a landing menu**
- Settings → "Manage Portfolio" now opens a small menu modal (3 options) instead of jumping straight to one action — picking an option opens its own full modal. Add disabled (greyed, opacity-60, not opacity-50 — user wanted the row still readable) on bucket/label/Total pages; Copy disabled on real broker pages, since copy/tag changes from a single-broker page didn't make sense

**Delete Holding modal — light/subtle red, not alarming red**
- Initial red-600/rose-500 gradient felt too aggressive for a destructive-but-routine action; switched to rose-400/red-300 gradient + rose-100 borders/text throughout, keeping the red *family* (still reads as destructive) without it being jarring

**Asset Class tiles & generic Bucket cards — shades of green only, zero-state shows real zeros**
- Per user request, Stocks/Mutual Funds/any other Asset Class label tile share one exact green (no per-label color cycling); MF_Vikash/MF_Mahak broker cards switched from blue to the same green family, dropped the blue XIRR pill special-case for MF
- 1D and XIRR on every summary/holding/break card now default to `0 (0%)`/`0.0%` instead of `—`/gray when there's no data — matches how `ALL` already defaults to 0 rather than showing "no data"

**Compact modal density pass**
- `AddTransactionModal.tsx` brought down to the same density as the newer modals (DeleteHoldingModal/PullHoldingsModal/ManageBucketsModal): `p-3`→`p-2.5`, label-to-input `mb-2`→`mb-1`, stock symbol/Total font 13px→12px
