"""Continuous grid bot runtime helpers."""
from __future__ import annotations

from datetime import datetime, timezone
import re

from sqlalchemy import desc

from app.bot_engine.bybit.client import get_bybit_session
from app.bot_engine.events import log_bot_event
from app.bot_engine.market_data import get_instrument_rules, get_last_price
from app.bot_engine.orders import (
    ACTIVE_ORDER_STATUSES,
    FINAL_ORDER_STATUSES,
    OrderRequest,
    cancel_order_by_link_id,
    get_open_orders,
    get_orders_by_prefix,
    normalize_order_request,
    place_order,
    validate_order_request,
)
from app.bot_engine.positions import get_open_positions
from app.models.trading_bot import TradingBot
from app.models.trading_bot_order import TradingBotOrder


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_bot_setting(bot: TradingBot, key: str, default):
    if bot.settings and key in bot.settings:
        return bot.settings[key]
    return default


def get_order_link_generation(bot: TradingBot) -> int:
    generation = getattr(bot, "order_link_generation", 1) or 1
    return max(int(generation), 1)


def get_order_link_prefix(bot: TradingBot) -> str:
    return f"bot-{bot.id}-g{get_order_link_generation(bot)}-"


def get_legacy_order_link_prefix(bot: TradingBot) -> str:
    return f"bot-{bot.id}-"


ENTRY_LINK_RE = re.compile(
    r"^bot-(?P<bot_id>\d+)(?:-g(?P<generation>\d+))?-entry-(?P<level>\d+)-(?P<cycle>\d+)$")
TP_LINK_RE = re.compile(
    r"^bot-(?P<bot_id>\d+)(?:-g(?P<generation>\d+))?-tp-for-(?P<entry_id>\d+)$")
POSITION_TP_LINK_RE = re.compile(
    r"^bot-(?P<bot_id>\d+)(?:-g(?P<generation>\d+))?-position-tp(?:-(?P<timestamp_ms>\d+))?$")
POSITION_TP_ROLE = "position_take_profit"
LEGACY_TP_ROLE_PREFIXES = ("take_profit_", "tp_")


def _level_role(level_index: int) -> str:
    return f"grid_entry_{level_index}"


def _position_tp_link_prefix(bot: TradingBot) -> str:
    return f"{get_order_link_prefix(bot)}position-tp"


def _legacy_position_tp_link_prefix(bot: TradingBot) -> str:
    return f"bot-{bot.id}-position-tp"


def _position_tp_link_id(bot: TradingBot) -> str:
    timestamp_ms = int(_utcnow().timestamp() * 1000)
    return f"{_position_tp_link_prefix(bot)}-{timestamp_ms}"


def _is_legacy_take_profit_role(order_role: str) -> bool:
    if order_role == POSITION_TP_ROLE:
        return False
    if order_role == "take_profit_recovered":
        return True
    return order_role.startswith(LEGACY_TP_ROLE_PREFIXES)


def _is_current_generation_link_id(bot: TradingBot, order_link_id: str | None) -> bool:
    return bool(order_link_id) and order_link_id.startswith(get_order_link_prefix(bot))


def _is_position_tp_link_id_for_bot(bot: TradingBot, order_link_id: str | None) -> bool:
    if not order_link_id:
        return False
    match = POSITION_TP_LINK_RE.match(order_link_id)
    if not match:
        return False
    if int(match.group("bot_id")) != bot.id:
        return False
    generation = match.group("generation")
    return generation is None or int(generation) == get_order_link_generation(bot)


def _is_current_generation_position_tp_link_id(bot: TradingBot, order_link_id: str | None) -> bool:
    return bool(order_link_id) and order_link_id.startswith(_position_tp_link_prefix(bot))


def _next_cycle_id(db, bot: TradingBot, order_role: str) -> int:
    existing = (
        db.query(TradingBotOrder)
        .filter(TradingBotOrder.bot_id == bot.id, TradingBotOrder.order_role == order_role)
        .count()
    )
    return existing + 1


