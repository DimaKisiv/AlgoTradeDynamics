"""Helpers for testing the Bybit demo API connection."""
import os
import time

from dotenv import load_dotenv
from pybit.unified_trading import HTTP

load_dotenv()


def _get_bybit_demo_session() -> HTTP | None:
    api_key = os.getenv("BYBIT_DEMO_API_KEY")
    api_secret = os.getenv("BYBIT_DEMO_API_SECRET")

    if not api_key or not api_secret:
        return None

    return HTTP(
        demo=True,
        api_key=api_key,
        api_secret=api_secret,
    )


def test_bybit_connection() -> dict:
    session = _get_bybit_demo_session()

    if session is None:
        return {
            "status": "error",
            "message": "Bybit demo API credentials are not configured",
            "demo": True,
        }

    try:
        balance = session.get_wallet_balance(accountType="UNIFIED")
    except Exception as exc:
        return {
            "status": "error",
            "message": str(exc),
            "demo": True,
        }

    return {
        "status": "ok",
        "message": "Bybit API connection successful",
        "demo": True,
        "result": balance,
    }


def test_bybit_demo_btc_long_order() -> dict:
    """
    Opens BTCUSDT long on Bybit Demo, checks order status,
    closes the position, then returns order history.
    """

    session = _get_bybit_demo_session()

    if session is None:
        return {
            "status": "error",
            "message": "Bybit demo API credentials are not configured",
            "demo": True,
        }

    category = "linear"
    symbol = "BTCUSDT"
    qty = "0.001"

    try:
        # 1. Open long: Market BUY
        open_order = session.place_order(
            category=category,
            symbol=symbol,
            side="Buy",
            orderType="Market",
            qty=qty,
        )

        open_order_id = open_order["result"]["orderId"]

        time.sleep(2)

        # 2. Get status of opened order
        open_order_status = session.get_open_orders(
            category=category,
            symbol=symbol,
            orderId=open_order_id,
            openOnly=1,
        )

        # 3. Close long: Market SELL with reduceOnly
        close_order = session.place_order(
            category=category,
            symbol=symbol,
            side="Sell",
            orderType="Market",
            qty=qty,
            reduceOnly=True,
        )

        close_order_id = close_order["result"]["orderId"]

        time.sleep(2)

        # 4. Get status of close order
        close_order_status = session.get_open_orders(
            category=category,
            symbol=symbol,
            orderId=close_order_id,
            openOnly=1,
        )

        # 5. Get order history
        order_history = session.get_order_history(
            category=category,
            symbol=symbol,
            limit=10,
        )

        return {
            "status": "ok",
            "message": "BTCUSDT demo long order opened and closed successfully",
            "demo": True,
            "symbol": symbol,
            "qty": qty,
            "open_order": open_order,
            "open_order_status": open_order_status,
            "close_order": close_order,
            "close_order_status": close_order_status,
            "order_history": order_history,
        }

    except Exception as exc:
        return {
            "status": "error",
            "message": str(exc),
            "demo": True,
            "symbol": symbol,
            "qty": qty,
        }
