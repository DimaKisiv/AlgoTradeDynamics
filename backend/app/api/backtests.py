"""Backtest API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db
from app.schemas.backtest import (
    BacktestRequest,
    BacktestRunResponse,
    BacktestRunSummary,
)
from app.services.backtest_service import (
    delete_backtest,
    get_backtest_by_id,
    list_backtests,
    run_backtest,
)

router = APIRouter(prefix="/backtests", tags=["Backtests"])
logger = get_logger(__name__)


@router.post("/start", response_model=BacktestRunResponse, status_code=status.HTTP_201_CREATED)
def start_backtest(payload: BacktestRequest, db: Session = Depends(get_db)):
    try:
        return run_backtest(db, payload)
    except FileNotFoundError as exc:
        logger.error("Dataset not found: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        logger.warning("Backtest validation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.get("", response_model=list[BacktestRunSummary])
def list_recent(db: Session = Depends(get_db)):
    return list_backtests(db)


@router.get("/{run_id}", response_model=BacktestRunResponse)
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = get_backtest_by_id(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Backtest run not found")
    return run


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_run(run_id: int, db: Session = Depends(get_db)):
    if not delete_backtest(db, run_id):
        raise HTTPException(status_code=404, detail="Backtest run not found")
    return None
