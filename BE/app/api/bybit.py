"""Connectivity checks for configured exchange services."""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/bybit", tags=["Bybit"])


def test_bybit_connection() -> dict:
    """Test configured Bybit demo credentials without exposing secrets."""
    api_key = os.getenv("BYBIT_DEMO_API_KEY")
    api_secret = os.getenv("BYBIT_DEMO_API_SECRET")
    if not api_key or not api_secret:
        return {
            "status": "not_configured",
            "message": "Bybit demo API credentials are not configured",
            "demo": True,
        }
    try:
        from pybit.unified_trading import HTTP

        session = HTTP(api_key=api_key, api_secret=api_secret, demo=True)
        response = session.get_wallet_balance(accountType="UNIFIED")
        if response.get("retCode") != 0:
            raise RuntimeError(response.get("retMsg") or "Bybit returned an error")
        return {"status": "ok", "message": "Bybit API connection successful", "demo": True}
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "message": str(exc), "demo": True}


@router.get("/test")
def bybit_test() -> dict:
    result = test_bybit_connection()
    if result["status"] == "error":
        raise HTTPException(status_code=502, detail=result["message"])
    return result
