"""Place, cancel, and query Bybit orders for trading bots."""
from __future__ import annotations

from dataclasses import dataclass


FINAL_ORDER_STATUSES = {"Filled", "Cancelled", "Rejected", "Deactivated"}


@dataclass(slots=True)
class OrderRequest:
    side: str
    order_type: str
    order_role: str
    qty: float
    price: float | None


def get_open_orders(session, *, category: str, symbol: str) -> list[dict]:
    response = session.get_open_orders(
        category=category, symbol=symbol, openOnly=0)
    return response.get("result", {}).get("list", [])


def place_order(session, *, category: str, symbol: str, order: OrderRequest) -> dict:
    payload = {
        "category": category,
        "symbol": symbol,
        "side": order.side,
        "orderType": order.order_type,
        "qty": str(order.qty),
    }
    if order.price is not None:
        payload["price"] = str(order.price)
    return session.place_order(**payload)


def cancel_order(session, *, category: str, symbol: str, order_id: str) -> dict:
    return session.cancel_order(category=category, symbol=symbol, orderId=order_id)


def get_order_status(session, *, category: str, symbol: str, order_id: str) -> dict:
    response = session.get_open_orders(
        category=category,
        symbol=symbol,
        orderId=order_id,
        openOnly=0,
    )
    items = response.get("result", {}).get("list", [])
    if items:
        return items[0]

    history = session.get_order_history(
        category=category, symbol=symbol, orderId=order_id)
    history_items = history.get("result", {}).get("list", [])
    if history_items:
        return history_items[0]
    return {}
