"""Read ticker and price data for a trading bot from Bybit."""
from __future__ import annotations


def get_last_price(session, *, category: str, symbol: str) -> float:
    response = session.get_tickers(category=category, symbol=symbol)
    items = response.get("result", {}).get("list", [])
    if not items:
        raise ValueError(f"Ticker not found for {symbol}")

    last_price = items[0].get("lastPrice") or items[0].get("markPrice")
    if last_price is None:
        raise ValueError(f"Ticker price missing for {symbol}")
    return float(last_price)
