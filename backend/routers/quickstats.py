"""
GET /api/quickstats?yf_symbol=APOLLOHOSP.NS
GET /api/quickstats?yf_symbol=META&force_refresh=true

Returns key valuation stats (P/E, MCap, 52W range, analyst target) for the
Report tab. Lightweight — only ticker.info, no financial statements.

Caching:
  In-memory : 30 min burst (same process)
  Disk      : 30 days per symbol (per-symbol key "qs:{SYMBOL}")
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import json
import math
import re
import time
import urllib.request
from datetime import datetime

import yfinance as yf
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from src.cache import Cache


def _yf_ticker(symbol: str) -> yf.Ticker:
    return yf.Ticker(symbol)

router = APIRouter()

_mem: dict[str, tuple[dict, float]] = {}
_MEM_TTL  = 1800.0           # 30 min in-memory burst — same-process duplicate-request guard
_DISK_TTL = 30 * 86400.0     # 30 days per-symbol disk — fundamentals don't change daily;
                             # force_refresh (manual ↻) is the way to pull sooner than this

_cik_map: dict[str, str] | None = None  # ticker → 10-digit CIK, fetched once per process


def _with_timeout(fn, timeout: float = 12.0):
    """Run a blocking callable in a thread with a deadline. Returns None on timeout."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(fn)
        try:
            return fut.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            return None


def _clean(v):
    if v is None:
        return None
    try:
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    except (TypeError, ValueError):
        return v


def _fmt_cap(v, currency: str):
    if not v:
        return None
    if currency == "INR":
        cr = v / 1e7
        if cr >= 100_000:
            return f"₹{cr / 1_00_000:.1f}L Cr"
        return f"₹{int(cr):,} Cr"
    else:
        if v >= 1e12:
            return f"${v / 1e12:.2f}T"
        if v >= 1e9:
            return f"${v / 1e9:.1f}B"
        return f"${v / 1e6:.0f}M"


def _compute_roce(ticker) -> float | None:
    """ROCE = Pretax Income / Invested Capital × 100. Matches Screener.in formula."""
    if ticker is None:
        return None
    try:
        inc = _with_timeout(lambda: ticker.income_stmt, timeout=10)
        bs  = _with_timeout(lambda: ticker.balance_sheet, timeout=10)
        if inc is None or bs is None:
            return None
        pretax = (
            float(inc.loc["Pretax Income"].iloc[0])
            if "Pretax Income" in inc.index else None
        )
        invested_cap = (
            float(bs.loc["Invested Capital"].iloc[0])
            if "Invested Capital" in bs.index else None
        )
        if pretax is None or invested_cap is None or invested_cap <= 0:
            return None
        if math.isnan(pretax) or math.isnan(invested_cap):
            return None
        return round(pretax / invested_cap * 100, 2)
    except Exception:
        return None


_SCREENER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":         "https://www.screener.in/",
}