def _active_order_exists(db, bot: TradingBot, order_link_id: str) -> bool:
    return (
        db.query(TradingBotOrder)
        .filter(
            TradingBotOrder.bot_id == bot.id,
            TradingBotOrder.order_link_id == order_link_id,
            TradingBotOrder.status.in_(ACTIVE_ORDER_STATUSES),
        )
        .first()
        is not None
    )


def _infer_order_fields_from_link_id(order_link_id: str) -> tuple[str, int | None]:
    entry_match = ENTRY_LINK_RE.match(order_link_id)
    if entry_match:
        level = int(entry_match.group("level"))
        return _level_role(level), None

    position_tp_match = POSITION_TP_LINK_RE.match(order_link_id)
    if position_tp_match:
        return POSITION_TP_ROLE, None

    tp_match = TP_LINK_RE.match(order_link_id)
    if tp_match:
        entry_id = int(tp_match.group("entry_id"))
        return "take_profit_recovered", entry_id

    return "recovered", None


def _record_order(db, bot: TradingBot, order: OrderRequest, response: dict, *, status_override: str | None = None) -> TradingBotOrder:
    result = response.get("result", {})
    existing = None
    if order.order_link_id:
        existing = (
            db.query(TradingBotOrder)
            .filter(TradingBotOrder.bot_id == bot.id, TradingBotOrder.order_link_id == order.order_link_id)
            .first()
        )
    record = existing or TradingBotOrder(
        bot_id=bot.id,
        user_id=bot.user_id,
        exchange=bot.exchange,
        environment=bot.environment,
        category=bot.category,
        symbol=bot.symbol,
        side=order.side,
        order_type=order.order_type,
        order_role=order.order_role,
        order_link_id=order.order_link_id,
        qty=order.qty,
        parent_order_id=order.parent_order_id,
    )
    record.price = order.price
    record.exchange_order_id = result.get(
        "orderId") or record.exchange_order_id
    record.status = status_override or result.get(
        "orderStatus") or response.get("retMsg") or record.status or "New"
    payload = dict(response or {})
    payload.update({
        "orderLinkId": order.order_link_id,
        "side": order.side,
        "orderType": order.order_type,
        "qty": str(order.qty),
        "price": str(order.price) if order.price is not None else None,
        "reduceOnly": order.reduce_only,
    })
    record.raw_response = payload
    db.add(record)
    db.flush()
    return record


def _update_local_order_from_exchange(record: TradingBotOrder, payload: dict) -> None:
    record.exchange_order_id = payload.get(
        "orderId") or record.exchange_order_id
    record.order_link_id = payload.get("orderLinkId") or record.order_link_id
    record.side = payload.get("side") or record.side
    record.order_type = payload.get("orderType") or record.order_type
    record.status = payload.get("orderStatus") or record.status
    if payload.get("qty") is not None:
        record.qty = float(payload["qty"])
    if payload.get("cumExecQty") is not None:
        record.filled_qty = float(payload["cumExecQty"])
    elif payload.get("leavesQty") is not None:
        try:
            record.filled_qty = max(
                record.qty - float(payload["leavesQty"]), 0)
        except (TypeError, ValueError):
            pass
    if payload.get("price"):
        record.price = float(payload["price"])
    existing_payload = dict(record.raw_response or {})
    existing_payload.update(payload)
    record.raw_response = existing_payload


def _mark_order_filled_logged(record: TradingBotOrder) -> None:
    if record.filled_event_logged_at is None:
        record.filled_event_logged_at = _utcnow()


def _status_change_payload(record: TradingBotOrder, old_status: str, new_status: str) -> dict:
    return {
        "order": record,
        "old_status": old_status,
        "new_status": new_status,
        "status_changed": old_status != new_status,
        "became_filled": old_status != "Filled" and new_status == "Filled",
    }


