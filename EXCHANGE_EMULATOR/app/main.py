from __future__ import annotations

import csv
import io
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, inspect, or_, select, text
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.engine import (
    ACTIVE_STATUSES,
    account_snapshot,
    cancel_order,
    create_order,
    ensure_seed_data,
    format_number,
    get_account_by_api_key,
    get_or_create_market,
    get_or_create_position,
    log_event,
    make_api_key,
    make_api_secret,
    position_payload,
    effective_market,
    replay_one_candle,
    reset_account,
    runtime_worker,
    scenario_step_once,
    serialize_order,
    set_market_price,
    set_account_market_price,
    start_manual_move,
    start_replay,
    start_scenario,
)
from app.models import Account, Candle, Event, Execution, Market, Order, Position, Scenario


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    initial_balance: float = Field(default=10000.0, gt=0)
    maker_fee_rate: float = Field(default=0.0002, ge=0, le=0.1)
    taker_fee_rate: float = Field(default=0.00055, ge=0, le=0.1)
    slippage_percent: float = Field(default=0.0, ge=0, le=10)


class AccountFund(BaseModel):
    amount: float


class AccountReset(BaseModel):
    balance: float | None = Field(default=None, gt=0)


class PriceUpdate(BaseModel):
    price: float = Field(gt=0)
    mark_price: float | None = Field(default=None, gt=0)
    simulation_time: int | None = None
    account_id: int | None = None


class PriceMove(BaseModel):
    target_price: float = Field(gt=0)
    duration_seconds: float = Field(default=0, ge=0, le=86400)


class ScenarioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    symbol: str = Field(min_length=2, max_length=30)
    steps: list[dict[str, float]] = Field(min_length=1)


class HistoricalDownload(BaseModel):
    symbol: str = Field(min_length=2, max_length=30)
    category: str = "linear"
    interval: str = "1"
    start_time: int
    end_time: int


class ReplayStart(BaseModel):
    interval: str = "1"
    start_time: int
    end_time: int
    speed: float = Field(default=10, gt=0, le=10000)
    path_mode: str = Field(default="ohlc", pattern="^(ohlc|olhc|close)$")


class LeverageUpdate(BaseModel):
    leverage: float = Field(gt=0, le=100)


def bybit_ok(result: dict | list | None = None) -> dict:
    return {
        "retCode": 0,
        "retMsg": "OK",
        "result": result if result is not None else {},
        "retExtInfo": {},
        "time": int(datetime.now(timezone.utc).timestamp() * 1000),
    }


def bybit_error(code: int, message: str, result: dict | None = None) -> dict:
    return {
        "retCode": code,
        "retMsg": message,
        "result": result or {},
        "retExtInfo": {},
        "time": int(datetime.now(timezone.utc).timestamp() * 1000),
    }


def serialize_account(db: Session, account: Account, *, include_secret: bool = False) -> dict:
    snapshot = account_snapshot(db, account)
    data = {
        "id": account.id,
        "name": account.name,
        "api_key": account.api_key,
        "initial_balance": account.initial_balance,
        "balance": snapshot["balance"],
        "equity": snapshot["equity"],
        "available_balance": snapshot["available_balance"],
        "unrealized_pnl": snapshot["unrealized_pnl"],
        "margin_used": snapshot["margin_used"],
        "reserved_order_margin": snapshot["reserved_order_margin"],
        "maker_fee_rate": account.maker_fee_rate,
        "taker_fee_rate": account.taker_fee_rate,
        "slippage_percent": account.slippage_percent,
        "created_at": account.created_at,
    }
    if include_secret:
        data["api_secret"] = account.api_secret
    return data