def _fetch_screener(clean_symbol: str) -> dict:
    """Scrape key ratios from Screener.in. Tries consolidated first, falls back to standalone."""
    for suffix in ("/consolidated/", "/"):
        try:
            url  = f"https://www.screener.in/company/{clean_symbol}{suffix}"
            req  = urllib.request.Request(url, headers=_SCREENER_HEADERS)
            html = urllib.request.urlopen(req, timeout=12).read().decode("utf-8", errors="ignore")
            if "top-ratios" not in html:
                continue  # not a valid stock page — try next suffix

            start = html.find("top-ratios")
            chunk = html[start : start + 10000]  # 10k chars — enough for all ratio items

            items = re.findall(
                r'<span class="name">\s*(.*?)\s*</span>.*?<span class="number">([\d.,]+)</span>',
                chunk, re.DOTALL,
            )
            ratios: dict[str, float] = {}
            for name, value in items:
                name = re.sub(r'\s+', ' ', name).strip()
                try:
                    ratios[name] = float(value.replace(',', ''))
                except ValueError:
                    pass

            out: dict = {}
            price = ratios.get("Current Price")

            if "Stock P/E" in ratios:
                out["trailing_pe"] = ratios["Stock P/E"]
            if "Book Value" in ratios and price:
                out["price_to_book"] = round(price / ratios["Book Value"], 2)
            if "ROCE" in ratios:
                out["roce"] = ratios["ROCE"]
            if "ROE" in ratios:
                out["return_on_equity"] = round(ratios["ROE"] / 100, 5)
            if "Dividend Yield" in ratios:
                out["dividend_yield"] = round(ratios["Dividend Yield"] / 100, 6)
            if "Market Cap" in ratios:
                mcap_inr = ratios["Market Cap"] * 1e7
                out["market_cap"] = mcap_inr
                out["market_cap_display"] = _fmt_cap(mcap_inr, "INR")
            if price:
                out["current_price"] = price

            hl = re.search(
                r'High / Low.*?<span class="number">([\d.,]+)</span>.*?<span class="number">([\d.,]+)</span>',
                chunk, re.DOTALL,
            )
            if hl:
                out["week_52_high"] = float(hl.group(1).replace(',', ''))
                out["week_52_low"]  = float(hl.group(2).replace(',', ''))

            for section in [
                ("Compounded Sales Growth",  "revenue_growth",  "revenue_growth_3y"),
                ("Compounded Profit Growth", "earnings_growth", "earnings_growth_3y"),
            ]:
                sec_name, ttm_key, yr3_key = section
                idx = html.find(sec_name)
                if idx == -1:
                    continue
                sec_chunk = html[idx: idx + 800]
                rows_found = re.findall(
                    r'<td[^>]*>(3 Years?|TTM)[^<]*</td>\s*<td[^>]*>([^<]+)</td>',
                    sec_chunk, re.IGNORECASE,
                )
                for period, raw_val in rows_found:
                    try:
                        val = float(raw_val.strip().replace('%', '').replace(',', ''))
                        pct = round(val / 100, 4)
                        if "3" in period:
                            out[yr3_key]  = pct
                        elif "TTM" in period.upper():
                            out[ttm_key]  = pct
                    except ValueError:
                        pass

            if out:  # got at least some data — return it
                return out
        except Exception:
            continue  # try next suffix

    return {}


def _compute_growth_3y(ticker) -> dict:
    """3Y CAGR for revenue and net income from annual income_stmt. US stocks only."""
    result = {}
    try:
        inc = _with_timeout(lambda: ticker.income_stmt, timeout=10)
        if inc is None:
            return result
        for row_name, key in [("Total Revenue", "revenue_growth_3y"), ("Net Income", "earnings_growth_3y")]:
            if row_name not in inc.index:
                continue
            series = {col: float(inc.loc[row_name][col]) for col in inc.columns}
            valid = sorted([(k, v) for k, v in series.items() if v and not math.isnan(v)], key=lambda x: x[0])
            if len(valid) >= 4:
                older  = valid[-4][1]
                recent = valid[-1][1]
                if older > 0 and recent > 0:
                    result[key] = round((recent / older) ** (1 / 3) - 1, 4)
    except Exception:
        pass
    return result


def _compute_5y_cagr(ticker) -> float | None:
    """5-year annualised price return from monthly history."""
    try:
        h = _with_timeout(lambda: ticker.history(period='5y', interval='1mo'), timeout=15)
        if h is None or h.empty or len(h) < 12:
            return None
        start = float(h['Close'].iloc[0])
        end   = float(h['Close'].iloc[-1])
        if start <= 0 or math.isnan(start) or math.isnan(end):
            return None
        years = len(h) / 12.0
        return round((end / start) ** (1.0 / years) - 1, 4)
    except Exception:
        return None


def _compute_1y_data(ticker, info: dict) -> tuple[float | None, float | None, float | None]:
    """Returns (one_year_return, price_1y_ago, current_from_history) from 1Y daily history."""
    try:
        h = _with_timeout(lambda: ticker.history(period='1y', interval='1d'), timeout=15)
        if h is not None and not h.empty and len(h) >= 2:
            start = float(h['Close'].iloc[0])
            end   = float(h['Close'].iloc[-1])
            if start > 0 and not math.isnan(start) and not math.isnan(end):
                return round(end / start - 1, 4), round(start, 2), round(end, 2)
    except Exception:
        pass
    # Fallback: use 52WeekChange from info (no price_1y_ago or current available)
    v = _clean(info.get("52WeekChange"))
    return v, None, None


