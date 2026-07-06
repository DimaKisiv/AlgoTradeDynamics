"""Bybit API test endpoints."""
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.bot_engine.bybit.bybit import test_bybit_connection

router = APIRouter(prefix="/bybit", tags=["Bybit"])


@router.get("/test")
def test_bybit_api():
    result = test_bybit_connection()
    status_code = status.HTTP_200_OK if result["status"] == "ok" else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(content=result, status_code=status_code)


@router.get("/demo/btc-long")
def test_bybit_demo_btc_long_order():
    from app.bot_engine.bybit.bybit import test_bybit_demo_btc_long_order
    result = test_bybit_demo_btc_long_order()
    status_code = status.HTTP_200_OK if result["status"] == "ok" else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(content=result, status_code=status_code)
