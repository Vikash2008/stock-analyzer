"""
GET /api/search?q=reliance
Proxies Yahoo Finance symbol search. Returns EQUITY and ETF results only.
"""
import json
import urllib.request
import urllib.parse

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/api/search")
def search_symbol(q: str = Query(..., min_length=1)):
    try:
        encoded = urllib.parse.quote(q.strip())
        url = (
            f"https://query2.finance.yahoo.com/v1/finance/search"
            f"?q={encoded}&quotesCount=8&newsCount=0&enableFuzzyQuery=false"
        )
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible)",
            "Accept":     "application/json",
        })
        data = json.loads(urllib.request.urlopen(req, timeout=8).read())
        results = []
        for item in data.get("quotes", []):
            if item.get("quoteType") not in ("EQUITY", "ETF"):
                continue
            symbol   = item.get("symbol", "")
            name     = item.get("shortname") or item.get("longname") or symbol
            exchange = item.get("exchDisp", "")
            results.append({"symbol": symbol, "name": name, "exchange": exchange})
            if len(results) == 6:
                break
        return JSONResponse(results)
    except Exception as exc:
        print(f"[search] error for q={q!r}: {exc}")
        return JSONResponse([])