def _fetch_macrotrends_pe(ticker_sym: str) -> list[dict] | None:
    """Fetch quarterly PE history from Macrotrends. US stocks only."""
    try:
        clean = re.sub(r'\.(NS|BO)$', '', ticker_sym, flags=re.IGNORECASE).upper()
        url = (
            f"https://www.macrotrends.net/assets/php/fundamental_iframe.php"
            f"?t={clean}&type=pe-ratio&statement=price-ratios&frequency=Q"
        )
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible)",
            "Referer":    "https://www.macrotrends.net/",
        })
        html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")
        m = re.search(r'var \w+\s*=\s*(\[{.*?}\])', html, re.DOTALL)
        if not m:
            return None
        raw = json.loads(m.group(1))
        cutoff = f"{datetime.now().year - 5}-01-01"
        result = []
        for r in raw:
            if r.get("date", "") < cutoff:
                continue
            pe    = r.get("v3")
            price = r.get("v1")
            eps   = r.get("v2")
            if pe is not None:
                result.append({
                    "date":    r["date"][:7],
                    "pe":      round(float(pe), 2),
                    "price":   round(float(price), 2) if price is not None else None,
                    "ttm_eps": round(float(eps), 2)   if eps   is not None else None,
                })
        return result or None
    except Exception:
        return None


def _get_sec_cik(ticker: str) -> str | None:
    global _cik_map
    try:
        if _cik_map is None:
            req = urllib.request.Request(
                "https://www.sec.gov/files/company_tickers.json",
                headers={"User-Agent": "StockAnalyzer vikashgoyal2701@gmail.com"},
            )
            raw = json.loads(urllib.request.urlopen(req, timeout=12).read())
            _cik_map = {
                v["ticker"].upper(): str(v["cik_str"]).zfill(10)
                for v in raw.values()
            }
        return _cik_map.get(ticker.upper())
    except Exception:
        return None


