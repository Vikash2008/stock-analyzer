"""
FastAPI entry point.

Dev:  uvicorn backend.main:app --reload --port 8000
Prod: started via entrypoint.sh on Fly.io (port 8080)

Env vars:
  ALLOWED_ORIGIN — set to your Vercel frontend URL on Fly.io
                   e.g. https://your-app.vercel.app
"""

import os

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers.portfolio   import router as portfolio_router
from backend.routers.history     import router as history_router
from backend.routers.quickstats  import router as quickstats_router
from backend.routers.filing      import router as filing_router
from backend.routers.gemini      import router as gemini_router
from backend.routers.search      import router as search_router
from backend.routers.dividends   import router as dividends_router
from backend.routers.add_txn           import router as add_txn_router
from backend.routers.portfolio_history import router as portfolio_history_router

_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://stock-analyzer-blush.vercel.app",
]
_prod = os.environ.get("ALLOWED_ORIGIN", "").strip()
if _prod and _prod not in _ORIGINS:
    _ORIGINS.append(_prod)

app = FastAPI(title="Stock Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(portfolio_router)
app.include_router(history_router)
app.include_router(quickstats_router)
app.include_router(filing_router)
app.include_router(gemini_router)
app.include_router(search_router)
app.include_router(dividends_router)
app.include_router(add_txn_router)
app.include_router(portfolio_history_router)

@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}
