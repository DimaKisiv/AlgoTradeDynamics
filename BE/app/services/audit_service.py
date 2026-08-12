"""Compliance-oriented, append-only audit trail service.

The service records normalized financial/system facts and chains every record to the
previous audit hash.  It is deliberately independent from ordinary bot event history:
clearing UI history does not remove compliance records.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import get_settings
from app.models.audit_event import AuditEvent
from app.models.trading_bot import TradingBot
from app.models.trading_bot_event import TradingBotEvent
from app.models.trading_bot_order import TradingBotOrder

_SENSITIVE_PARTS = (
    "password", "secret", "token", "authorization", "cookie", "api_key", "apikey",
    "private_key", "credential",
)


def _safe_number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def sanitize_payload(value: Any, *, depth: int = 0) -> Any:
    """Remove secrets and keep JSON payloads reasonably small/serializable."""
    if depth > 8:
        return "[MAX_DEPTH]"
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for raw_key, raw_value in value.items():
            key = str(raw_key)
            lowered = key.lower()
            if any(part in lowered for part in _SENSITIVE_PARTS):
                result[key] = "[REDACTED]"
            else:
                result[key] = sanitize_payload(raw_value, depth=depth + 1)
        return result
    if isinstance(value, (list, tuple, set)):
        return [sanitize_payload(item, depth=depth + 1) for item in list(value)[:200]]
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat() if value.tzinfo else value.replace(tzinfo=timezone.utc).isoformat()
    if isinstance(value, (str, int, float, bool)) or value is None:
        if isinstance(value, str) and len(value) > 5000:
            return value[:5000] + "…"
        return value
    return str(value)


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(sanitize_payload(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def bot_config_snapshot(bot: TradingBot) -> tuple[dict[str, Any], str, str | None]:
    """Return immutable strategy configuration snapshot, hash and revision."""
    try:
        from app.bot_engine.strategies import get_strategy
        settings = get_strategy(bot.strategy_type).get_effective_settings(bot)
    except Exception:  # pragma: no cover - defensive fallback for unsupported legacy bots
        settings = dict(bot.settings or {})
    snapshot = sanitize_payload({
        "strategy_type": bot.strategy_type,
        "category": bot.category,
        "symbol": bot.symbol,
        "order_qty": bot.order_qty,
        "grid_orders_count": bot.grid_orders_count,
        "grid_step_percent": bot.grid_step_percent,
        "settings": settings,
    })
    revision = None
    if isinstance(settings, dict) and settings.get("strategy_revision") is not None:
        revision = str(settings.get("strategy_revision"))
    return snapshot, canonical_hash(snapshot), revision




def config_diff(before: Any, after: Any, *, prefix: str = "") -> list[dict[str, Any]]:
    """Return a compact explicit before/after diff for immutable config audit."""
    changes: list[dict[str, Any]] = []
    if isinstance(before, dict) and isinstance(after, dict):
        for key in sorted(set(before) | set(after)):
            path = f"{prefix}.{key}" if prefix else str(key)
            if key not in before:
                changes.append({"field": path, "before": None, "after": sanitize_payload(after[key])})
            elif key not in after:
                changes.append({"field": path, "before": sanitize_payload(before[key]), "after": None})
            else:
                changes.extend(config_diff(before[key], after[key], prefix=path))
        return changes
    if before != after:
        changes.append({"field": prefix or "value", "before": sanitize_payload(before), "after": sanitize_payload(after)})
    return changes

def _event_hash_payload(event: AuditEvent) -> dict[str, Any]:
    return {
        "occurred_at": event.occurred_at,
        "recorded_at": event.recorded_at,
        "user_id": event.user_id,
        "bot_id": event.bot_id,
        "source_event_id": event.source_event_id,
        "actor_type": event.actor_type,
        "actor_label": event.actor_label,
        "category": event.category,
        "event_type": event.event_type,
        "message": event.message,
        "exchange": event.exchange,
        "environment": event.environment,
        "symbol": event.symbol,
        "order_link_id": event.order_link_id,
        "exchange_order_id": event.exchange_order_id,
        "side": event.side,
        "order_type": event.order_type,
        "order_role": event.order_role,
        "quantity": event.quantity,
        "filled_quantity": event.filled_quantity,
        "price": event.price,
        "fee": event.fee,
        "realized_pnl": event.realized_pnl,
        "status": event.status,
        "correlation_id": event.correlation_id,
        "strategy_type": event.strategy_type,
        "strategy_version": event.strategy_version,
        "config_hash": event.config_hash,
        "ip_address": event.ip_address,
        "user_agent": event.user_agent,
        "error_code": event.error_code,
        "error_type": event.error_type,
        "payload": event.payload,
        "jurisdiction": event.jurisdiction,
        "retention_until": event.retention_until,
        "previous_hash": event.previous_hash,
    }


def _hash_event(event: AuditEvent) -> str:
    return canonical_hash(_event_hash_payload(event))


def record_audit_event(
    db: Session,
    *,
    actor_type: str,
    category: str,
    event_type: str,
    message: str,
    occurred_at: datetime | None = None,
    user_id: int | None = None,
    bot_id: int | None = None,
    source_event_id: int | None = None,
    actor_label: str | None = None,
    exchange: str | None = None,
    environment: str | None = None,
    symbol: str | None = None,
    order_link_id: str | None = None,
    exchange_order_id: str | None = None,
    side: str | None = None,
    order_type: str | None = None,
    order_role: str | None = None,
    quantity: float | None = None,
    filled_quantity: float | None = None,
    price: float | None = None,
    fee: float | None = None,
    realized_pnl: float | None = None,
    status: str | None = None,
    correlation_id: str | None = None,
    strategy_type: str | None = None,
    strategy_version: str | None = None,
    config_hash: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    error_code: str | None = None,
    error_type: str | None = None,
    payload: dict[str, Any] | None = None,
) -> AuditEvent:
    settings = get_settings()
    now = utcnow()
    occurred = occurred_at or now
    if occurred.tzinfo is None:
        occurred = occurred.replace(tzinfo=timezone.utc)

    # On PostgreSQL this locks the current tail row for the duration of the
    # transaction, preventing two normal writers from extending the same tail.
    tail_query = db.query(AuditEvent).order_by(desc(AuditEvent.id))
    try:
        tail = tail_query.with_for_update().first()
    except Exception:  # SQLite / unusual dialect fallback
        tail = tail_query.first()

    event = AuditEvent(
        occurred_at=occurred,
        recorded_at=now,
        user_id=user_id,
        bot_id=bot_id,
        source_event_id=source_event_id,
        actor_type=str(actor_type).upper()[:20],
        actor_label=(actor_label or None),
        category=str(category).upper()[:40],
        event_type=str(event_type).upper()[:80],
        message=str(message)[:500],
        exchange=exchange,
        environment=environment,
        symbol=symbol,
        order_link_id=order_link_id,
        exchange_order_id=exchange_order_id,
        side=side,
        order_type=order_type,
        order_role=order_role,
        quantity=_safe_number(quantity),
        filled_quantity=_safe_number(filled_quantity),
        price=_safe_number(price),
        fee=_safe_number(fee),
        realized_pnl=_safe_number(realized_pnl),
        status=status,
        correlation_id=(correlation_id or None),
        strategy_type=strategy_type,
        strategy_version=strategy_version,
        config_hash=config_hash,
        ip_address=(ip_address or None),
        user_agent=(user_agent or None)[:500] if user_agent else None,
        error_code=(str(error_code)[:40] if error_code is not None else None),
        error_type=(str(error_type)[:40] if error_type is not None else None),
        payload=sanitize_payload(payload) if payload is not None else None,
        jurisdiction=settings.audit_jurisdiction,
        retention_until=now + timedelta(days=max(settings.audit_retention_years, 1) * 365),
        previous_hash=tail.event_hash if tail else None,
        event_hash="",
    )
    event.event_hash = _hash_event(event)
    db.add(event)
    db.flush()
    return event


def _event_category(event_type: str) -> str:
    name = event_type.lower()
    if "risk" in name:
        return "RISK"
    if "error" in name or "reject" in name:
        return "ERROR"
    if "signal" in name:
        return "STRATEGY"
    if any(part in name for part in ("position", "take_profit", "stop_loss", "scalper_exit")):
        return "POSITION"
    if any(part in name for part in ("order", "grid_entry", "cycle")):
        return "ORDER"
    if name.startswith("bot_"):
        return "BOT_LIFECYCLE"
    return "SYSTEM"


def _first_value(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if payload.get(key) not in (None, ""):
            return payload.get(key)
    return None


def _correlation_id(payload: dict[str, Any], bot: TradingBot, event: TradingBotEvent) -> str:
    explicit = _first_value(payload, "correlation_id", "order_link_id", "exit_order_link_id", "entry_order_link_id")
    if explicit:
        return f"order:{explicit}" if not str(explicit).startswith(("order:", "trade:", "bot:")) else str(explicit)
    for key in ("take_profit_order_link_ids", "cancelled_grid_order_link_ids"):
        values = payload.get(key)
        if isinstance(values, list) and values:
            return f"order:{values[0]}"
    return f"bot:{bot.id}:event:{event.id}"


def _find_order(db: Session, bot: TradingBot, payload: dict[str, Any]) -> TradingBotOrder | None:
    link_id = _first_value(payload, "order_link_id", "exit_order_link_id", "entry_order_link_id")
    if not link_id:
        return None
    return (
        db.query(TradingBotOrder)
        .filter(TradingBotOrder.bot_id == bot.id, TradingBotOrder.order_link_id == str(link_id))
        .order_by(desc(TradingBotOrder.id))
        .first()
    )


def _order_fee(order: TradingBotOrder | None, payload: dict[str, Any]) -> float | None:
    for source in (payload, (order.raw_response if order else {}) or {}):
        for key in ("execFee", "cumExecFee", "fee", "cumFee"):
            value = _safe_number(source.get(key))
            if value is not None:
                return value
    return None


def _exchange_response_snapshot(order: TradingBotOrder | None) -> dict[str, Any] | None:
    if order is None or not order.raw_response:
        return None
    raw = dict(order.raw_response)
    result = raw.get("result") if isinstance(raw.get("result"), dict) else {}
    snapshot = {
        "retCode": raw.get("retCode"),
        "retMsg": raw.get("retMsg"),
        "orderId": order.exchange_order_id or result.get("orderId") or raw.get("orderId"),
        "orderLinkId": order.order_link_id,
        "orderStatus": raw.get("orderStatus") or order.status,
        "rejectReason": raw.get("rejectReason"),
        "cumExecQty": raw.get("cumExecQty"),
        "avgPrice": raw.get("avgPrice"),
        "cumExecFee": raw.get("cumExecFee"),
        "execFee": raw.get("execFee"),
    }
    return {key: value for key, value in snapshot.items() if value not in (None, "")}


def record_bot_event_audit(db: Session, bot: TradingBot, event: TradingBotEvent) -> AuditEvent | None:
    """Mirror a meaningful non-backtest runtime event into the immutable ledger."""
    if bot.is_backtest:
        return None
    payload = dict(event.payload or {})
    order = _find_order(db, bot, payload)
    config_snapshot, config_hash, revision = bot_config_snapshot(bot)

    exchange_order_id = order.exchange_order_id if order else _first_value(payload, "exchange_order_id", "order_id")
    order_link_id = order.order_link_id if order else _first_value(payload, "order_link_id", "exit_order_link_id", "entry_order_link_id")
    realized_pnl = _first_value(payload, "realized_pnl", "closed_pnl", "pnl", "net_pnl")
    event_payload = {
        "runtime_event": payload,
        "bot": {"id": bot.id, "name": bot.name},
        # Keep the ledger compact: every runtime event carries the config hash,
        # while full immutable configuration snapshots are written only when a
        # bot is created or its configuration changes.
        "strategy_config_hash": config_hash,
        "strategy_revision": revision,
    }
    if order is not None:
        event_payload["order_snapshot"] = {
            "id": order.id,
            "status": order.status,
            "exchange_order_id": order.exchange_order_id,
            "order_link_id": order.order_link_id,
            "side": order.side,
            "order_type": order.order_type,
            "order_role": order.order_role,
            "qty": order.qty,
            "filled_qty": order.filled_qty,
            "price": order.price,
        }
        exchange_snapshot = _exchange_response_snapshot(order)
        if exchange_snapshot:
            event_payload["exchange_response"] = exchange_snapshot

    return record_audit_event(
        db,
        actor_type="BOT",
        actor_label=bot.name,
        category=_event_category(event.event_type),
        event_type=event.event_type,
        message=event.message,
        occurred_at=event.created_at,
        user_id=bot.user_id,
        bot_id=bot.id,
        source_event_id=event.id,
        exchange=bot.exchange,
        environment=bot.environment,
        symbol=bot.symbol,
        order_link_id=str(order_link_id) if order_link_id else None,
        exchange_order_id=str(exchange_order_id) if exchange_order_id else None,
        side=(order.side if order else _first_value(payload, "side")),
        order_type=(order.order_type if order else _first_value(payload, "order_type")),
        order_role=(order.order_role if order else _first_value(payload, "role", "order_role")),
        quantity=(order.qty if order else _first_value(payload, "qty", "quantity")),
        filled_quantity=(order.filled_qty if order else _first_value(payload, "filled_qty", "filled_quantity")),
        price=(order.price if order and order.price is not None else _first_value(payload, "price", "entry_price", "current_price")),
        fee=_order_fee(order, payload),
        realized_pnl=realized_pnl,
        status=(order.status if order else _first_value(payload, "status")),
        correlation_id=_correlation_id(payload, bot, event),
        strategy_type=bot.strategy_type,
        strategy_version=revision,
        config_hash=config_hash,
        error_code=_first_value(payload, "code", "ret_code", "error_code"),
        error_type=_first_value(payload, "type", "error_type"),
        payload=event_payload,
    )


def record_user_bot_action(
    db: Session,
    *,
    user_id: int,
    user_email: str,
    bot: TradingBot,
    event_type: str,
    message: str,
    payload: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditEvent:
    snapshot, config_hash, revision = bot_config_snapshot(bot)
    merged = {"bot": {"id": bot.id, "name": bot.name}, "strategy_config_hash": config_hash}
    if event_type.upper() in {"BOT_CREATED", "BOT_CONFIG_CHANGED"}:
        merged["strategy_config"] = snapshot
    if payload:
        merged.update(payload)
    if event_type.upper() == "BOT_CONFIG_CHANGED":
        before_config = merged.get("before_config")
        before_hash = merged.get("before_config_hash")
        if isinstance(before_config, dict):
            merged["changes"] = config_diff(before_config, snapshot)
            merged["before_config_hash"] = before_hash or canonical_hash(before_config)
            merged["after_config_hash"] = config_hash
            merged["after_config"] = snapshot
    return record_audit_event(
        db,
        actor_type="USER",
        actor_label=user_email,
        category="BOT_CONFIGURATION" if "CONFIG" in event_type.upper() or "CREAT" in event_type.upper() or "DELET" in event_type.upper() else "BOT_LIFECYCLE",
        event_type=event_type,
        message=message,
        user_id=user_id,
        bot_id=bot.id,
        exchange=bot.exchange,
        environment=bot.environment,
        symbol=bot.symbol,
        strategy_type=bot.strategy_type,
        strategy_version=revision,
        config_hash=config_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        correlation_id=f"bot:{bot.id}",
        payload=merged,
    )


def verify_user_audit_integrity(db: Session, user_id: int) -> tuple[bool, int, int | None]:
    events = db.query(AuditEvent).filter(AuditEvent.user_id == user_id).order_by(AuditEvent.id.asc()).all()
    for event in events:
        if _hash_event(event) != event.event_hash:
            return False, len(events), event.id
        if event.previous_hash:
            predecessor = db.query(AuditEvent.id).filter(AuditEvent.event_hash == event.previous_hash).first()
            if predecessor is None:
                return False, len(events), event.id
    return True, len(events), None


def extract_bot_id_from_path(path: str) -> int | None:
    match = re.search(r"/bots/(\d+)", path)
    return int(match.group(1)) if match else None