def _fetch_sec_segments(ticker_sym: str) -> dict | None:
    """Revenue segments from SEC EDGAR XBRL R-files. US stocks only."""
    try:
        clean = re.sub(r"\.(NS|BO)$", "", ticker_sym, flags=re.IGNORECASE).upper()
        cik = _get_sec_cik(clean)
        if not cik:
            print(f"[SEC] no CIK for {clean}")
            return None

        ua = {"User-Agent": "StockAnalyzer vikashgoyal2701@gmail.com"}

        # Latest 10-K accession + period
        subs = json.loads(urllib.request.urlopen(
            urllib.request.Request(f"https://data.sec.gov/submissions/CIK{cik}.json", headers=ua),
            timeout=10,
        ).read())
        recent = subs.get("filings", {}).get("recent", {})
        forms  = recent.get("form", [])
        accns  = recent.get("accessionNumber", [])
        dates  = recent.get("reportDate", [])
        idx    = next((i for i, f in enumerate(forms) if f == "10-K"), None)
        if idx is None:
            print(f"[SEC] no 10-K found for {clean} CIK={cik}")
            return None

        accn_nd = accns[idx].replace("-", "")
        period  = dates[idx][:4] if dates else ""
        base    = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accn_nd}"

        # FilingSummary.xml → find segment R-file by short name keywords
        xml = urllib.request.urlopen(
            urllib.request.Request(f"{base}/FilingSummary.xml", headers=ua),
            timeout=10,
        ).read().decode("utf-8", errors="ignore")

        SEG_KW = [
            "disaggregation",
            "segment information",
            "segment reporting",
            "segment results",
            "segment revenue",
            "revenue by product",
            "revenue by service",
            "revenue by geography",
            "revenue by region",
            "geographic information",
            "product information",
            "revenues by segment",
            "net sales by",
            "information about segments",
            "segments and geographic",
            "geographic areas",
            "revenue from contracts",
            "revenues by type",
            "revenues by product",
        ]
        print(f"[SEC] FilingSummary.xml snippet: {xml[:400]}")
        rfile = None
        all_shorts = []
        for block in re.findall(r"<Report[^>]*>(.*?)</Report>", xml, re.DOTALL | re.IGNORECASE):
            short_m = re.search(r"<ShortName>(.*?)</ShortName>", block, re.IGNORECASE)
            html_m  = re.search(r"<HtmlFileName>(R\d+\.htm)</HtmlFileName>", block, re.IGNORECASE)
            if short_m and html_m:
                all_shorts.append(short_m.group(1))
                if rfile is None and any(k in short_m.group(1).lower() for k in SEG_KW):
                    rfile = html_m.group(1)
        if not rfile:
            print(f"[SEC] no segment R-file for {clean}. All short names: {all_shorts}")
            return None

        print(f"[SEC] {clean}: using rfile={rfile} period={period}")

        # Fetch R-file (pre-rendered XBRL viewer HTML table)
        html = urllib.request.urlopen(
            urllib.request.Request(f"{base}/{rfile}", headers=ua),
            timeout=10,
        ).read().decode("utf-8", errors="ignore")

        # Scale detection
        scale = 1_000_000  # default: millions
        sm = re.search(r"in (thousands|millions|billions)", html, re.IGNORECASE)
        if sm:
            scale = {"thousands": 1_000, "millions": 1_000_000, "billions": 1_000_000_000}.get(
                sm.group(1).lower(), 1_000_000
            )

        SKIP_LABELS = {
            "total", "net revenues", "total revenues", "total net revenues",
            "total net sales", "total revenue", "revenues", "net sales",
            "total net revenue", "total products", "total services",
            "total net sales", "total segments",
        }

        def _parse_items(h: str) -> tuple[list, float]:
            """Parse segment rows from XBRL viewer HTML. Returns (items, total)."""
            items, total_val = [], 0.0
            # XBRL viewer uses class="ro" (odd) / "re" (even) for data rows
            rows = re.findall(r'<tr[^>]*class="r[eo][^"]*"[^>]*>(.*?)</tr>', h, re.DOTALL)
            for row_html in rows:
                lm = re.search(r'<td[^>]*class="pl\b[^"]*"[^>]*>(.*?)</td>', row_html, re.DOTALL)
                if not lm:
                    continue
                label = re.sub(r"<[^>]+>", "", lm.group(1)).replace("\xa0", " ").strip()
                if not label or label.lower() in SKIP_LABELS or label.lower().startswith("total"):
                    continue
                nm = re.search(r'<td[^>]*class="num[^"]*"[^>]*>(.*?)</td>', row_html, re.DOTALL)
                if not nm:
                    continue
                val_s = re.sub(r"<[^>]+>", "", nm.group(1)).replace(",", "").replace("$", "").replace("\xa0", "").strip()
                if val_s.startswith("(") and val_s.endswith(")"):
                    val_s = "-" + val_s[1:-1]
                try:
                    val = float(val_s)
                except ValueError:
                    continue
                if val <= 0:
                    continue
                items.append({"name": label, "raw": val})
                total_val += val
            return items, total_val

        items, total_val = _parse_items(html)

        # Fallback: generic <tr> parsing if XBRL classes not found
        if not items:
            rows_raw = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.DOTALL)
            all_cells = []
            for tr in rows_raw:
                cells = [
                    re.sub(r"<[^>]+>", "", td).replace("\xa0", " ").strip()
                    for td in re.findall(r"<(?:td|th)[^>]*>(.*?)</(?:td|th)>", tr, re.DOTALL)
                ]
                if any(c for c in cells):
                    all_cells.append(cells)
            # Find first row containing a year (header), then parse data rows after it
            header_idx = next(
                (i for i, r in enumerate(all_cells)
                 if any(yr in " ".join(r) for yr in ["2024", "2023", "2022", "Ended", "Months"])),
                0,
            )
            for row in all_cells[header_idx + 1:]:
                if len(row) < 2:
                    continue
                label = row[0]
                if not label or label.lower() in SKIP_LABELS or label.lower().startswith("total"):
                    continue
                val_s = row[1].replace(",", "").replace("$", "").strip()
                try:
                    val = float(val_s)
                except ValueError:
                    continue
                if val <= 0:
                    continue
                items.append({"name": label, "raw": val})
                total_val += val

        if not items or total_val <= 0:
            print(f"[SEC] no items parsed from {rfile} for {clean}. HTML snippet: {html[:500]}")
            return None

        print(f"[SEC] {clean}: parsed {len(items)} segments from {rfile}")

        return {
            "period": f"FY {period}",
            "items": [
                {
                    "name":    s["name"],
                    "value_m": round(s["raw"] * scale / 1_000_000),
                    "pct":     round(s["raw"] / total_val * 100, 1),
                }
                for s in items
            ],
        }
    except Exception as e:
        print(f"[SEC] exception for {ticker_sym}: {type(e).__name__}: {e}")
        return None