def seed_bundled_history(db: Session) -> None:
    seed_dir = os.getenv("EMULATOR_SEED_DATA_DIR")
    if not seed_dir:
        return
    mappings = {
        "btc_usdt_2024.csv": "BTCUSDT",
        "eth_usdt_2024.csv": "ETHUSDT",
    }
    for filename, symbol in mappings.items():
        path = os.path.join(seed_dir, filename)
        if not os.path.exists(path):
            continue
        existing = db.scalar(
            select(func.count(Candle.id)).where(
                Candle.symbol == symbol,
                Candle.interval == "D",
            )
        ) or 0
        if existing:
            continue
        with open(path, "r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                parsed = datetime.fromisoformat(row["date"]).replace(tzinfo=timezone.utc)
                db.add(
                    Candle(
                        exchange="bundled",
                        category="linear",
                        symbol=symbol,
                        interval="D",
                        open_time=int(parsed.timestamp() * 1000),
                        open=float(row["open"]),
                        high=float(row["high"]),
                        low=float(row["low"]),
                        close=float(row["close"]),
                        volume=float(row.get("volume") or 0),
                        turnover=0.0,
                    )
                )
        db.commit()

def require_account(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> Account:
    account = get_account_by_api_key(db, x_api_key)
    if account is None:
        raise HTTPException(status_code=401, detail="Invalid emulator API key")
    return account


def ensure_schema_compatibility() -> None:
    # create_all does not add columns to an existing SQLite volume.
    with engine.begin() as connection:
        existing = {column["name"] for column in inspect(connection).get_columns("accounts")} if inspect(connection).has_table("accounts") else set()
        additions = {
            "maker_fee_rate": "FLOAT NOT NULL DEFAULT 0.0002",
            "taker_fee_rate": "FLOAT NOT NULL DEFAULT 0.00055",
            "slippage_percent": "FLOAT NOT NULL DEFAULT 0",
        }
        for name, ddl in additions.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE accounts ADD COLUMN {name} {ddl}"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()
    with Session(bind=engine) as db:
        ensure_seed_data(db)
        seed_bundled_history(db)
    runtime_worker.start()
    yield
    runtime_worker.stop()


app = FastAPI(
    title="AlgoTradeDynamics Exchange Emulator",
    version="1.0.0",
    description="Bybit-compatible local exchange emulator with manual, scenario, and historical replay modes.",
    lifespan=lifespan,
)

origins = os.getenv(
    "EMULATOR_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in origins if item.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "exchange-emulator"}


# ---------------- Admin API ----------------


@app.get("/api/admin/accounts")
def list_accounts(db: Session = Depends(get_db)) -> list[dict]:
    accounts = db.scalars(select(Account).order_by(Account.id)).all()
    return [serialize_account(db, account) for account in accounts]


@app.post("/api/admin/accounts", status_code=201)
def create_account(payload: AccountCreate, db: Session = Depends(get_db)) -> dict:
    account = Account(
        name=payload.name,
        api_key=make_api_key(),
        api_secret=make_api_secret(),
        initial_balance=payload.initial_balance,
        balance=payload.initial_balance,
        maker_fee_rate=payload.maker_fee_rate,
        taker_fee_rate=payload.taker_fee_rate,
        slippage_percent=payload.slippage_percent,
    )
    db.add(account)
    db.flush()
    log_event(db, "account_created", f"Account '{account.name}' created", account_id=account.id)
    db.commit()
    db.refresh(account)
    return serialize_account(db, account, include_secret=True)


@app.post("/api/admin/accounts/{account_id}/fund")
def fund_account(account_id: int, payload: AccountFund, db: Session = Depends(get_db)) -> dict:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.balance + payload.amount < 0:
        raise HTTPException(status_code=400, detail="Resulting balance cannot be negative")
    account.balance += payload.amount
    log_event(
        db,
        "account_funded",
        f"Account balance changed by {format_number(payload.amount)} USDT",
        account_id=account.id,
        payload={"amount": payload.amount, "balance": account.balance},
    )
    db.commit()
    return serialize_account(db, account)


@app.post("/api/admin/accounts/{account_id}/reset")
def reset_account_endpoint(account_id: int, payload: AccountReset, db: Session = Depends(get_db)) -> dict:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    reset_account(db, account, balance=payload.balance)
    return serialize_account(db, account)


@app.delete("/api/admin/accounts/{account_id}", status_code=204, response_class=Response)
def delete_account(account_id: int, db: Session = Depends(get_db)) -> Response:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()
    return Response(status_code=204)


@app.get("/api/admin/markets")
def list_markets(db: Session = Depends(get_db)) -> list[dict]:
    markets = db.scalars(select(Market).order_by(Market.symbol)).all()
    return [
        {
            "symbol": item.symbol,
            "category": item.category,
            "last_price": item.last_price,
            "mark_price": item.mark_price,
            "mode": item.mode,
            "status": item.status,
            "runtime_state": item.runtime_state,
            "updated_at": item.updated_at,
        }
        for item in markets
    ]


@app.post("/api/admin/markets/{symbol}/price")
def update_price(symbol: str, payload: PriceUpdate, db: Session = Depends(get_db)) -> dict:
    symbol = symbol.upper()
    if payload.account_id is not None:
        account = db.get(Account, payload.account_id)
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found")
        market, filled_count = set_account_market_price(
            db, account.id, symbol, payload.price, mark_price=payload.mark_price,
            simulation_time=payload.simulation_time, emit_event=False,
        )
        response = {
            "symbol": market.symbol,
            "last_price": market.last_price,
            "mark_price": market.mark_price,
            "mode": "backtest",
            "status": "running",
            "account_id": account.id,
            "filled_orders": filled_count,
        }
    else:
        market = get_or_create_market(db, symbol, initial_price=payload.price)
        market.mode = "manual"
        market.status = "idle"
        market.runtime_state = {}
        set_market_price(
            db, market.symbol, payload.price, mark_price=payload.mark_price,
            source="manual", simulation_time=payload.simulation_time,
        )
        response = {
            "symbol": market.symbol,
            "last_price": market.last_price,
            "mark_price": market.mark_price,
            "mode": market.mode,
            "status": market.status,
            "account_id": None,
            "filled_orders": 0,
        }
    db.commit()
    return response


@app.post("/api/admin/markets/{symbol}/move")
def move_price(symbol: str, payload: PriceMove, db: Session = Depends(get_db)) -> dict:
    market = get_or_create_market(db, symbol.upper(), initial_price=payload.target_price)
    start_manual_move(db, market, target_price=payload.target_price, duration_seconds=payload.duration_seconds)
    return {"symbol": market.symbol, "mode": market.mode, "status": market.status, "runtime_state": market.runtime_state}


@app.post("/api/admin/markets/{symbol}/pause")
def pause_market(symbol: str, db: Session = Depends(get_db)) -> dict:
    market = get_or_create_market(db, symbol.upper())
    state = dict(market.runtime_state or {})
    state["paused_at"] = datetime.now(timezone.utc).timestamp()
    market.runtime_state = state
    market.status = "paused"
    db.commit()
    return {"symbol": market.symbol, "mode": market.mode, "status": market.status, "runtime_state": market.runtime_state}


@app.post("/api/admin/markets/{symbol}/resume")
def resume_market(symbol: str, db: Session = Depends(get_db)) -> dict:
    market = get_or_create_market(db, symbol.upper())
    if not market.runtime_state:
        raise HTTPException(status_code=400, detail="Nothing to resume")
    market.status = "running"
    state = dict(market.runtime_state)
    current_time = datetime.now(timezone.utc).timestamp()
    paused_at = state.pop("paused_at", None)
    if paused_at:
        paused_duration = max(current_time - float(paused_at), 0)
        if state.get("started_at") is not None:
            state["started_at"] = float(state["started_at"]) + paused_duration
        if state.get("step_started_at") is not None:
            state["step_started_at"] = float(state["step_started_at"]) + paused_duration
    state["last_advance"] = current_time
    market.runtime_state = state
    db.commit()
    return {"symbol": market.symbol, "mode": market.mode, "status": market.status, "runtime_state": market.runtime_state}


@app.post("/api/admin/markets/{symbol}/stop")
def stop_market(symbol: str, db: Session = Depends(get_db)) -> dict:
    market = get_or_create_market(db, symbol.upper())
    market.status = "idle"
    market.runtime_state = {}
    db.commit()
    return {"symbol": market.symbol, "mode": market.mode, "status": market.status, "runtime_state": market.runtime_state}


@app.get("/api/admin/scenarios")
def list_scenarios(symbol: str | None = None, db: Session = Depends(get_db)) -> list[dict]:
    query = select(Scenario).order_by(Scenario.id.desc())
    if symbol:
        query = query.where(Scenario.symbol == symbol.upper())
    items = db.scalars(query).all()
    return [
        {"id": item.id, "name": item.name, "symbol": item.symbol, "steps": item.steps, "created_at": item.created_at}
        for item in items
    ]


@app.post("/api/admin/scenarios", status_code=201)
def create_scenario(payload: ScenarioCreate, db: Session = Depends(get_db)) -> dict:
    steps = []
    for step in payload.steps:
        price = float(step.get("price", 0))
        duration = float(step.get("duration_seconds", 0))
        if price <= 0 or duration < 0:
            raise HTTPException(status_code=422, detail="Each step requires positive price and non-negative duration_seconds")
        steps.append({"price": price, "duration_seconds": duration})
    scenario = Scenario(name=payload.name, symbol=payload.symbol.upper(), steps=steps)
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return {"id": scenario.id, "name": scenario.name, "symbol": scenario.symbol, "steps": scenario.steps}


@app.delete("/api/admin/scenarios/{scenario_id}", status_code=204, response_class=Response)
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)) -> Response:
    scenario = db.get(Scenario, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(scenario)
    db.commit()
    return Response(status_code=204)


@app.post("/api/admin/scenarios/{scenario_id}/start")
def run_scenario(scenario_id: int, db: Session = Depends(get_db)) -> dict:
    scenario = db.get(Scenario, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    market = get_or_create_market(db, scenario.symbol)
    start_scenario(db, market, scenario)
    return {"symbol": market.symbol, "mode": market.mode, "status": market.status, "runtime_state": market.runtime_state}


@app.post("/api/admin/scenarios/{scenario_id}/restart")
def restart_scenario(scenario_id: int, db: Session = Depends(get_db)) -> dict:
    return run_scenario(scenario_id, db)


@app.post("/api/admin/markets/{symbol}/scenario-step")
def step_scenario(symbol: str, db: Session = Depends(get_db)) -> dict:
    market = get_or_create_market(db, symbol.upper())
    if market.mode != "scenario":
        raise HTTPException(status_code=400, detail="Market is not in scenario mode")
    scenario_step_once(db, market)
    return {"symbol": market.symbol, "last_price": market.last_price, "status": market.status, "runtime_state": market.runtime_state}


def _upsert_candles(db: Session, candles: list[dict]) -> int:
    inserted = 0
    for item in candles:
        exists = db.scalar(
            select(Candle.id).where(
                Candle.exchange == item["exchange"],
                Candle.category == item["category"],
                Candle.symbol == item["symbol"],
                Candle.interval == item["interval"],
                Candle.open_time == item["open_time"],
            )
        )
        if exists:
            continue
        db.add(Candle(**item))
        inserted += 1
    db.commit()
    return inserted


@app.post("/api/admin/historical/download")
def download_historical(payload: HistoricalDownload, db: Session = Depends(get_db)) -> dict:
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=422, detail="end_time must be greater than start_time")
    symbol = payload.symbol.upper()
    cursor_end = payload.end_time
    rows: dict[int, dict] = {}
    calls = 0
    base_url = os.getenv("BYBIT_PUBLIC_API_URL", "https://api.bybit.com")
    try:
        with httpx.Client(timeout=30) as client:
            while cursor_end >= payload.start_time and calls < 1000:
                response = client.get(
                    f"{base_url}/v5/market/kline",
                    params={
                        "category": payload.category,
                        "symbol": symbol,
                        "interval": payload.interval,
                        "start": payload.start_time,
                        "end": cursor_end,
                        "limit": 1000,
                    },
                )
                response.raise_for_status()
                body = response.json()
                if body.get("retCode") != 0:
                    raise ValueError(body.get("retMsg") or "Bybit returned an error")
                batch = body.get("result", {}).get("list", [])
                if not batch:
                    break
                oldest = None
                for row in batch:
                    open_time = int(row[0])
                    if open_time < payload.start_time or open_time > payload.end_time:
                        continue
                    rows[open_time] = {
                        "exchange": "bybit",
                        "category": payload.category,
                        "symbol": symbol,
                        "interval": payload.interval,
                        "open_time": open_time,
                        "open": float(row[1]),
                        "high": float(row[2]),
                        "low": float(row[3]),
                        "close": float(row[4]),
                        "volume": float(row[5]),
                        "turnover": float(row[6]),
                    }
                    oldest = open_time if oldest is None else min(oldest, open_time)
                calls += 1
                if oldest is None or oldest <= payload.start_time:
                    break
                cursor_end = oldest - 1
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Historical download failed: {exc}") from exc
    inserted = _upsert_candles(db, list(rows.values()))
    get_or_create_market(db, symbol, initial_price=next(iter(rows.values()))["open"] if rows else 100)
    db.commit()
    return {"symbol": symbol, "downloaded": len(rows), "inserted": inserted, "api_calls": calls}


@app.post("/api/admin/historical/import-csv")
async def import_historical_csv(
    symbol: str,
    interval: str = "1",
    category: str = "linear",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    raw = await file.read()
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict] = []
    for row in reader:
        open_time = row.get("open_time") or row.get("timestamp") or row.get("startTime") or row.get("time") or row.get("date")
        if open_time is None:
            raise HTTPException(status_code=422, detail="CSV requires date, open_time, or timestamp column")
        try:
            numeric_time = int(float(open_time))
            if numeric_time < 10_000_000_000:
                numeric_time *= 1000
        except ValueError:
            parsed = datetime.fromisoformat(str(open_time).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            numeric_time = int(parsed.timestamp() * 1000)
        rows.append(
            {
                "exchange": "csv",
                "category": category,
                "symbol": symbol.upper(),
                "interval": interval,
                "open_time": numeric_time,
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row.get("volume") or 0),
                "turnover": float(row.get("turnover") or 0),
            }
        )
    inserted = _upsert_candles(db, rows)
    if rows:
        get_or_create_market(db, symbol.upper(), initial_price=rows[0]["open"])
        db.commit()
    return {"symbol": symbol.upper(), "read": len(rows), "inserted": inserted}


@app.get("/api/admin/historical/datasets")
def list_datasets(db: Session = Depends(get_db)) -> list[dict]:
    result = db.execute(
        select(
            Candle.exchange,
            Candle.category,
            Candle.symbol,
            Candle.interval,
            func.count(Candle.id),
            func.min(Candle.open_time),
            func.max(Candle.open_time),
        )
        .group_by(Candle.exchange, Candle.category, Candle.symbol, Candle.interval)
        .order_by(Candle.symbol, Candle.interval)
    ).all()
    return [
        {
            "exchange": row[0],
            "category": row[1],
            "symbol": row[2],
            "interval": row[3],
            "candles": row[4],
            "from_time": row[5],
            "to_time": row[6],
        }
        for row in result
    ]


@app.get("/api/admin/historical/count")
def count_historical_candles(
    symbol: str,
    interval: str,
    start_time: int,
    end_time: int,
    db: Session = Depends(get_db),
) -> dict:
    count = db.scalar(
        select(func.count(Candle.id)).where(
            Candle.symbol == symbol.upper(),
            Candle.interval == interval,
            Candle.open_time >= start_time,
            Candle.open_time <= end_time,
        )
    ) or 0
    return {"count": int(count)}


@app.get("/api/admin/historical/candles")
def list_historical_candles(
    symbol: str,
    interval: str,
    start_time: int,
    end_time: int,
    after_time: int | None = None,
    limit: int = Query(default=5000, ge=1, le=10000),
    db: Session = Depends(get_db),
) -> dict:
    query = (
        select(Candle)
        .where(
            Candle.symbol == symbol.upper(),
            Candle.interval == interval,
            Candle.open_time >= start_time,
            Candle.open_time <= end_time,
        )
        .order_by(Candle.open_time)
        .limit(limit)
    )
    if after_time is not None:
        query = query.where(Candle.open_time > after_time)
    items = db.scalars(query).all()
    return {
        "items": [
            {
                "open_time": item.open_time,
                "open": item.open,
                "high": item.high,
                "low": item.low,
                "close": item.close,
                "volume": item.volume,
                "turnover": item.turnover,
            }
            for item in items
        ],
        "next_after_time": items[-1].open_time if len(items) == limit else None,
    }


@app.delete("/api/admin/historical/{symbol}")
def delete_historical(symbol: str, interval: str | None = None, db: Session = Depends(get_db)) -> dict:
    query = delete(Candle).where(Candle.symbol == symbol.upper())
    if interval:
        query = query.where(Candle.interval == interval)
    result = db.execute(query)
    db.commit()
    return {"deleted": result.rowcount or 0}


@app.post("/api/admin/markets/{symbol}/replay/start")
def replay_start(symbol: str, payload: ReplayStart, db: Session = Depends(get_db)) -> dict:
    market = get_or_create_market(db, symbol.upper())
    try:
        total = start_replay(
            db,
            market,
            interval=payload.interval,
            start_time=payload.start_time,
            end_time=payload.end_time,
            speed=payload.speed,
            path_mode=payload.path_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"symbol": market.symbol, "total": total, "status": market.status, "runtime_state": market.runtime_state}


@app.post("/api/admin/markets/{symbol}/replay/step")
def replay_step(symbol: str, db: Session = Depends(get_db)) -> dict:
    market = get_or_create_market(db, symbol.upper())
    if market.mode != "historical":
        raise HTTPException(status_code=400, detail="Market is not in historical mode")
    market.status = "paused"
    db.commit()
    replay_one_candle(db, market)
    db.refresh(market)
    if market.status != "completed":
        market.status = "paused"
        db.commit()
    return {"symbol": market.symbol, "last_price": market.last_price, "status": market.status, "runtime_state": market.runtime_state}


@app.get("/api/admin/orders")
def admin_orders(
    account_id: int | None = None,
    symbol: str | None = None,
    status: str | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = select(Order).order_by(Order.created_at.desc()).limit(limit)
    if account_id:
        query = query.where(Order.account_id == account_id)
    if symbol:
        query = query.where(Order.symbol == symbol.upper())
    if status:
        query = query.where(Order.status == status)
    return [serialize_order(item) | {"accountId": item.account_id} for item in db.scalars(query).all()]


@app.get("/api/admin/positions")
def admin_positions(account_id: int | None = None, db: Session = Depends(get_db)) -> list[dict]:
    query = select(Position).order_by(Position.updated_at.desc())
    if account_id:
        query = query.where(Position.account_id == account_id)
    return [position_payload(db, item) | {"accountId": item.account_id} for item in db.scalars(query).all() if item.size > 0]


@app.get("/api/admin/executions")
def admin_executions(
    account_id: int | None = None,
    symbol: str | None = None,
    limit: int = Query(default=200, ge=1, le=100000),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = select(Execution).order_by(Execution.created_at.desc()).limit(limit)
    if account_id:
        query = query.where(Execution.account_id == account_id)
    if symbol:
        query = query.where(Execution.symbol == symbol.upper())
    items = db.scalars(query).all()
    return [
        {
            "execId": item.id,
            "orderId": item.order_id,
            "accountId": item.account_id,
            "symbol": item.symbol,
            "side": item.side,
            "execPrice": format_number(item.price),
            "execQty": format_number(item.qty),
            "execFee": format_number(item.fee),
            "closedPnl": format_number(item.closed_pnl),
            "execTime": int(item.created_at.timestamp() * 1000),
        }
        for item in items
    ]


@app.get("/api/admin/events")
def admin_events(
    account_id: int | None = None,
    symbol: str | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = select(Event).order_by(Event.created_at.desc()).limit(limit)
    if account_id:
        query = query.where(or_(Event.account_id == account_id, Event.account_id.is_(None)))
    if symbol:
        query = query.where(Event.symbol == symbol.upper())
    return [
        {
            "id": item.id,
            "account_id": item.account_id,
            "symbol": item.symbol,
            "event_type": item.event_type,
            "message": item.message,
            "payload": item.payload,
            "created_at": item.created_at,
        }
        for item in db.scalars(query).all()
    ]


@app.get("/api/admin/dashboard")
def dashboard(
    account_id: int = 1,
    symbol: str = "BTCUSDT",
    db: Session = Depends(get_db),
) -> dict:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    market = effective_market(db, account.id, symbol.upper())
    position = db.scalar(
        select(Position).where(
            Position.account_id == account.id,
            Position.symbol == market.symbol,
            Position.size > 0,
        )
    )
    open_orders = db.scalar(
        select(func.count(Order.id)).where(
            Order.account_id == account.id,
            Order.symbol == market.symbol,
            Order.status.in_(ACTIVE_STATUSES),
        )
    ) or 0
    executions = db.scalar(
        select(func.count(Execution.id)).where(
            Execution.account_id == account.id,
            Execution.symbol == market.symbol,
        )
    ) or 0
    return {
        "account": serialize_account(db, account),
        "market": {
            "symbol": market.symbol,
            "last_price": market.last_price,
            "mark_price": market.mark_price,
            "mode": getattr(market, "mode", "backtest"),
            "status": getattr(market, "status", "running"),
            "runtime_state": getattr(market, "runtime_state", {"simulation_time": getattr(market, "simulation_time", None)}),
            "updated_at": market.updated_at,
        },
        "position": position_payload(db, position) if position else None,
        "open_orders": int(open_orders),
        "executions": int(executions),
    }


# ---------------- Bybit-compatible API ----------------


@app.get("/v5/market/tickers")
def get_tickers(
    category: str,
    symbol: str,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> dict:
    account = get_account_by_api_key(db, x_api_key)
    market = effective_market(db, account.id, symbol.upper()) if account else get_or_create_market(db, symbol.upper())
    return bybit_ok(
        {
            "category": category,
            "list": [
                {
                    "symbol": market.symbol,
                    "lastPrice": format_number(market.last_price),
                    "markPrice": format_number(market.mark_price),
                    "indexPrice": format_number(market.mark_price),
                    "prevPrice24h": format_number(market.last_price),
                    "price24hPcnt": "0",
                    "highPrice24h": format_number(market.last_price),
                    "lowPrice24h": format_number(market.last_price),
                    "turnover24h": "0",
                    "volume24h": "0",
                }
            ],
        }
    )


@app.get("/v5/market/instruments-info")
def get_instruments_info(category: str, symbol: str, db: Session = Depends(get_db)) -> dict:
    symbol = symbol.upper()
    get_or_create_market(db, symbol)
    if symbol.startswith("BTC"):
        min_qty, qty_step, tick = 0.001, 0.001, 0.1
    elif symbol.startswith("ETH"):
        min_qty, qty_step, tick = 0.001, 0.001, 0.01
    elif symbol.startswith("SOL"):
        min_qty, qty_step, tick = 0.01, 0.01, 0.001
    else:
        min_qty, qty_step, tick = 0.001, 0.001, 0.0001
    return bybit_ok(
        {
            "category": category,
            "list": [
                {
                    "symbol": symbol,
                    "contractType": "LinearPerpetual",
                    "status": "Trading",
                    "baseCoin": symbol.removesuffix("USDT"),
                    "quoteCoin": "USDT",
                    "settleCoin": "USDT",
                    "priceScale": "4",
                    "priceFilter": {"minPrice": "0.0001", "maxPrice": "10000000", "tickSize": format_number(tick)},
                    "lotSizeFilter": {
                        "maxOrderQty": "1000000",
                        "minOrderQty": format_number(min_qty),
                        "qtyStep": format_number(qty_step),
                        "minNotionalValue": "5",
                    },
                    "leverageFilter": {"minLeverage": "1", "maxLeverage": "100", "leverageStep": "0.01"},
                }
            ],
        }
    )


@app.post("/v5/order/create")
def bybit_create_order(
    payload: dict[str, Any],
    account: Account = Depends(require_account),
    db: Session = Depends(get_db),
) -> dict:
    order, code, message = create_order(
        db,
        account,
        category=str(payload.get("category", "linear")),
        symbol=str(payload.get("symbol", "")).upper(),
        side=str(payload.get("side", "")),
        order_type=str(payload.get("orderType", "Limit")),
        qty=float(payload.get("qty", 0)),
        price=float(payload["price"]) if payload.get("price") not in (None, "") else None,
        reduce_only=bool(payload.get("reduceOnly", False)),
        order_link_id=payload.get("orderLinkId"),
    )
    result = {"orderId": order.id, "orderLinkId": order.order_link_id or "", "orderStatus": order.status}
    return bybit_ok(result) if code == 0 else bybit_error(code, message, result)


@app.post("/v5/order/cancel")
def bybit_cancel_order(
    payload: dict[str, Any],
    account: Account = Depends(require_account),
    db: Session = Depends(get_db),
) -> dict:
    order = cancel_order(db, account, order_id=payload.get("orderId"), order_link_id=payload.get("orderLinkId"))
    if order is None:
        return bybit_error(110001, "Order does not exist")
    return bybit_ok({"orderId": order.id, "orderLinkId": order.order_link_id or ""})


@app.get("/v5/order/realtime")
def bybit_open_orders(
    category: str,
    symbol: str | None = None,
    orderId: str | None = None,
    orderLinkId: str | None = None,
    openOnly: int = 0,
    account: Account = Depends(require_account),
    db: Session = Depends(get_db),
) -> dict:
    query = select(Order).where(Order.account_id == account.id, Order.category == category)
    if symbol:
        query = query.where(Order.symbol == symbol.upper())
    if orderId:
        query = query.where(Order.id == orderId)
    if orderLinkId:
        query = query.where(Order.order_link_id == orderLinkId)
    if not orderId and not orderLinkId:
        query = query.where(Order.status.in_(ACTIVE_STATUSES))
    items = db.scalars(query.order_by(Order.created_at.desc())).all()
    return bybit_ok({"category": category, "nextPageCursor": "", "list": [serialize_order(item) for item in items]})


@app.get("/v5/order/history")
def bybit_order_history(
    category: str,
    symbol: str | None = None,
    orderId: str | None = None,
    orderLinkId: str | None = None,
    limit: int = 50,
    account: Account = Depends(require_account),
    db: Session = Depends(get_db),
) -> dict:
    query = select(Order).where(Order.account_id == account.id, Order.category == category)
    if symbol:
        query = query.where(Order.symbol == symbol.upper())
    if orderId:
        query = query.where(Order.id == orderId)
    if orderLinkId:
        query = query.where(Order.order_link_id == orderLinkId)
    items = db.scalars(query.order_by(Order.created_at.desc()).limit(min(limit, 200))).all()
    return bybit_ok({"category": category, "nextPageCursor": "", "list": [serialize_order(item) for item in items]})


@app.get("/v5/position/list")
def bybit_positions(
    category: str,
    symbol: str | None = None,
    account: Account = Depends(require_account),
    db: Session = Depends(get_db),
) -> dict:
    query = select(Position).where(Position.account_id == account.id, Position.category == category)
    if symbol:
        query = query.where(Position.symbol == symbol.upper())
    items = db.scalars(query.order_by(Position.symbol)).all()
    if symbol and not items:
        items = [get_or_create_position(db, account.id, category, symbol.upper())]
        db.commit()
    return bybit_ok({"category": category, "nextPageCursor": "", "list": [position_payload(db, item) for item in items]})


@app.post("/v5/position/set-leverage")
def bybit_set_leverage(
    payload: dict[str, Any],
    account: Account = Depends(require_account),
    db: Session = Depends(get_db),
) -> dict:
    symbol = str(payload.get("symbol", "")).upper()
    category = str(payload.get("category", "linear"))
    leverage = float(payload.get("buyLeverage") or payload.get("sellLeverage") or 10)
    position = get_or_create_position(db, account.id, category, symbol)
    position.leverage = leverage
    db.commit()
    return bybit_ok({})


@app.post("/v5/position/trading-stop")
def bybit_trading_stop(
    payload: dict[str, Any],
    account: Account = Depends(require_account),
    db: Session = Depends(get_db),
) -> dict:
    log_event(
        db,
        "trading_stop_updated",
        "Trading stop settings received",
        account_id=account.id,
        symbol=str(payload.get("symbol", "")).upper(),
        payload=payload,
    )
    db.commit()
    return bybit_ok({})


@app.get("/v5/account/wallet-balance")
def bybit_wallet_balance(
    accountType: str = "UNIFIED",
    coin: str = "USDT",
    account: Account = Depends(require_account),
    db: Session = Depends(get_db),
) -> dict:
    snapshot = account_snapshot(db, account)
    return bybit_ok(
        {
            "list": [
                {
                    "accountType": accountType,
                    "totalEquity": format_number(snapshot["equity"]),
                    "totalWalletBalance": format_number(snapshot["balance"]),
                    "totalAvailableBalance": format_number(snapshot["available_balance"]),
                    "totalPerpUPL": format_number(snapshot["unrealized_pnl"]),
                    "coin": [
                        {
                            "coin": coin,
                            "equity": format_number(snapshot["equity"]),
                            "walletBalance": format_number(snapshot["balance"]),
                            "availableToWithdraw": format_number(snapshot["available_balance"]),
                            "unrealisedPnl": format_number(snapshot["unrealized_pnl"]),
                        }
                    ],
                }
            ]
        }
    )


@app.get("/v5/execution/list")
def bybit_execution_list(
    category: str,
    symbol: str | None = None,
    limit: int = 50,
    account: Account = Depends(require_account),
    db: Session = Depends(get_db),
) -> dict:
    query = select(Execution).where(Execution.account_id == account.id)
    if symbol:
        query = query.where(Execution.symbol == symbol.upper())
    items = db.scalars(query.order_by(Execution.created_at.desc()).limit(min(limit, 200))).all()
    result = [
        {
            "symbol": item.symbol,
            "orderId": item.order_id,
            "orderLinkId": db.get(Order, item.order_id).order_link_id or "" if db.get(Order, item.order_id) else "",
            "side": item.side,
            "execId": item.id,
            "execPrice": format_number(item.price),
            "execQty": format_number(item.qty),
            "execFee": format_number(item.fee),
            "closedPnl": format_number(item.closed_pnl),
            "execTime": str(int(item.created_at.timestamp() * 1000)),
            "execType": "Trade",
        }
        for item in items
    ]
    return bybit_ok({"category": category, "nextPageCursor": "", "list": result})


@app.get("/v5/market/kline")
def local_kline(
    category: str,
    symbol: str,
    interval: str = "1",
    start: int | None = None,
    end: int | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
) -> dict:
    query = select(Candle).where(Candle.category == category, Candle.symbol == symbol.upper(), Candle.interval == interval)
    if start is not None:
        query = query.where(Candle.open_time >= start)
    if end is not None:
        query = query.where(Candle.open_time <= end)
    items = db.scalars(query.order_by(Candle.open_time.desc()).limit(min(limit, 1000))).all()
    rows = [
        [
            str(item.open_time),
            format_number(item.open),
            format_number(item.high),
            format_number(item.low),
            format_number(item.close),
            format_number(item.volume),
            format_number(item.turnover),
        ]
        for item in items
    ]
    return bybit_ok({"category": category, "symbol": symbol.upper(), "list": rows})
