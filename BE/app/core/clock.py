"""Runtime clock that can be pinned to historical time during a backtest."""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone

_simulated_time: ContextVar[datetime | None] = ContextVar("simulated_time", default=None)


def utcnow() -> datetime:
    value = _simulated_time.get()
    return value if value is not None else datetime.now(timezone.utc)


@contextmanager
def use_simulated_time(value: datetime):
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    token = _simulated_time.set(value)
    try:
        yield
    finally:
        _simulated_time.reset(token)
