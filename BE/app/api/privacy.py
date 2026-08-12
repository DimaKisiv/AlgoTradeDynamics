"""GDPR-oriented personal-data export and account-deletion controls."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import verify_password
from app.db.session import get_db
from app.models.audit_event import AuditEvent
from app.models.backtest import BacktestRun
from app.models.operations import Incident, OperationLog
from app.models.telegram_notification import TelegramNotificationChannel, TelegramNotificationDelivery
from app.models.trading_bot import TradingBot
from app.models.trading_bot_event import TradingBotEvent
from app.models.trading_bot_order import TradingBotOrder
from app.models.user import User
from app.schemas.compliance import AccountDeleteRequest
from app.services.audit_service import record_audit_event, sanitize_payload

router = APIRouter(prefix="/privacy", tags=["Privacy & GDPR"])


def _json_value(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    return value


def _row(obj, *, exclude: set[str] | None = None) -> dict:
    excluded = exclude or set()
    data = {}
    for attr in inspect(obj.__class__).mapper.column_attrs:
        key = attr.key
        if key in excluded:
            continue
        data[key] = _json_value(getattr(obj, key))
    return sanitize_payload(data)


@router.get("/export")
def export_my_data(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export user-related application data without credentials or refresh secrets."""
    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "scope": "AlgoTradeDynamics user-related data export",
        "profile": {
            "id": current_user.id,
            "email": current_user.email,
            "created_at": _json_value(current_user.created_at),
        },
        "trading_bots": [_row(x) for x in db.query(TradingBot).filter(TradingBot.user_id == current_user.id).all()],
        "orders": [_row(x, exclude={"raw_response"}) for x in db.query(TradingBotOrder).filter(TradingBotOrder.user_id == current_user.id).all()],
        "bot_events": [_row(x) for x in db.query(TradingBotEvent).filter(TradingBotEvent.user_id == current_user.id).all()],
        "backtests": [_row(x) for x in db.query(BacktestRun).filter(BacktestRun.user_id == current_user.id).all()],
        "telegram_channel": None,
        "telegram_delivery_history": [_row(x) for x in db.query(TelegramNotificationDelivery).filter(TelegramNotificationDelivery.user_id == current_user.id).all()],
        "operations_logs": [_row(x) for x in db.query(OperationLog).filter(OperationLog.user_id == current_user.id).all()],
        "incidents": [_row(x) for x in db.query(Incident).filter(Incident.user_id == current_user.id).all()],
        "regulatory_audit": [_row(x) for x in db.query(AuditEvent).filter(AuditEvent.user_id == current_user.id).order_by(AuditEvent.id.asc()).all()],
        "notes": [
            "Passwords, password hashes, refresh-token hashes, API secrets and authorization credentials are excluded.",
            "Regulatory audit records are included in the export but may be retained after account deletion according to the configured retention policy.",
        ],
    }
    channel = db.query(TelegramNotificationChannel).filter(TelegramNotificationChannel.user_id == current_user.id).first()
    if channel is not None:
        payload["telegram_channel"] = _row(channel)

    ip = request.client.host if request.client else None
    record_audit_event(
        db,
        actor_type="USER",
        actor_label=current_user.email,
        category="PRIVACY",
        event_type="PERSONAL_DATA_EXPORTED",
        message="User exported personal/application data",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=request.headers.get("user-agent"),
        correlation_id=f"user:{current_user.id}",
    )
    db.commit()

    raw = json.dumps(payload, ensure_ascii=False, indent=2, default=str).encode("utf-8")
    filename = f"algotradedynamics-user-{current_user.id}-data.json"
    return Response(
        content=raw,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/delete-account", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    payload: AccountDeleteRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.confirmation != "DELETE":
        raise HTTPException(status_code=422, detail="Confirmation must be DELETE")
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid password")

    user_id = current_user.id
    user_email = current_user.email
    record_audit_event(
        db,
        actor_type="USER",
        actor_label=user_email,
        category="PRIVACY",
        event_type="ACCOUNT_DELETION_REQUESTED",
        message="User confirmed account deletion; regulatory audit records remain subject to retention policy",
        user_id=user_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        correlation_id=f"user:{user_id}",
        payload={"operational_data_deleted": True, "regulatory_audit_retained": True},
    )
    # Operational observability records are not the immutable regulatory ledger.
    db.query(OperationLog).filter(OperationLog.user_id == user_id).delete(synchronize_session=False)
    db.query(Incident).filter(Incident.user_id == user_id).delete(synchronize_session=False)
    db.delete(current_user)  # ORM cascades profile-owned bots/backtests/orders/events/tokens/Telegram data.
    db.commit()

    settings = get_settings()
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path="/api/auth",
        secure=settings.refresh_cookie_secure,
        httponly=True,
        samesite=settings.refresh_cookie_samesite,
    )
    return None
