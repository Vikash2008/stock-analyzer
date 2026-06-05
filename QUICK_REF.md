# QUICK_REF.md — Always-Loaded Session Reference

> Compact reference for every session. Read this + CLAUDE.md + FEATURE_MAP.md at boot. Nothing else unless task requires it.

## Live URLs

| Service | URL |
|---|---|
| Frontend (Vercel) | https://stock-analyzer-blush.vercel.app |
| Backend (Render) | https://stock-analyzer-2nqw.onrender.com |
| GitHub | https://github.com/Vikash2008/stock-analyzer (master branch) |

## Portfolio Config

| Group | Members |
|---|---|
| **SKIP_PORTS** (exclude from all totals) | `Equity`, `MF_Portfolio` |
| **USD_PORTS** | `Vested`, `IndMoney US`, `IndMoney Mummy` |
| **Indian stock ports** | `Zerodha`, `AngelOne`, `Groww`, `IndMoney Ind`, `Upstox` |
| **MF ports** | `MF_Vikash`, `MF_Mahak` (+ others) |

## Key Invariants

1. FIFO per portfolio — `_run_fifo()` runs once per portfolio group; never mix
2. `Equity` = duplicate aggregate of all stock ports → always excluded from totals
3. `MF_Portfolio` = duplicate aggregate of all MF ports → always excluded
4. USD FX fallback ~95.5 (never 84.0 or 85.5)
5. `data.total_gain` = unrealized only; frontend adds realized on top for true total
6. rmap keyed by `portfolio:cleanSymbol` (no `.NS`/`.BO` suffix)
7. Single API fetch on load — all filtering (segment, portfolio) is client-side React state
8. yf_symbol format: NSE → `SYMBOL.NS`, BSE → `SYMBOL.BO`, US → uppercase

## Validated Numbers (May 2026)

- USD/INR live rate: ~95.38
- Zerodha invested: ₹37,09,666
- Equity invested: ₹1,33,22,568
- Hero invested (all non-SKIP): ~₹1,44,95,000
- Tech sector XIRR: ~42%

## Number Correctness — Key Cross-Page Rules

| Rule | Check |
|---|---|
| P1–P3 | Hero = Stocks + MF (current / invested / totalGain) |
| H4 | Summary totalGain = unrealized + realizedGain |
| X1 | Hero totalGain = Holdings(/segment/total) totalGain |
| X5 | HoldingCard totalGain = TransactionsPage summary totalGain |
| D1 | Equity and MF_Portfolio excluded from every aggregation |

Full rules (P1–P8, H1–H6, T1–T3, X1–X7, D1–D5) → `ARCHITECTURE.md`

## Local Dev Commands

```powershell
# Backend
uvicorn backend.main:app --reload --port 8000

# Frontend (from frontend/)
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm run dev   # http://localhost:5173
```

> Always restart uvicorn after editing any backend/*.py file.
