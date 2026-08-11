"""Schemas for Telegram notification settings and account linking."""
from datetime import datetime

from pydantic import BaseModel


class TelegramStatusResponse(BaseModel):
    configured: bool
    connected: bool
    enabled: bool = False
    username: str | None = None
    connected_at: datetime | None = None
    notify_trades: bool = True
    notify_bot_status: bool = True
    notify_errors: bool = True
    notify_risk: bool = True


class TelegramConnectResponse(BaseModel):
    connect_url: str
    expires_at: datetime


class TelegramPreferencesUpdate(BaseModel):
    enabled: bool | None = None
    notify_trades: bool | None = None
    notify_bot_status: bool | None = None
    notify_errors: bool | None = None
    notify_risk: bool | None = None


class TelegramTestResponse(BaseModel):
    message: str
