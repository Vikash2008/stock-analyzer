"""
Shared classification logic for Indian vs US segmentation.

US MF symbols  : NASDAQ 100 and S&P 500 funds (BSE-listed but US-index tracking)
US ETF symbols : MON100.NS and MAFANG.NS (NSE-listed US-index ETFs)
USD portfolios : Vested, IndMoney US, IndMoney Mummy (native USD holdings)
"""

USD_PORTS  = {"Vested", "IndMoney US", "IndMoney Mummy"}
SKIP_PORTS = {"Equity", "MF_Portfolio"}

# BSE mutual funds tracking US indices
US_MF_SYMS  = {"0P0001NCLP.BO", "0P0001JMZB.BO"}

# NSE ETFs tracking US indices held inside Indian stock portfolios
US_ETF_SYMS = {"MON100.NS", "MAFANG.NS"}


def segment(portfolio: str, yf_symbol: str) -> str:
    """
    Returns one of: 'indian_mf', 'us_mf', 'indian_stock', 'us_stock', 'skip'
    """
    if portfolio in SKIP_PORTS:
        return "skip"
    if portfolio.startswith("MF_"):
        return "us_mf" if yf_symbol in US_MF_SYMS else "indian_mf"
    if portfolio in USD_PORTS or yf_symbol in US_ETF_SYMS:
        return "us_stock"
    return "indian_stock"
