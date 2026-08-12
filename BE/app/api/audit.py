"""Read-only API for compliance audit records owned by the current user."""
from __future__ import annotations

import csv
import io
import json
import math
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.audit_event import AuditEvent
from app.models.user import User
from app.schemas.audit import AuditEventListResponse, AuditEventResponse, AuditIntegrityResponse
from app.services.audit_service import verify_user_audit_integrity

router = APIRouter(prefix="/audit", tags=["Compliance Audit"])


def _filtered_query(
    db: Session,
    user_id: int,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    category: str | None = None,
    event_type: str | None = None,
    bot_id: int | None = None,
    symbol: str | None = None,
    correlation_id: str | None = None,
):
    query = db.query(AuditEvent).filter(AuditEvent.user_id == user_id)
    if date_from is not None:
        query = query.filter(AuditEvent.occurred_at >= date_from)
    if date_to is not None:
        query = query.filter(AuditEvent.occurred_at <= date_to)
    if category:
        query = query.filter(AuditEvent.category == category.upper())
    if event_type:
        query = query.filter(AuditEvent.event_type == event_type.upper())
    if bot_id is not None:
        query = query.filter(AuditEvent.bot_id == bot_id)
    if symbol:
        query = query.filter(AuditEvent.symbol == symbol.upper())
    if correlation_id:
        query = query.filter(AuditEvent.correlation_id == correlation_id)
    return query


@router.get("/events", response_model=AuditEventListResponse)
def list_audit_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    category: str | None = None,
    event_type: str | None = None,
    bot_id: int | None = None,
    symbol: str | None = None,
    correlation_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _filtered_query(
        db, current_user.id, date_from=date_from, date_to=date_to, category=category,
        event_type=event_type, bot_id=bot_id, symbol=symbol, correlation_id=correlation_id,
    )
    total = query.count()
    items = query.order_by(desc(AuditEvent.occurred_at), desc(AuditEvent.id)).offset((page - 1) * page_size).limit(page_size).all()
    return AuditEventListResponse(items=items, page=page, page_size=page_size, total=total, pages=math.ceil(total / page_size) if total else 0)


@router.get("/events/{event_id}", response_model=AuditEventResponse)
def get_audit_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(AuditEvent).filter(AuditEvent.id == event_id, AuditEvent.user_id == current_user.id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="Audit event not found")
    return event


@router.get("/integrity", response_model=AuditIntegrityResponse)
def audit_integrity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    valid, checked, first_invalid = verify_user_audit_integrity(db, current_user.id)
    return AuditIntegrityResponse(
        valid=valid,
        checked_events=checked,
        first_invalid_event_id=first_invalid,
        message="Audit hash chain is valid" if valid else "Audit hash chain verification failed",
    )


@router.get("/export")
def export_audit_events(
    format: str = Query("csv", pattern="^(csv|json)$"),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    category: str | None = None,
    event_type: str | None = None,
    bot_id: int | None = None,
    symbol: str | None = None,
    correlation_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = _filtered_query(
        db, current_user.id, date_from=date_from, date_to=date_to, category=category,
        event_type=event_type, bot_id=bot_id, symbol=symbol, correlation_id=correlation_id,
    ).order_by(AuditEvent.occurred_at.asc(), AuditEvent.id.asc()).all()

    if format == "json":
        payload = [AuditEventResponse.model_validate(item).model_dump(mode="json") for item in events]
        return Response(
            content=json.dumps(payload, ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=audit-trail.json"},
        )

    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow([
        "id", "occurred_at", "actor_type", "actor_label", "category", "event_type", "message",
        "user_id", "bot_id", "exchange", "environment", "symbol", "order_link_id", "exchange_order_id",
        "side", "order_type", "order_role", "quantity", "filled_quantity", "price", "fee", "realized_pnl",
        "status", "correlation_id", "strategy_type", "strategy_version", "config_hash", "error_code", "error_type",
        "jurisdiction", "retention_until", "previous_hash", "event_hash", "payload_json",
    ])
    for item in events:
        writer.writerow([
            item.id, item.occurred_at.isoformat(), item.actor_type, item.actor_label, item.category, item.event_type,
            item.message, item.user_id, item.bot_id, item.exchange, item.environment, item.symbol, item.order_link_id,
            item.exchange_order_id, item.side, item.order_type, item.order_role, item.quantity, item.filled_quantity,
            item.price, item.fee, item.realized_pnl, item.status, item.correlation_id, item.strategy_type,
            item.strategy_version, item.config_hash, item.error_code, item.error_type, item.jurisdiction,
            item.retention_until.isoformat(), item.previous_hash, item.event_hash,
            json.dumps(item.payload, ensure_ascii=False, separators=(",", ":")) if item.payload is not None else "",
        ])
    return Response(
        content=stream.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=audit-trail.csv"},
    )
