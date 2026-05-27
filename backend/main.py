"""
FastAPI entry point.

Dev:  uvicorn backend.main:app --reload --port 8000
Prod: started via entrypoint.sh on Fly.io (port 8080)

Env vars:
  ALLOWED_ORIGIN — set to your Vercel frontend URL on Fly.io
                   e.g. https://your-app.vercel.app
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers.portfolio import router as portfolio_router
from backend.routers.history   import router as history_router

_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
]
_prod = os.environ.get("ALLOWED_ORIGIN", "").strip()
if _prod:
    _ORIGINS.append(_prod)

app = FastAPI(title="Stock Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(portfolio_router)
app.include_router(history_router)

@app.get("/health")
def health():
    return {"status": "ok"}
