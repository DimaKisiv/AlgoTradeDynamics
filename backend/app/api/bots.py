"""Trading bot API endpoints scoped to the authenticated user."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.trading_bot import (
    TradingBotClosePositionRequest,
    TradingBotClosePositionResponse,
    TradingBotCreate,
    TradingBotEventResponse,
    TradingBotOrderResponse,
    TradingBotPositionResponse,
    TradingBotRiskResponse,
    TradingBotResponse,
    TradingBotRunResponse,
    TradingBotUpdate,
    TradingBotClearHistoryResponse,
)
from app.services.trading_bot_service import (
    create_trading_bot,
    delete_trading_bot,
    get_trading_bot,
    list_trading_bots,
    list_trading_bot_events,
    list_trading_bot_orders,
    cancel_trading_bot_orders,
    start_trading_bot_cycle,
    stop_trading_bot_cycle,
    sync_trading_bot_orders,
    update_trading_bot,
    clear_trading_bot_history,
    close_trading_bot_position,
    get_trading_bot_position,
    get_trading_bot_risk,
    serialize_trading_bot,
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
    return serialize_trading_bot(db, bot)


@router.get("/{bot_id}/position", response_model=TradingBotPositionResponse)
def get_bot_position(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    return get_trading_bot_position(db, bot, current_user)


@router.get("/{bot_id}/risk", response_model=TradingBotRiskResponse)
def get_bot_risk(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    return get_trading_bot_risk(db, bot, current_user)


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


@router.get("/{bot_id}/events", response_model=list[TradingBotEventResponse])
def get_bot_events(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    return list_trading_bot_events(db, bot.id, current_user.id)


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
        status_code = 400 if str(
            exc) == "Live trading is disabled for this bot" else 422
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


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


@router.post("/{bot_id}/cancel-orders", response_model=list[TradingBotOrderResponse])
def cancel_bot_orders(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    return cancel_trading_bot_orders(db, bot, current_user)


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


@router.post("/{bot_id}/clear-history", response_model=TradingBotClearHistoryResponse)
def clear_bot_history(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    return clear_trading_bot_history(db, bot, current_user)


@router.post("/{bot_id}/close-position", response_model=TradingBotClosePositionResponse)
def close_position(
    bot_id: int,
    payload: TradingBotClosePositionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    try:
        return close_trading_bot_position(db, bot, current_user, confirm=payload.confirm)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