def _fetch(yf_symbol: str) -> dict:
    is_indian = yf_symbol.upper().endswith(".NS") or yf_symbol.upper().endswith(".BO")
    currency = "INR" if is_indian else "USD"
    ticker = None
    try:
        ticker = _yf_ticker(yf_symbol)
        info = _with_timeout(lambda: ticker.info, timeout=12) or {}
    except Exception as e:
        print(f"[quickstats] {yf_symbol} info exception: {type(e).__name__}: {e}")
        info = {}

    current = _clean(info.get("currentPrice") or info.get("regularMarketPrice"))
    target  = _clean(info.get("targetMeanPrice"))
    mkt_cap = _clean(info.get("marketCap"))

    rec_key = (info.get("recommendationKey") or "").lower()
    rec_map = {
        "strong_buy":   "Strong Buy",
        "buy":          "Buy",
        "hold":         "Hold",
        "underperform": "Underperform",
        "sell":         "Sell",
    }
    rec_label = rec_map.get(rec_key) or ("Neutral" if rec_key == "none" else (rec_key or None))

    _1y_return, _1y_ago, _hist_cur = _compute_1y_data(ticker, info)

    # Use history-derived price as fallback when yfinance info is empty
    if current is None:
        current = _hist_cur

    upside  = (
        round((target - current) / current * 100, 1)
        if target and current
        else None
    )

    result = {
        "yf_symbol":            yf_symbol,
        "currency":             currency,
        # yfinance trailingPE is unreliable for Indian stocks — Screener overlay handles it below
        "trailing_pe":          None if is_indian else _clean(info.get("trailingPE")),
        "forward_pe":           _clean(info.get("forwardPE")),
        "market_cap":           mkt_cap,
        "market_cap_display":   _fmt_cap(mkt_cap, currency),
        "week_52_high":         _clean(info.get("fiftyTwoWeekHigh")),
        "week_52_low":          _clean(info.get("fiftyTwoWeekLow")),
        "current_price":        current,
        "beta":                 _clean(info.get("beta")),
        "dividend_yield":       _clean(info.get("dividendYield")),
        "target_mean_price":    target,
        "recommendation":       rec_label,
        "num_analyst_opinions": info.get("numberOfAnalystOpinions"),
        "upside_pct":           upside,
        "debt_to_equity":       round(_clean(info.get("debtToEquity")) / 100, 4) if _clean(info.get("debtToEquity")) is not None else None,
        "return_on_equity":     _clean(info.get("returnOnEquity")),
        "return_on_assets":     _clean(info.get("returnOnAssets")),
        "roce":                 None if is_indian else _compute_roce(ticker),
        "profit_margins":       _clean(info.get("profitMargins")),
        "trailing_eps":         _clean(info.get("trailingEps")),
        "revenue_growth":       _clean(info.get("revenueGrowth")),
        "price_to_book":        _clean(info.get("priceToBook")),
        "peg_ratio":            _clean(info.get("pegRatio")),
        "earnings_growth":      _clean(info.get("earningsGrowth")),
        "earnings_growth_3y":   None,
        "revenue_growth_3y":    None,
        "pe_history":           None if is_indian else _fetch_macrotrends_pe(yf_symbol),
        "company_name":         info.get("longName") or info.get("shortName"),
        "sector":               info.get("sector"),
        "industry":             info.get("industry"),
        "one_year_return":      _clean(_1y_return),
        "price_1y_ago":         _clean(_1y_ago),
        "five_year_cagr":       _clean(_compute_5y_cagr(ticker)),
        "partial":              not bool(info) and current is None,
    }

    # US stocks: compute 3Y growth from annual income_stmt
    if not is_indian:
        growth = _compute_growth_3y(ticker)
        result.update(growth)

    # Indian stocks: overlay Screener.in data (PE, P/B, ROCE, ROE, Div Yield, MCap, 52W)
    if is_indian:
        clean = re.sub(r'\.(NS|BO)$', '', yf_symbol, flags=re.IGNORECASE)
        screener = _fetch_screener(clean)
        if screener:
            print(f"[quickstats] Screener OK for {clean}: PE={screener.get('trailing_pe')}")
        else:
            print(f"[quickstats] Screener FAILED for {clean} — will compute PE from price/EPS")
        result.update(screener)
        if screener:  # Screener succeeded — enough data to show the grid
            result["partial"] = False
        # Fallback PE for Indian stocks: price / trailingEps (more reliable than yfinance trailingPE field)
        if result.get("trailing_pe") is None:
            price = result.get("current_price")
            eps = _clean(info.get("trailingEps"))
            if price and eps and eps > 0:
                result["trailing_pe"] = round(price / eps, 1)
                print(f"[quickstats] Computed PE for {clean}: {result['trailing_pe']}x (price={price}, eps={eps})")
        # Recompute upside_pct against Screener's current price
        if screener.get("current_price") and result.get("target_mean_price"):
            cp = screener["current_price"]
            tp = result["target_mean_price"]
            result["upside_pct"] = round((tp - cp) / cp * 100, 1)

    # Compute PEG if not provided by source (common for Indian stocks)
    if result.get("peg_ratio") is None:
        pe  = result.get("trailing_pe")
        grw = result.get("earnings_growth")
        if pe and grw and grw > 0:
            result["peg_ratio"] = round(pe / (grw * 100), 2)

    return result


