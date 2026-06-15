"""
Converts PortfolioBundle → JSON-safe dict.

Handles three problem types that standard json.dumps() cannot encode:
  - float NaN / numpy NaN  → None  (JSON null)
  - numpy int64 / float64  → Python int / float
  - pd.Timestamp           → ISO-8601 string
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

from src.engine import PortfolioBundle


def _clean(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, np.floating):
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    return v


def _df_to_records(df: pd.DataFrame) -> list[dict]:
    return [{k: _clean(v) for k, v in row.items()} for row in df.to_dict(orient="records")]


def serialize_bundle(bundle: PortfolioBundle) -> dict:
    return {
        "currency":            bundle.currency,
        "usd_inr":             _clean(bundle.usd_inr),
        "total_invested":      _clean(bundle.total_invested),
        "total_current":       _clean(bundle.total_current),
        "total_gain":          _clean(bundle.total_gain),
        "return_pct":          _clean(bundle.return_pct),
        "as_of":               bundle.as_of.isoformat(),
        "all_portfolios":      bundle.all_portfolios,
        "selected_portfolios": bundle.selected_portfolios,
        "cache_status":        bundle.cache_status,
        "xirr_total":          _clean(bundle.xirr_total),
        "xirr_stk":            _clean(bundle.xirr_stk),
        "xirr_mf":             _clean(bundle.xirr_mf),
        "xirr_by_portfolio":   {k: _clean(v) for k, v in (bundle.xirr_by_portfolio or {}).items()},
        "holdings":            _df_to_records(bundle.holdings),
        "transactions":        _df_to_records(bundle.transactions),
        "realized":            _df_to_records(bundle.realized),
        "fx_lots":             [{k: _clean(v) for k, v in lot.items()} for lot in (bundle.fx_lots or [])],
    }
