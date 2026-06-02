"""
GET /api/filing/{symbol}

Downloads the latest quarterly investor presentation or financial results PDF
from BSE for any Indian stock, caches in memory (2h TTL), and serves it at a
stable public URL so Perplexity can read it.

Public URL pattern:  https://stock-analyzer-2nqw.onrender.com/api/filing/AXISBANK
"""

from __future__ import annotations

import io
import json
import time
import urllib.request
from datetime import datetime, timedelta

import pdfplumber
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter()

# BSE scrip codes for common Indian stocks
_SCRIP_MAP: dict[str, str] = {
    "AXISBANK":    "532215",
    "HDFCBANK":    "500180",
    "ICICIBANK":   "532174",
    "INFY":        "500209",
    "TCS":         "532540",
    "RELIANCE":    "500325",
    "SBIN":        "500112",
    "KOTAKBANK":   "500247",
    "BHARTIARTL":  "532454",
    "HINDUNILVR":  "500696",
    "WIPRO":       "507685",
    "HCLTECH":     "532281",
    "APOLLOHOSP":  "508869",
    "TATAMOTORS":  "500570",
    "MARUTI":      "532500",
    "BAJFINANCE":  "500034",
    "TITAN":       "500114",
    "ASIANPAINT":  "500820",
    "ITC":         "500875",
    "NESTLEIND":   "500790",
    "LTIM":        "540005",
    "PERSISTENT":  "533179",
    "MPHASIS":     "526299",
    "COFORGE":     "532819",
    "ZOMATO":      "543320",
    "AFFLE":       "542752",
    "RATEGAIN":    "543417",
    "NETWEB":      "544060",
    "DYNACONS":    "532760",
    "ETERNAL":     "543519",
    "SWIGGY":      "544902",
    "DMART":       "540376",
    "BAJAJFINSV":  "532978",
    "SUNPHARMA":   "524715",
    "DRREDDY":     "500124",
    "CIPLA":       "500087",
    "DIVISLAB":    "532488",
    "ADANIENT":    "512599",
    "ADANIPORTS":  "532921",
    "ULTRACEMCO":  "532538",
    "GRASIM":      "500300",
    "POWERGRID":   "532898",
    "NTPC":        "532555",
    "ONGC":        "500312",
    "COALINDIA":   "533278",
    "HINDALCO":    "500440",
    "JSWSTEEL":    "500228",
    "TATASTEEL":   "500470",
    "TECHM":       "532755",
    "INDHOTEL":    "500850",
    "TATACONSUM":  "500800",
    "BAJAJ-AUTO":  "532977",
    "HEROMOTOCO":  "500182",
    "M&M":         "500520",
    "EICHERMOT":   "505200",
}

_cache: dict[str, dict] = {}  # symbol → {bytes, filename, period, filing_type, ts}
_CACHE_TTL = 7200  # 2 hours

_BSE_HDR = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer":    "https://www.bseindia.com/",
    "Accept":     "application/json, text/plain, */*",
}


def _get_scrip_code(symbol: str) -> str | None:
    sym = symbol.upper()
    if sym in _SCRIP_MAP:
        return _SCRIP_MAP[sym]
    # Dynamic BSE lookup fallback
    try:
        url = (
            f"https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w"
            f"?Debtflag=&scripcode=&Scode={sym}&Stype=EQ"
        )
        data = json.loads(urllib.request.urlopen(
            urllib.request.Request(url, headers=_BSE_HDR), timeout=8
        ).read())
        code = str(data.get("Scripcode") or data.get("scripcode") or "").strip()
        if code and code != "0":
            _SCRIP_MAP[sym] = code
            return code
    except Exception:
        pass
    return None


def _bse_rows(scrip_code: str) -> list:
    today = datetime.now()
    start = (today - timedelta(days=180)).strftime("%Y%m%d")
    end   = today.strftime("%Y%m%d")
    url = (
        f"https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w"
        f"?strCat=-1&strPrevDate={start}&strScrip={scrip_code}"
        f"&strSearch=P&strToDate={end}&strType=C&subcategory=-1"
    )
    data = json.loads(urllib.request.urlopen(
        urllib.request.Request(url, headers=_BSE_HDR), timeout=12
    ).read())
    return data.get("Table", [])