def _build_grid_entry_order(db, bot: TradingBot, level_index: int, current_price: float) -> OrderRequest:
    role = _level_role(level_index)
    cycle_id = _next_cycle_id(db, bot, role)
    price = current_price * \
        (1 - ((bot.grid_step_percent / 100) * (level_index - 1)))
    return OrderRequest(
        side="Buy",
        order_type="Limit",
        order_role=role,
        order_link_id=f"{get_order_link_prefix(bot)}entry-{level_index}-{cycle_id}",
        qty=bot.order_qty,
        price=price,
    )


def _get_current_long_position(session, *, category: str, symbol: str) -> dict | None:
    for position in get_open_positions(session, category=category, symbol=symbol):
        try:
            size = float(position.get("size") or position.get("qty") or 0)
        except (TypeError, ValueError):
            continue
        if size <= 0:
            continue

        side = str(position.get("side") or position.get(
            "positionSide") or "").lower()
        if side and side not in {"buy", "long"}:
            continue

        avg_entry_value = position.get(
            "avgPrice") or position.get("avgEntryPrice") or 0
        try:
            avg_entry_price = float(avg_entry_value)
        except (TypeError, ValueError):
            continue
        if avg_entry_price <= 0:
            continue

        return {
            "size": size,
            "avg_entry_price": avg_entry_price,
            "raw": position,
        }
    return None


def _build_position_take_profit_order(bot: TradingBot, position_size: float, avg_entry_price: float) -> OrderRequest:
    take_profit_percent = float(
        get_bot_setting(bot, "take_profit_percent", 1.5))
    tp_price = avg_entry_price * (1 + take_profit_percent / 100)
    return OrderRequest(
        side="Sell",
        order_type="Limit",
        order_role=POSITION_TP_ROLE,
        order_link_id=_position_tp_link_id(bot),
        qty=position_size,
        price=tp_price,
        reduce_only=True,
    )


def _active_orders_by_role(db, bot: TradingBot, order_role: str) -> list[TradingBotOrder]:
    return (
        db.query(TradingBotOrder)
        .filter(
            TradingBotOrder.bot_id == bot.id,
            TradingBotOrder.order_role == order_role,
            TradingBotOrder.status.in_(ACTIVE_ORDER_STATUSES),
        )
        .order_by(desc(TradingBotOrder.id))
        .all()
    )


def _active_position_take_profit_orders(db, bot: TradingBot) -> list[TradingBotOrder]:
    return [
        order
        for order in _active_orders_by_role(db, bot, POSITION_TP_ROLE)
        if _is_position_tp_link_id_for_bot(bot, order.order_link_id)
    ]


def _active_legacy_take_profit_orders(db, bot: TradingBot) -> list[TradingBotOrder]:
    return [
        order
        for order in db.query(TradingBotOrder)
        .filter(
            TradingBotOrder.bot_id == bot.id,
            TradingBotOrder.status.in_(ACTIVE_ORDER_STATUSES),
        )
        .order_by(desc(TradingBotOrder.id))
        .all()
        if _is_legacy_take_profit_role(order.order_role)
    ]


def _attach_position_take_profit_snapshot(record: TradingBotOrder, position: dict, order: OrderRequest) -> None:
    payload = dict(record.raw_response or {})
    payload.update({
        "reduceOnly": True,
        "positionSize": position["size"],
        "avgEntryPrice": position["avg_entry_price"],
        "tpQty": order.qty,
        "tpPrice": order.price,
    })
    record.raw_response = payload


def _cancel_local_order(db, bot: TradingBot, session, order: TradingBotOrder, *, event_type: str, message: str) -> TradingBotOrder:
    response = cancel_order_by_link_id(
        session,
        category=bot.category,
        symbol=bot.symbol,
        order_link_id=order.order_link_id,
    )
    order.status = "Cancelled"
    payload = dict(order.raw_response or {})
    payload.update(response)
    order.raw_response = payload
    db.add(order)
    log_bot_event(db, bot, event_type, message, {
                  "order_link_id": order.order_link_id})
    return order


def _order_matches_target(order: TradingBotOrder, target: OrderRequest) -> bool:
    price_matches = order.price == target.price
    qty_matches = order.qty == target.qty
    reduce_only = bool((order.raw_response or {}).get("reduceOnly"))
    return price_matches and qty_matches and reduce_only


