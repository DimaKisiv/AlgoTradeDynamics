"""Pure grid strategy helpers for one-shot bot cycles."""
from __future__ import annotations

from app.bot_engine.orders import OrderRequest
from app.models.trading_bot import TradingBot


def decide_grid_action(bot: TradingBot, *, current_price: float, has_positions: bool, has_open_orders: bool) -> dict:
    if has_positions or has_open_orders:
        return {
            "action": "NOOP",
            "orders": [],
            "message": "Open positions or orders already exist for this bot",
        }

    orders: list[OrderRequest] = []
    for index in range(bot.grid_orders_count):
        step_multiplier = 1 - ((bot.grid_step_percent / 100) * index)
        price = round(current_price * step_multiplier, 6)
        orders.append(
            OrderRequest(
                side="Buy",
                order_type="Limit",
                order_role=f"grid_entry_{index + 1}",
                qty=bot.order_qty,
                price=price,
            )
        )

    return {
        "action": "CREATE_GRID",
        "orders": orders,
        "message": f"Prepared {len(orders)} grid orders",
    }
