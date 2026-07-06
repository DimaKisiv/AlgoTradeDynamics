"""Trading bot API endpoints scoped to the authenticated user."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.trading_bot import (
    TradingBotCreate,
    TradingBotOrderResponse,
    TradingBotResponse,
    TradingBotRunResponse,
    TradingBotUpdate,
)
from app.services.trading_bot_service import (
    create_trading_bot,
    delete_trading_bot,
    get_trading_bot,
    list_trading_bots,
    list_trading_bot_orders,
    start_trading_bot_cycle,
    stop_trading_bot_cycle,
    sync_trading_bot_orders,
    update_trading_bot,
)

router = APIRouter(prefix="/bots", tags=["Bots"])


@router.get("", response_model=list[TradingBotResponse])
def list_bots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_trading_bots(db, current_user.id)


@router.post("", response_model=TradingBotResponse, status_code=status.HTTP_201_CREATED)
def create_bot(
    payload: TradingBotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_trading_bot(db, payload, current_user.id)


@router.get("/{bot_id}", response_model=TradingBotResponse)
def get_bot(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    return bot


@router.get("/{bot_id}/orders", response_model=list[TradingBotOrderResponse])
def get_bot_orders(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    return list_trading_bot_orders(db, bot.id, current_user.id)


@router.post("/{bot_id}/start", response_model=TradingBotRunResponse)
def start_bot(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    try:
        return start_trading_bot_cycle(db, bot, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/{bot_id}/stop", response_model=TradingBotResponse)
def stop_bot(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    return stop_trading_bot_cycle(db, bot, current_user)


@router.post("/{bot_id}/sync", response_model=list[TradingBotOrderResponse])
def sync_bot(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    return sync_trading_bot_orders(db, bot, current_user)


@router.put("/{bot_id}", response_model=TradingBotResponse)
def update_bot(
    bot_id: int,
    payload: TradingBotUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    return update_trading_bot(db, bot, payload)


@router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bot(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    delete_trading_bot(db, bot)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