def _response_ret_code(response: dict) -> str | None:
    ret_code = response.get("retCode")
    if ret_code is None:
        return None
    return str(ret_code)


def _is_duplicate_order_link_error(response: dict) -> bool:
    return _response_ret_code(response) == "110072"


def _upsert_remote_order(db, bot: TradingBot, remote: dict) -> TradingBotOrder | None:
    order_link_id = remote.get("orderLinkId")
    if not order_link_id:
        return None
    record = (
        db.query(TradingBotOrder)
        .filter(TradingBotOrder.bot_id == bot.id, TradingBotOrder.order_link_id == order_link_id)
        .first()
    )
    if record is None:
        inferred_role, parent_order_id = _infer_order_fields_from_link_id(
            order_link_id)
        record = TradingBotOrder(
            bot_id=bot.id,
            user_id=bot.user_id,
            exchange=bot.exchange,
            environment=bot.environment,
            category=bot.category,
            symbol=bot.symbol,
            side=remote.get("side") or "Buy",
            order_type=remote.get("orderType") or "Limit",
            order_role=inferred_role,
            order_link_id=order_link_id,
            qty=float(remote.get("qty") or 0),
            parent_order_id=parent_order_id,
            status=remote.get("orderStatus") or "New",
            raw_response=remote,
        )
        db.add(record)
        db.flush()
    _update_local_order_from_exchange(record, remote)
    db.add(record)
    return record


def _sync_exchange_open_position_take_profit_orders(db, bot: TradingBot, session) -> list[TradingBotOrder]:
    synced: list[TradingBotOrder] = []
    for remote in get_open_orders(session, category=bot.category, symbol=bot.symbol):
        order_link_id = remote.get("orderLinkId")
        if not _is_position_tp_link_id_for_bot(bot, order_link_id):
            continue
        if remote.get("side") != "Sell":
            continue
        if not bool(remote.get("reduceOnly")):
            continue
        if (remote.get("orderStatus") or "") not in ACTIVE_ORDER_STATUSES:
            continue
        record = _upsert_remote_order(db, bot, remote)
        if record is not None:
            synced.append(record)
    db.flush()
    return synced


def sync_position_take_profit(db, bot: TradingBot) -> tuple[list[TradingBotOrder], float]:
    session = get_bybit_session(bot)
    rules = get_instrument_rules(
        session, category=bot.category, symbol=bot.symbol)
    position = _get_current_long_position(
        session, category=bot.category, symbol=bot.symbol)

    _sync_exchange_open_position_take_profit_orders(db, bot, session)

    active_position_tps = _active_position_take_profit_orders(db, bot)
    legacy_tp_orders = _active_legacy_take_profit_orders(db, bot)
    changed_orders: list[TradingBotOrder] = []

    for legacy_order in legacy_tp_orders:
        changed_orders.append(
            _cancel_local_order(
                db,
                bot,
                session,
                legacy_order,
                event_type="position_take_profit_cancelled",
                message="Cancelled legacy take-profit order",
            )
        )

    if position is None:
        for active_tp in active_position_tps:
            changed_orders.append(
                _cancel_local_order(
                    db,
                    bot,
                    session,
                    active_tp,
                    event_type="position_take_profit_cancelled",
                    message="Cancelled position take-profit order",
                )
            )
        return changed_orders, 0.0

    target_order = normalize_order_request(
        _build_position_take_profit_order(
            bot, position["size"], position["avg_entry_price"]),
        rules,
    )
    validation_error = validate_order_request(target_order, rules)
    if validation_error:
        log_bot_event(db, bot, "error", validation_error, {
                      "order_link_id": target_order.order_link_id})
        return changed_orders, position["size"]

    matching_tp = None
    for active_tp in active_position_tps:
        if matching_tp is None and _order_matches_target(active_tp, target_order):
            matching_tp = active_tp
            _attach_position_take_profit_snapshot(
                active_tp, position, target_order)
            db.add(active_tp)
            continue
        changed_orders.append(
            _cancel_local_order(
                db,
                bot,
                session,
                active_tp,
                event_type="position_take_profit_cancelled",
                message="Cancelled outdated position take-profit order",
            )
        )

    if matching_tp is not None:
        return changed_orders, position["size"]

    response = place_order(session, category=bot.category,
                           symbol=bot.symbol, order=target_order)
    if _is_duplicate_order_link_error(response):
        log_bot_event(db, bot, "error", "Duplicate position TP orderLinkId rejected by Bybit", {
            "order_link_id": target_order.order_link_id,
            "ret_code": _response_ret_code(response),
        })
        return changed_orders, position["size"]
    created = _record_order(db, bot, target_order, response)
    _attach_position_take_profit_snapshot(created, position, target_order)
    db.add(created)
    changed_orders.append(created)

    event_type = "position_take_profit_updated" if active_position_tps else "position_take_profit_created"
    message = "Updated position take-profit order" if active_position_tps else "Created position take-profit order"
    log_bot_event(db, bot, event_type, message, {
                  "order_link_id": target_order.order_link_id})
    return changed_orders, position["size"]