def _pick_target(rows: list, prefer_text: bool = False) -> dict | None:
    """Select the best filing row. prefer_text=True picks smaller Financial Results over large PPT."""
    if prefer_text:
        priority = [
            lambda r: r.get("CATEGORYNAME") == "Result",
            lambda r: "financial results" in (r.get("HEADLINE") or "").lower(),
            lambda r: r.get("SUBCATNAME") == "Investor Presentation",
        ]
    else:
        priority = [
            lambda r: r.get("SUBCATNAME") == "Investor Presentation",
            lambda r: r.get("CATEGORYNAME") == "Result",
            lambda r: "financial results" in (r.get("HEADLINE") or "").lower(),
        ]
    for check in priority:
        for r in rows:
            if check(r) and r.get("ATTACHMENTNAME"):
                return r
    return None


def _download_pdf(attachment: str, max_bytes: int = 15_000_000) -> bytes:
    """Download PDF from BSE, cap at max_bytes to avoid slow large files."""
    pdf_url = f"https://www.bseindia.com/xml-data/corpfiling/AttachHis/{attachment}"
    resp = urllib.request.urlopen(
        urllib.request.Request(pdf_url, headers=_BSE_HDR), timeout=20
    )
    return resp.read(max_bytes)


def _fetch_from_bse(scrip_code: str, prefer_text: bool = False) -> dict | None:
    rows   = _bse_rows(scrip_code)
    target = _pick_target(rows, prefer_text=prefer_text)
    if not target:
        return None

    pdf_bytes = _download_pdf(target["ATTACHMENTNAME"])

    # Extract plain text (first 30 pages to keep it fast)
    text = ""
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = "\n".join(
                page.extract_text() or "" for page in pdf.pages[:30]
            ).strip()
    except Exception:
        pass

    return {
        "bytes":       pdf_bytes,
        "text":        text,
        "filename":    target["ATTACHMENTNAME"],
        "period":      (target.get("DT_TM") or "")[:10],
        "filing_type": target.get("SUBCATNAME", "Financial Results"),
    }


@router.get("/api/filing/{symbol}/text")
def serve_filing_text(symbol: str):
    sym = symbol.upper().replace(".NS", "").replace(".BO", "")

    cached = _cache.get(sym)
    if not cached or time.time() - cached["ts"] >= _CACHE_TTL:
        scrip = _get_scrip_code(sym)
        if not scrip:
            raise HTTPException(status_code=404, detail=f"BSE scrip code not found for {sym}")
        result = _fetch_from_bse(scrip, prefer_text=True)
        if not result:
            raise HTTPException(status_code=404, detail=f"No quarterly filing found for {sym}")
        _cache[sym] = {**result, "ts": time.time()}
        cached = _cache[sym]

    text = cached.get("text") or ""
    if not text:
        raise HTTPException(status_code=404, detail="PDF text extraction failed")

    return Response(
        content=text,
        media_type="text/plain",
        headers={"X-Filing-Period": cached["period"], "X-Filing-Type": cached["filing_type"]},
    )


@router.get("/api/filing/{symbol}")
def serve_filing(symbol: str):
    sym = symbol.upper().replace(".NS", "").replace(".BO", "")

    cached = _cache.get(sym)
    if cached and time.time() - cached["ts"] < _CACHE_TTL:
        return Response(
            content=cached["bytes"],
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{sym}_results.pdf"',
                "X-Filing-Period":     cached["period"],
                "X-Filing-Type":       cached["filing_type"],
            },
        )

    scrip = _get_scrip_code(sym)
    if not scrip:
        raise HTTPException(status_code=404, detail=f"BSE scrip code not found for {sym}")

    result = _fetch_from_bse(scrip)
    if not result:
        raise HTTPException(status_code=404, detail=f"No quarterly filing found for {sym}")

    _cache[sym] = {**result, "ts": time.time()}
    return Response(
        content=result["bytes"],
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{sym}_results.pdf"',
            "X-Filing-Period":     result["period"],
            "X-Filing-Type":       result["filing_type"],
        },
    )