@router.get("/api/quickstats")
async def get_quickstats(
    yf_symbol:     str  = Query(...),
    force_refresh: bool = Query(False),
):
    try:
        key = yf_symbol.upper()
        now = time.monotonic()

        # In-memory burst cache (30 min)
        if not force_refresh and key in _mem:
            cached_data, ts = _mem[key]
            if now - ts < _MEM_TTL:
                return JSONResponse(content=cached_data)

        # Disk cache — per-symbol key for O(1) lookup
        disk = None
        try:
            disk = Cache()
            if not force_refresh:
                entry = disk.get(f"qs:{key}")
                if entry and (time.time() - entry.get("ts", 0)) < _DISK_TTL:
                    result = entry["data"]
                    _mem[key] = (result, now)
                    return JSONResponse(content=result)
        except Exception as e:
            print(f"[quickstats] disk cache read error for {yf_symbol}: {e}")
            disk = None

        # Fetch fresh — run in thread so multiple requests execute in parallel
        result = await asyncio.to_thread(_fetch, yf_symbol)

        # Persist to disk/memory cache only when we have real data
        if not result.get("partial"):
            try:
                if disk is not None:
                    disk.set(f"qs:{key}", {"data": result, "ts": time.time()})
            except Exception as e:
                print(f"[quickstats] disk cache write error for {yf_symbol}: {e}")
            _mem[key] = (result, now)
        return JSONResponse(content=result)

    except Exception as exc:
        print(f"[quickstats] unhandled error for {yf_symbol}: {type(exc).__name__}: {exc}")
        return JSONResponse(content={"yf_symbol": yf_symbol, "partial": True})