def _should_tick(bot: TradingBot) -> bool:
    interval = int(get_bot_setting(bot, "run_interval_seconds", 10))
    if bot.last_run_at is None:
        return True
    return (_utcnow() - bot.last_run_at).total_seconds() >= interval


def sync_bot_orders(db, bot: TradingBot, *, include_legacy: bool = False) -> list[dict]:
    session = get_bybit_session(bot)
    prefixes = [get_order_link_prefix(bot)]
    if include_legacy:
        prefixes.append(get_legacy_order_link_prefix(bot))

    remote_by_link: dict[str, dict] = {}
    for prefix in prefixes:
        for remote in get_orders_by_prefix(
            session,
            category=bot.category,
            symbol=bot.symbol,
            order_link_prefix=prefix,
        ):
            order_link_id = remote.get("orderLinkId")
            if not order_link_id:
                continue
            if not include_legacy and not _is_current_generation_link_id(bot, order_link_id):
                continue
            remote_by_link[order_link_id] = remote
    local_by_link = {
        order.order_link_id: order
        for order in db.query(TradingBotOrder)
        .filter(TradingBotOrder.bot_id == bot.id, TradingBotOrder.user_id == bot.user_id)
        .all()
        if order.order_link_id
    }

    changes: list[dict] = []

    for order_link_id, remote in remote_by_link.items():
        record = local_by_link.get(order_link_id)
        if record is None:
            record = _upsert_remote_order(db, bot, remote)
            if record is None:
                continue
            local_by_link[order_link_id] = record
        old_status = record.status
        _update_local_order_from_exchange(record, remote)
        new_status = record.status
        db.add(record)
        changes.append(_status_change_payload(record, old_status, new_status))

    db.flush()
    return changes


