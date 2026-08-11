"""Per-user external notification settings."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import (
    TelegramConnectResponse,
    TelegramPreferencesUpdate,
    TelegramStatusResponse,
    TelegramTestResponse,
)
from app.services.telegram_notifications import (
    create_link_token,
    disconnect_channel,
    get_channel,
    send_message_sync,
    telegram_configured,
    update_preferences,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _status(db: Session, user_id: int) -> TelegramStatusResponse:
    configured = telegram_configured()
    channel = get_channel(db, user_id)
    if channel is None:
        return TelegramStatusResponse(configured=configured, connected=False)
    return TelegramStatusResponse(
        configured=configured,
        connected=True,
        enabled=channel.enabled,
        username=channel.username,
        connected_at=channel.connected_at,
        notify_trades=channel.notify_trades,
        notify_bot_status=channel.notify_bot_status,
        notify_errors=channel.notify_errors,
        notify_risk=channel.notify_risk,
    )


@router.get("/telegram", response_model=TelegramStatusResponse)
def telegram_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _status(db, current_user.id)


@router.post("/telegram/connect", response_model=TelegramConnectResponse)
def telegram_connect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not telegram_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Telegram bot is not configured")
    connect_url, expires_at = create_link_token(db, current_user.id)
    return TelegramConnectResponse(connect_url=connect_url, expires_at=expires_at)


@router.patch("/telegram", response_model=TelegramStatusResponse)
def telegram_preferences(
    payload: TelegramPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    channel = update_preferences(db, current_user.id, **payload.model_dump(exclude_unset=True))
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Telegram is not connected")
    return _status(db, current_user.id)


@router.post("/telegram/test", response_model=TelegramTestResponse)
def telegram_test(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    channel = get_channel(db, current_user.id)
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Telegram is not connected")
    if not telegram_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Telegram bot is not configured")
    try:
        send_message_sync(
            channel.chat_id,
            "✅ AlgoTradeDynamics test notification\n\nTelegram notifications are configured correctly.",
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Telegram delivery failed: {exc}") from exc
    return TelegramTestResponse(message="Test notification sent")


@router.delete("/telegram", status_code=status.HTTP_204_NO_CONTENT)
def telegram_disconnect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    disconnect_channel(db, current_user.id)
    return None
