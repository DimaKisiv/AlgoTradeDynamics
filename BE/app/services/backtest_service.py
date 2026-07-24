"""Service layer: orchestrates backtests, persists results."""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import desc
from sqlalchemy.orm import Session, selectinload

from app.bot_engine.backtester import Backtester
from app.bot_engine.data_loader import load_candles
from app.bot_engine.strategies import get_strategy
from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.backtest import BacktestRun, EquityPoint, Trade
from app.schemas.backtest import BacktestRequest

logger = get_logger(__name__)

DATASETS = {
    "BTC/USDT": "data/btc_usdt_2024.csv",
    "ETH/USDT": "data/eth_usdt_2024.csv",
}


def _resolve_dataset(symbol: str) -> Path:
    settings = get_settings()
    relative = DATASETS.get(symbol, settings.default_dataset)
    path = Path(relative)
    if not path.exists():
        path = Path(settings.default_dataset)
    return path


def run_backtest(db: Session, payload: BacktestRequest, user_id: int) -> BacktestRun:
    """Build a strategy, run a backtest and persist the result for a user."""
    logger.info(
        "Starting backtest: symbol=%s strategy=%s balance=%s",
        payload.symbol, payload.strategy, payload.initial_balance,
    )

    dataset_path = _resolve_dataset(payload.symbol)
    candles = load_candles(dataset_path)

    strategy_params = (
        payload.ma_params.model_dump()
        if payload.strategy == "ma_crossover"
        else payload.rsi_params.model_dump()
    )
    strategy = get_strategy(payload.strategy, strategy_params)

    backtester = Backtester(
        strategy=strategy,
        candles=candles,
        symbol=payload.symbol,
        initial_balance=payload.initial_balance,
        position_size_percent=payload.risk.position_size_percent,
        stop_loss_percent=payload.risk.stop_loss_percent,
        max_drawdown_percent=payload.risk.max_drawdown_percent,
    )
    result = backtester.run()

    run = BacktestRun(
        user_id=user_id,
        symbol=result.symbol,
        strategy_name=result.strategy_name,
        strategy_params=result.strategy_params,
        risk_params=result.risk_params,
        initial_balance=result.initial_balance,
        final_balance=result.final_balance,
        total_pnl=result.total_pnl,
        total_pnl_percent=result.total_pnl_percent,
        max_drawdown_percent=result.max_drawdown_percent,
        win_rate_percent=result.win_rate_percent,
        trades_count=result.trades_count,
        status="completed",
    )
    db.add(run)
    db.flush()

    for trade in result.trades:
        db.add(Trade(
            run_id=run.id,
            symbol=trade.symbol,
            side=trade.side,
            entry_date=trade.entry_date,
            exit_date=trade.exit_date,
            entry_price=trade.entry_price,
            exit_price=trade.exit_price,
            quantity=trade.quantity,
            pnl=trade.pnl,
            pnl_percent=trade.pnl_percent,
            reason=trade.reason,
        ))

    for point in result.equity_points:
        db.add(EquityPoint(run_id=run.id, date=point.date, value=point.value))

    db.commit()
    logger.info(
        "Backtest completed: run_id=%s trades=%s pnl=%s%%",
        run.id, result.trades_count, result.total_pnl_percent,
    )
    return get_backtest_by_id(db, run.id, user_id)  # type: ignore[return-value]


def get_backtest_by_id(db: Session, run_id: int, user_id: int) -> BacktestRun | None:
    return (
        db.query(BacktestRun)
        .options(selectinload(BacktestRun.trades), selectinload(BacktestRun.equity_points))
        .filter(BacktestRun.id == run_id, BacktestRun.user_id == user_id)
        .first()
    )


def list_backtests(db: Session, user_id: int, limit: int = 50) -> list[BacktestRun]:
    return (
        db.query(BacktestRun)
        .filter(BacktestRun.user_id == user_id)
        .order_by(desc(BacktestRun.created_at))
        .limit(limit)
        .all()
    )


def delete_backtest(db: Session, run_id: int, user_id: int) -> bool:
    run = (
        db.query(BacktestRun)
        .filter(BacktestRun.id == run_id, BacktestRun.user_id == user_id)
        .first()
    )
    if run is None:
        return False
    db.delete(run)
    db.commit()
    return True
