"""Read current positions for a trading bot from Bybit."""
from __future__ import annotations


def get_open_positions(session, *, category: str, symbol: str) -> list[dict]:
    response = session.get_positions(category=category, symbol=symbol)
    items = response.get("result", {}).get("list", [])
    positions: list[dict] = []
    for item in items:
        size = item.get("size") or item.get("qty") or "0"
        try:
            if float(size) == 0:
                continue
        except (TypeError, ValueError):
            continue
        positions.append(item)
    return positions
