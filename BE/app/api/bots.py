"""Trading bot API endpoints scoped to the authenticated user."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
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
    TradingBotPerformanceResponse,
    TradingBotRiskResponse,
    TradingBotResponse,
    TradingBotRunResponse,
    TradingBotUpdate,
    TradingBotClearHistoryResponse,
)
from app.services.audit_service import bot_config_snapshot, record_user_bot_action
from app.services.ui_stream_service import bot_ui_stream_hub
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
    get_trading_bot_performance,
    get_trading_bot_risk,
    serialize_trading_bot,
)

router = APIRouter(prefix="/bots", tags=["Bots"])


def _audit_request_meta(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    return ip, request.headers.get("user-agent")


def _audit_bot_action(db: Session, request: Request, current_user: User, bot, event_type: str, message: str, payload: dict | None = None) -> None:
    ip, user_agent = _audit_request_meta(request)
    record_user_bot_action(
        db, user_id=current_user.id, user_email=current_user.email, bot=bot,
        event_type=event_type, message=message, payload=payload, ip_address=ip, user_agent=user_agent,
    )
    db.commit()


@router.get("", response_model=list[TradingBotResponse])
def list_bots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_trading_bots(db, current_user.id)


@router.post("", response_model=TradingBotResponse, status_code=status.HTTP_201_CREATED)
def create_bot(
    payload: TradingBotCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = create_trading_bot(db, payload, current_user.id)
    bot = get_trading_bot(db, result["id"], current_user.id)
    if bot is not None:
        _audit_bot_action(db, request, current_user, bot, "BOT_CREATED", "Trading bot created")
        bot_ui_stream_hub.publish(bot.id, "bot.created")
    return result


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


@router.get("/{bot_id}/performance", response_model=TradingBotPerformanceResponse)
def get_bot_performance(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    return get_trading_bot_performance(db, bot, current_user)


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
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    try:
        result = start_trading_bot_cycle(db, bot, current_user)
        _audit_bot_action(db, request, current_user, bot, "BOT_START_REQUESTED", "User started trading bot")
        bot_ui_stream_hub.publish(bot.id, "bot.started")
        return result
    except ValueError as exc:
        status_code = 400 if str(
            exc) == "Live trading is disabled for this bot" else 422
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.post("/{bot_id}/stop", response_model=TradingBotResponse)
def stop_bot(
    bot_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    result = stop_trading_bot_cycle(db, bot, current_user)
    _audit_bot_action(db, request, current_user, bot, "BOT_STOP_REQUESTED", "User stopped trading bot")
    bot_ui_stream_hub.publish(bot.id, "bot.stopped")
    return result


@router.post("/{bot_id}/cancel-orders", response_model=list[TradingBotOrderResponse])
def cancel_bot_orders(
    bot_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    result = cancel_trading_bot_orders(db, bot, current_user)
    _audit_bot_action(db, request, current_user, bot, "ORDER_CANCEL_ALL_REQUESTED", "User requested cancellation of bot orders", {"cancelled_count": len(result)})
    bot_ui_stream_hub.publish(bot.id, "orders.cancelled")
    return result


@router.post("/{bot_id}/sync", response_model=list[TradingBotOrderResponse])
def sync_bot(
    bot_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    result = sync_trading_bot_orders(db, bot, current_user)
    _audit_bot_action(db, request, current_user, bot, "EXCHANGE_SYNC_REQUESTED", "User requested exchange order synchronization", {"orders_seen": len(result)})
    bot_ui_stream_hub.publish(bot.id, "exchange.synced")
    return result


@router.put("/{bot_id}", response_model=TradingBotResponse)
def update_bot(
    bot_id: int,
    payload: TradingBotUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    changed_fields = sorted(payload.model_dump(exclude_unset=True).keys())
    before_config, before_config_hash, _ = bot_config_snapshot(bot)
    result = update_trading_bot(db, bot, payload)
    _audit_bot_action(
        db, request, current_user, bot, "BOT_CONFIG_CHANGED", "Trading bot configuration changed",
        {
            "changed_fields": changed_fields,
            "before_config": before_config,
            "before_config_hash": before_config_hash,
        },
    )
    bot_ui_stream_hub.publish(bot.id, "bot.updated")
    return result


@router.post("/{bot_id}/clear-history", response_model=TradingBotClearHistoryResponse)
def clear_bot_history(
    bot_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    result = clear_trading_bot_history(db, bot, current_user)
    _audit_bot_action(db, request, current_user, bot, "BOT_OPERATIONAL_HISTORY_CLEARED", "User cleared ordinary bot orders/events history", result)
    bot_ui_stream_hub.publish(bot.id, "history.cleared")
    return result


@router.post("/{bot_id}/close-position", response_model=TradingBotClosePositionResponse)
def close_position(
    bot_id: int,
    payload: TradingBotClosePositionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    try:
        result = close_trading_bot_position(db, bot, current_user, confirm=payload.confirm)
        _audit_bot_action(db, request, current_user, bot, "POSITION_CLOSE_REQUESTED", "User requested manual position close")
        bot_ui_stream_hub.publish(bot.id, "position.close_requested")
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bot(
    bot_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bot = get_trading_bot(db, bot_id, current_user.id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Trading bot not found")
    _audit_bot_action(db, request, current_user, bot, "BOT_DELETED", "Trading bot deleted", {"deleted_bot_id": bot.id, "deleted_bot_name": bot.name})
    deleted_bot_id = bot.id
    delete_trading_bot(db, bot)
    bot_ui_stream_hub.publish(deleted_bot_id, "bot.deleted")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
