"""Classify bot runtime failures and apply safe recovery policies.

The strategy layer raises the original exception. This module translates it into
an operational error type and decides whether a live/demo bot should retry,
resynchronise, pause for user action, or stop.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from enum import StrEnum
import re
from typing import Any

from app.bot_engine.events import log_bot_event
from app.core.clock import utcnow
from app.models.trading_bot import TradingBot


class BotErrorType(StrEnum):
    NETWORK = "network"
    RATE_LIMIT = "rate_limit"
    EXCHANGE_UNAVAILABLE = "exchange_unavailable"
    TIME_SYNC = "time_sync"
    AUTHENTICATION = "authentication"
    PERMISSION = "permission"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    INVALID_ORDER = "invalid_order"
    INVALID_SYMBOL = "invalid_symbol"
    ORDER_STATE = "order_state"
    CONFIGURATION = "configuration"
    RISK = "risk"
    INTERNAL = "internal"


class BotErrorSeverity(StrEnum):
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class BotErrorAction(StrEnum):
    RETRY_BACKOFF = "retry_backoff"
    RESYNC_AND_RETRY = "resync_and_retry"
    PAUSE = "pause"
    STOP = "stop"


@dataclass(slots=True, frozen=True)
class BotErrorDecision:
    error_type: BotErrorType
    severity: BotErrorSeverity
    action: BotErrorAction
    retryable: bool
    message: str
    code: str | None = None
    retry_after_seconds: int | None = None


class ExchangeOperationError(RuntimeError):
    """Structured non-zero exchange response for deterministic classification."""

    def __init__(self, message: str, *, code: str | int | None = None, operation: str | None = None):
        self.code = None if code is None else str(code)
        self.operation = operation
        prefix = f"{operation}: " if operation else ""
        suffix = f" (code {self.code})" if self.code is not None else ""
        super().__init__(f"{prefix}{message}{suffix}")


# Bybit V5 codes grouped by operational response. Keep the policy intentionally
# conservative: money/config/auth problems never retry forever.
_RATE_LIMIT_CODES = {"429", "10006", "10429", "20003", "30035"}
_EXCHANGE_UNAVAILABLE_CODES = {"10000", "10016", "10019"}
_TIME_SYNC_CODES = {"-1", "10002"}
_AUTH_CODES = {"10003", "10004", "10007", "-2015", "33004"}
_PERMISSION_CODES = {"10005", "10008", "10009", "10010", "10024", "10027"}
_INSUFFICIENT_FUNDS_CODES = {
    "110004", "110006", "110007", "110012", "110014", "110044", "110045",
    "110051", "110052", "110053", "3777040",
}
_INVALID_SYMBOL_CODES = {"10029", "110050"}
_ORDER_STATE_CODES = {"10014", "110001", "110005", "110008", "110010", "110072", "40004", "20006"}
_RISK_CODES = {
    "110011", "110013", "110021", "110022", "110023", "110031", "110039", "110040",
    "110047", "110048", "30256",
}
_INVALID_ORDER_CODES = {
    "10001", "110003", "110009", "110017", "110020", "110032", "110049",
    "110057", "110058", "110059", "110060", "110061", "30208", "30209",
}

_CODE_PATTERNS = (
    re.compile(r"(?:errcode|retcode|code)\s*[:=]?\s*\(?(-?\d+)\)?", re.IGNORECASE),
    re.compile(r"\((-?\d+)\)"),
)


def _extract_code(exc: BaseException) -> str | None:
    for attr in ("code", "status_code", "ret_code", "retCode"):
        value = getattr(exc, attr, None)
        if value is not None:
            return str(value)
    text = str(exc)
    for pattern in _CODE_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(1)
    return None


def _http_status(exc: BaseException) -> int | None:
    response = getattr(exc, "response", None)
    value = getattr(response, "status_code", None)
    if value is None:
        value = getattr(exc, "http_status", None)
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _is_network_exception(exc: BaseException) -> bool:
    if isinstance(exc, (ConnectionError, TimeoutError)):
        return True
    module = type(exc).__module__.lower()
    name = type(exc).__name__.lower()
    return (
        module.startswith("httpx")
        or module.startswith("requests")
        or module.startswith("urllib3")
    ) and any(token in name for token in ("timeout", "connect", "network", "request", "transport"))


def _decision(
    error_type: BotErrorType,
    severity: BotErrorSeverity,
    action: BotErrorAction,
    message: str,
    *,
    code: str | None,
    retry_after_seconds: int | None = None,
) -> BotErrorDecision:
    return BotErrorDecision(
        error_type=error_type,
        severity=severity,
        action=action,
        retryable=action in {BotErrorAction.RETRY_BACKOFF, BotErrorAction.RESYNC_AND_RETRY},
        message=message,
        code=code,
        retry_after_seconds=retry_after_seconds,
    )


def classify_bot_error(exc: BaseException) -> BotErrorDecision:
    """Map an arbitrary runtime exception to a safe operational policy."""
    message = str(exc).strip() or type(exc).__name__
    lowered = message.lower()
    code = _extract_code(exc)
    http_status = _http_status(exc)

    if code in _RATE_LIMIT_CODES or http_status == 429:
        return _decision(BotErrorType.RATE_LIMIT, BotErrorSeverity.WARNING, BotErrorAction.RETRY_BACKOFF, message, code=code, retry_after_seconds=15)
    if code in _EXCHANGE_UNAVAILABLE_CODES or (http_status is not None and http_status >= 500):
        return _decision(BotErrorType.EXCHANGE_UNAVAILABLE, BotErrorSeverity.ERROR, BotErrorAction.RETRY_BACKOFF, message, code=code, retry_after_seconds=15)
    if code in _TIME_SYNC_CODES or "recv_window" in lowered or "timestamp" in lowered and "server" in lowered:
        return _decision(BotErrorType.TIME_SYNC, BotErrorSeverity.WARNING, BotErrorAction.RETRY_BACKOFF, message, code=code, retry_after_seconds=10)
    if code in _AUTH_CODES or http_status == 401 or "api credentials are not configured" in lowered or "authentication failed" in lowered:
        return _decision(BotErrorType.AUTHENTICATION, BotErrorSeverity.CRITICAL, BotErrorAction.STOP, message, code=code)
    if code in _PERMISSION_CODES or http_status == 403 or "permission denied" in lowered or "unmatched ip" in lowered:
        return _decision(BotErrorType.PERMISSION, BotErrorSeverity.CRITICAL, BotErrorAction.STOP, message, code=code)
    if code in _INSUFFICIENT_FUNDS_CODES or any(token in lowered for token in ("insufficient balance", "wallet balance is insufficient", "available balance is insufficient", "insufficient margin")):
        return _decision(BotErrorType.INSUFFICIENT_FUNDS, BotErrorSeverity.ERROR, BotErrorAction.PAUSE, message, code=code)
    if code in _INVALID_SYMBOL_CODES or any(token in lowered for token in ("ticker not found", "instrument info not found", "symbol is invalid", "invalid symbol")):
        return _decision(BotErrorType.INVALID_SYMBOL, BotErrorSeverity.ERROR, BotErrorAction.PAUSE, message, code=code)
    if code in _ORDER_STATE_CODES or any(token in lowered for token in ("order does not exist", "order has been completed or cancelled", "duplicate order", "orderlinkid is duplicate")):
        return _decision(BotErrorType.ORDER_STATE, BotErrorSeverity.WARNING, BotErrorAction.RESYNC_AND_RETRY, message, code=code, retry_after_seconds=5)
    if code in _RISK_CODES or any(token in lowered for token in ("liquidation will be triggered", "risk limit", "position limit")):
        return _decision(BotErrorType.RISK, BotErrorSeverity.CRITICAL, BotErrorAction.PAUSE, message, code=code)
    if code in _INVALID_ORDER_CODES or any(token in lowered for token in ("below bybit minimum", "order notional", "order qty", "order quantity", "price exceeds", "price is higher", "price is lower")):
        return _decision(BotErrorType.INVALID_ORDER, BotErrorSeverity.ERROR, BotErrorAction.PAUSE, message, code=code)
    if _is_network_exception(exc) or http_status in {408, 425, 502, 503, 504}:
        return _decision(BotErrorType.NETWORK, BotErrorSeverity.WARNING, BotErrorAction.RETRY_BACKOFF, message, code=code, retry_after_seconds=5)
    if isinstance(exc, ValueError) and any(token in lowered for token in ("configuration", "supports linear", "must be", "cannot be", "inactive")):
        return _decision(BotErrorType.CONFIGURATION, BotErrorSeverity.ERROR, BotErrorAction.PAUSE, message, code=code)
    return _decision(BotErrorType.INTERNAL, BotErrorSeverity.CRITICAL, BotErrorAction.STOP, message, code=code)


def _error_setting(bot: TradingBot, key: str, default: Any) -> Any:
    settings = bot.settings or {}
    return settings.get(key, default)


def _retry_delay(bot: TradingBot, decision: BotErrorDecision, retry_count: int) -> int:
    base = int(decision.retry_after_seconds or _error_setting(bot, "error_retry_base_seconds", 5))
    maximum = int(_error_setting(bot, "error_retry_max_seconds", 300))
    # retry_count is 1-based here; first retry uses the base delay.
    return max(1, min(maximum, base * (2 ** max(0, retry_count - 1))))


def handle_bot_runtime_error(db, bot: TradingBot, exc: BaseException, *, source: str = "worker") -> BotErrorDecision:
    """Persist the error and apply its recovery action to a live/demo bot."""
    decision = classify_bot_error(exc)
    now = utcnow()
    retry_count = int(bot.error_retry_count or 0) + 1 if decision.retryable else 0
    max_retries = max(0, int(_error_setting(bot, "error_max_retries", 5)))

    action = decision.action
    severity = decision.severity
    next_retry_at = None
    if decision.retryable:
        if retry_count > max_retries:
            action = BotErrorAction.PAUSE
            severity = BotErrorSeverity.ERROR
        else:
            next_retry_at = now + timedelta(seconds=_retry_delay(bot, decision, retry_count))

    bot.last_run_at = now
    bot.last_error = decision.message[:500]
    bot.last_error_type = decision.error_type.value
    bot.last_error_severity = severity.value
    bot.last_error_action = action.value
    bot.last_error_code = decision.code
    bot.last_error_at = now
    bot.error_retry_count = retry_count
    bot.next_retry_at = next_retry_at

    if action in {BotErrorAction.RETRY_BACKOFF, BotErrorAction.RESYNC_AND_RETRY}:
        bot.runtime_status = "retrying"
    elif action == BotErrorAction.PAUSE:
        bot.runtime_status = "paused"
    else:
        bot.runtime_status = "error"
        bot.stopped_at = now

    payload = {
        "error_type": decision.error_type.value,
        "severity": severity.value,
        "action": action.value,
        "retryable": action in {BotErrorAction.RETRY_BACKOFF, BotErrorAction.RESYNC_AND_RETRY},
        "error_code": decision.code,
        "retry_count": retry_count,
        "max_retries": max_retries,
        "next_retry_at": next_retry_at.isoformat() if next_retry_at else None,
        "source": source,
        "exception_class": type(exc).__name__,
    }
    log_bot_event(db, bot, "bot_error", decision.message[:500], payload)
    db.add(bot)
    db.commit()
    return BotErrorDecision(
        error_type=decision.error_type,
        severity=severity,
        action=action,
        retryable=payload["retryable"],
        message=decision.message,
        code=decision.code,
        retry_after_seconds=(int((next_retry_at - now).total_seconds()) if next_retry_at else None),
    )


def clear_bot_runtime_error(bot: TradingBot) -> None:
    """Clear current recovery state after a successful worker tick."""
    bot.last_error = None
    bot.last_error_type = None
    bot.last_error_severity = None
    bot.last_error_action = None
    bot.last_error_code = None
    bot.last_error_at = None
    bot.error_retry_count = 0
    bot.next_retry_at = None
