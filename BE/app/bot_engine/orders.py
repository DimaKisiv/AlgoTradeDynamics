"""Place, cancel, and query Bybit orders for trading bots."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN


FINAL_ORDER_STATUSES = {"Filled", "Cancelled", "Rejected", "Deactivated"}
ACTIVE_ORDER_STATUSES = {"New", "Created",
                         "PartiallyFilled", "PendingNew", "Untriggered"}


@dataclass(slots=True)
class OrderRequest:
    side: str
    order_type: str
    order_role: str
    order_link_id: str
    qty: float
    price: float | None
    parent_order_id: int | None = None
    reduce_only: bool = False


@dataclass(slots=True)
class InstrumentRules:
    min_order_qty: float
    qty_step: float
    tick_size: float
    min_notional_value: float


def get_open_orders(session, *, category: str, symbol: str) -> list[dict]:
    response = session.get_open_orders(
        category=category, symbol=symbol, openOnly=0)
    return response.get("result", {}).get("list", [])


def get_orders_by_prefix(session, *, category: str, symbol: str, order_link_prefix: str) -> list[dict]:
    open_orders = get_open_orders(session, category=category, symbol=symbol)
    matched_open = [
        item for item in open_orders if (item.get("orderLinkId") or "").startswith(order_link_prefix)
    ]
    history = session.get_order_history(
        category=category, symbol=symbol, limit=50)
    history_items = history.get("result", {}).get("list", [])
    matched_history = [
        item for item in history_items if (item.get("orderLinkId") or "").startswith(order_link_prefix)
    ]
    return matched_open + matched_history


def get_instrument_rules(session, *, category: str, symbol: str) -> InstrumentRules:
    response = session.get_instruments_info(category=category, symbol=symbol)
    items = response.get("result", {}).get("list", [])
    if not items:
        raise ValueError(f"Instrument info not found for {symbol}")

    info = items[0]
    lot_size_filter = info.get("lotSizeFilter", {})
    price_filter = info.get("priceFilter", {})
    return InstrumentRules(
        min_order_qty=float(lot_size_filter.get("minOrderQty") or 0),
        qty_step=float(lot_size_filter.get("qtyStep") or 0.000001),
        tick_size=float(price_filter.get("tickSize") or 0.000001),
        min_notional_value=float(lot_size_filter.get("minNotionalValue") or 0),
    )


def round_to_step(value: float, step: float) -> float:
    if step <= 0:
        return value

    # Values such as 100 * 1.015 can arrive as 101.49999999999999.
    # Add only a sub-nanostep tolerance before flooring so an exact tick is
    # not incorrectly moved one full step lower by binary floating-point noise.
    step_decimal = Decimal(str(step))
    value_decimal = Decimal(str(value))
    tolerance = step_decimal * Decimal("1e-9")
    quantized = (value_decimal + tolerance) / step_decimal
    rounded = quantized.quantize(Decimal("1"), rounding=ROUND_DOWN) * step_decimal
    return float(rounded)


def normalize_order_request(order: OrderRequest, rules: InstrumentRules) -> OrderRequest:
    qty = round_to_step(order.qty, rules.qty_step)
    price = round_to_step(
        order.price, rules.tick_size) if order.price is not None else None
    return OrderRequest(
        side=order.side,
        order_type=order.order_type,
        order_role=order.order_role,
        order_link_id=order.order_link_id,
        qty=qty,
        price=price,
        parent_order_id=order.parent_order_id,
        reduce_only=order.reduce_only,
    )


def _requires_reduce_only(order: OrderRequest) -> bool:
    return (
        order.order_role in {"position_take_profit", "position_close", "take_profit_recovered"}
        or order.order_role.startswith((
            "take_profit_", "tp_", "scalper_take_profit", "scalper_stop_loss",
            "scalper_timeout", "scalper_manual_close",
        ))
    )


def validate_order_request(order: OrderRequest, rules: InstrumentRules) -> str | None:
    if _requires_reduce_only(order):
        long_close = (
            order.order_role in {"position_take_profit", "position_close", "take_profit_recovered"}
            or order.order_role.startswith(("take_profit_", "tp_"))
        )
        if long_close and order.side != "Sell":
            return "Long position close orders must use Sell side"
        if not order.reduce_only:
            return "Position close orders must be reduce-only"
    if order.qty < rules.min_order_qty:
        return f"Order qty {order.qty} is below Bybit minimum {rules.min_order_qty}"
    if order.price is not None and rules.min_notional_value > 0 and (order.qty * order.price) < rules.min_notional_value:
        return (
            f"Order notional {order.qty * order.price:.8f} is below Bybit minimum "
            f"{rules.min_notional_value}"
        )
    return None


def place_order(session, *, category: str, symbol: str, order: OrderRequest) -> dict:
    if _requires_reduce_only(order) and not order.reduce_only:
        raise ValueError(
            "Position close orders must be reduce-only before placing")
    payload = {
        "category": category,
        "symbol": symbol,
        "side": order.side,
        "orderType": order.order_type,
        "qty": str(order.qty),
        "orderLinkId": order.order_link_id,
    }
    if order.price is not None:
        payload["price"] = str(order.price)
    if order.reduce_only:
        payload["reduceOnly"] = True
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


def get_order_status_by_link_id(
    session, *, category: str, symbol: str, order_link_id: str
) -> dict:
    """Return the exact exchange order matching an orderLinkId, if it still exists.

    This targeted lookup is used during reconciliation when an active local order is
    absent from the regular open/history page. It avoids treating pagination as an
    exchange reset.
    """
    response = session.get_open_orders(
        category=category,
        symbol=symbol,
        orderLinkId=order_link_id,
        openOnly=0,
    )
    items = response.get("result", {}).get("list", [])
    if items:
        return items[0]

    history = session.get_order_history(
        category=category,
        symbol=symbol,
        orderLinkId=order_link_id,
        limit=1,
    )
    history_items = history.get("result", {}).get("list", [])
    if history_items:
        return history_items[0]
    return {}


def cancel_order_by_link_id(session, *, category: str, symbol: str, order_link_id: str) -> dict:
    return session.cancel_order(category=category, symbol=symbol, orderLinkId=order_link_id)