def create_missing_grid_entries(db, bot: TradingBot, current_position_size: float = 0.0) -> list[TradingBotOrder]:
    created_orders: list[TradingBotOrder] = []
    session = get_bybit_session(bot)
    current_price = get_last_price(
        session, category=bot.category, symbol=bot.symbol)
    rules = get_instrument_rules(
        session, category=bot.category, symbol=bot.symbol)

    max_open_orders = int(get_bot_setting(bot, "max_open_orders", 10))
    max_position_qty = float(get_bot_setting(bot, "max_position_qty", 0.3))
    active_local_orders = (
        db.query(TradingBotOrder)
        .filter(
            TradingBotOrder.bot_id == bot.id,
            TradingBotOrder.status.in_(ACTIVE_ORDER_STATUSES),
        )
        .all()
    )
    current_active_qty = sum(
        order.qty for order in active_local_orders if order.side == "Buy")

    for level_index in range(1, bot.grid_orders_count + 1):
        role = _level_role(level_index)
        last_entry = (
            db.query(TradingBotOrder)
            .filter(TradingBotOrder.bot_id == bot.id, TradingBotOrder.order_role == role)
            .order_by(desc(TradingBotOrder.id))
            .first()
        )

        if last_entry and last_entry.status in ACTIVE_ORDER_STATUSES:
            continue
        if last_entry and last_entry.status == "Filled":
            if current_position_size > 0:
                continue

        if len(active_local_orders) + len(created_orders) >= max_open_orders:
            break
        if current_active_qty + bot.order_qty > max_position_qty:
            break

        order = normalize_order_request(_build_grid_entry_order(
            db, bot, level_index, current_price), rules)
        validation_error = validate_order_request(order, rules)
        if validation_error:
            log_bot_event(db, bot, "error", validation_error, {
                          "order_link_id": order.order_link_id})
            continue
        if _active_order_exists(db, bot, order.order_link_id):
            continue

        response = place_order(
            session, category=bot.category, symbol=bot.symbol, order=order)
        created = _record_order(db, bot, order, response)
        created_orders.append(created)
        current_active_qty += created.qty
        log_bot_event(db, bot, "grid_entry_created", "Created grid entry order", {
                      "order_link_id": order.order_link_id})

    return created_orders


def cancel_all_bot_orders(db, bot: TradingBot) -> list[TradingBotOrder]:
    session = get_bybit_session(bot)
    cancelled: list[TradingBotOrder] = []
    active_orders = (
        db.query(TradingBotOrder)
        .filter(
            TradingBotOrder.bot_id == bot.id,
            TradingBotOrder.order_link_id.isnot(None),
            TradingBotOrder.status.in_(ACTIVE_ORDER_STATUSES),
        )
        .all()
    )
    for order in active_orders:
        response = cancel_order_by_link_id(
            session,
            category=bot.category,
            symbol=bot.symbol,
            order_link_id=order.order_link_id,
        )
        order.status = "Cancelled"
        order.raw_response = response
        db.add(order)
        cancelled.append(order)
        log_bot_event(db, bot, "order_cancelled", "Cancelled bot order", {
                      "order_link_id": order.order_link_id})
    return cancelled


def tick_grid_bot(db, bot: TradingBot) -> dict:
    if bot.runtime_status != "running":
        return {"orders": [], "events": 0, "message": "Bot is not running"}
    if not bot.is_active:
        bot.runtime_status = "stopped"
        bot.last_error = "Bot is inactive"
        log_bot_event(db, bot, "error", "Bot is inactive and cannot trade")
        db.add(bot)
        db.commit()
        return {"orders": [], "events": 1, "message": "Bot inactive"}
    if not _should_tick(bot):
        return {"orders": [], "events": 0, "message": "Tick skipped by interval"}

    synced = sync_bot_orders(db, bot)
    tp_changes, current_position_size = sync_position_take_profit(db, bot)
    created_entries = create_missing_grid_entries(
        db, bot, current_position_size)

    for change in synced:
        order = change["order"]
        if change["became_filled"] and order.order_role.startswith("grid_entry_"):
            if order.filled_event_logged_at is None:
                log_bot_event(db, bot, "grid_entry_filled", "Grid entry filled", {
                              "order_link_id": order.order_link_id})
                _mark_order_filled_logged(order)
                db.add(order)
        if change["became_filled"] and order.order_role == POSITION_TP_ROLE:
            if order.filled_event_logged_at is None:
                log_bot_event(db, bot, "position_take_profit_filled",
                              "Position take-profit filled", {"order_link_id": order.order_link_id})
                _mark_order_filled_logged(order)
                db.add(order)
        if change["status_changed"] and change["new_status"] == "Rejected":
            log_bot_event(db, bot, "order_rejected", "Order rejected", {
                          "order_link_id": order.order_link_id})

    bot.last_run_at = _utcnow()
    bot.last_error = None
    db.add(bot)
    db.commit()
    return {
        "orders": tp_changes + created_entries,
        "events": len(synced),
        "message": "Tick completed",
    }
