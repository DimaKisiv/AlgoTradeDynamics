"""Emulator-driven bot backtest endpoints."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.backtest import (
    BacktestCreate,
    BacktestCycleResponse,
    BacktestPointResponse,
    BacktestRunDetail,
    BacktestRunSummary,
    HistoricalDatasetResponse,
)
from app.schemas.trading_bot import TradingBotEventResponse, TradingBotOrderResponse
from app.services.backtest_service import (
    create_backtest,
    delete_backtest,
    get_backtest_by_id,
    list_backtests,
    list_cycles,
    list_datasets,
    list_events,
    list_executions,
    list_orders,
    list_points,
    request_cancel,
    request_pause,
    request_resume,
    run_backtest_job,
)

router = APIRouter(prefix="/backtests", tags=["Bot Backtests"])


def _owned_run(db: Session, run_id: int, user_id: int):
    run = get_backtest_by_id(db, run_id, user_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Backtest run not found")
    return run


@router.get("/datasets", response_model=list[HistoricalDatasetResponse])
def datasets(_: User = Depends(get_current_user)):
    try:
        return list_datasets()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Exchange emulator unavailable: {exc}") from exc


@router.post("", response_model=BacktestRunDetail, status_code=status.HTTP_201_CREATED)
async def start_backtest(
    payload: BacktestCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        run = create_backtest(db, payload, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    task = asyncio.create_task(asyncio.to_thread(run_backtest_job, run.id))
    tasks = getattr(request.app.state, "backtest_tasks", None)
    if tasks is None:
        tasks = set()
        request.app.state.backtest_tasks = tasks
    tasks.add(task)
    task.add_done_callback(tasks.discard)
    return run


@router.get("", response_model=list[BacktestRunSummary])
def get_backtests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_backtests(db, current_user.id)


@router.get("/{run_id}", response_model=BacktestRunDetail)
def get_backtest(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _owned_run(db, run_id, current_user.id)


@router.get("/{run_id}/points", response_model=list[BacktestPointResponse])
def get_points(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_run(db, run_id, current_user.id)
    return list_points(db, run_id)


@router.get("/{run_id}/cycles", response_model=list[BacktestCycleResponse])
def get_cycles(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_run(db, run_id, current_user.id)
    return list_cycles(db, run_id)


@router.get("/{run_id}/orders", response_model=list[TradingBotOrderResponse])
def get_orders(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_orders(db, _owned_run(db, run_id, current_user.id))


@router.get("/{run_id}/events", response_model=list[TradingBotEventResponse])
def get_events(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_events(db, _owned_run(db, run_id, current_user.id))


@router.get("/{run_id}/executions")
def get_executions(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_executions(_owned_run(db, run_id, current_user.id))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not read emulator executions: {exc}") from exc


@router.post("/{run_id}/pause", response_model=BacktestRunDetail)
def pause_backtest(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return request_pause(db, _owned_run(db, run_id, current_user.id))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{run_id}/resume", response_model=BacktestRunDetail)
def resume_backtest(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return request_resume(db, _owned_run(db, run_id, current_user.id))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{run_id}/cancel", response_model=BacktestRunDetail)
def cancel_backtest(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return request_cancel(db, _owned_run(db, run_id, current_user.id))


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def remove_backtest(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        delete_backtest(db, _owned_run(db, run_id, current_user.id))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return Response(status_code=204)
