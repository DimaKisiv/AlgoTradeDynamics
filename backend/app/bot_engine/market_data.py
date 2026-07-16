"""Read ticker and price data for a trading bot from Bybit."""
from __future__ import annotations

from app.bot_engine.orders import InstrumentRules, get_instrument_rules as load_instrument_rules


def get_ticker_snapshot(session, *, category: str, symbol: str) -> dict:
    response = session.get_tickers(category=category, symbol=symbol)
    items = response.get("result", {}).get("list", [])
    if not items:
        raise ValueError(f"Ticker not found for {symbol}")
    return items[0]


def get_last_price(session, *, category: str, symbol: str) -> float:
    ticker = get_ticker_snapshot(session, category=category, symbol=symbol)
    last_price = ticker.get("lastPrice") or ticker.get("markPrice")
    if last_price is None:
        raise ValueError(f"Ticker price missing for {symbol}")
    return float(last_price)


def get_instrument_rules(session, *, category: str, symbol: str) -> InstrumentRules:
    return load_instrument_rules(session, category=category, symbol=symbol)
