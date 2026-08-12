"""Unified real-time exchange streams for Bybit and the local emulator.

Both sources expose the same topics to the runtime:
  - tickers.{SYMBOL}
  - order
  - execution
  - position
  - wallet

REST remains the source of truth for commands and periodic reconciliation.  WS
messages wake the strategy worker immediately instead of waiting for the old
fixed polling cadence.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable
from urllib.parse import urlencode, urlparse, urlunparse

import websockets

from app.bot_engine.bybit.client import get_bybit_credentials
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.trading_bot import TradingBot

logger = logging.getLogger(__name__)

PRIVATE_TOPICS = ("order", "execution", "position", "wallet")


@dataclass(slots=True)
class ExchangeStreamEvent:
    bot_id: int
    topic: str
    data: Any
    received_at: float


@dataclass(slots=True)
class StreamEndpoints:
    public_url: str
    private_url: str
    api_key: str | None
    api_secret: str | None
    emulator: bool


def _http_to_ws(base_url: str) -> str:
    parsed = urlparse(base_url.rstrip("/"))
    scheme = "wss" if parsed.scheme == "https" else "ws"
    return urlunparse((scheme, parsed.netloc, parsed.path.rstrip("/"), "", "", ""))


def _emulator_key(bot: TradingBot) -> str:
    settings = get_settings()
    return str((bot.settings or {}).get("emulator_api_key") or settings.exchange_emulator_default_api_key)


def stream_endpoints(bot: TradingBot) -> StreamEndpoints:
    if bot.environment == "emulator":
        base = _http_to_ws(get_settings().exchange_emulator_url)
        api_key = _emulator_key(bot)
        query = urlencode({"api_key": api_key})
        return StreamEndpoints(
            public_url=f"{base}/v5/public/{bot.category}?{query}",
            private_url=f"{base}/v5/private?{query}",
            api_key=api_key,
            api_secret=None,
            emulator=True,
        )

    api_key, api_secret = get_bybit_credentials(bot.environment)
    if not api_key or not api_secret:
        raise ValueError(f"Bybit {bot.environment} API credentials are not configured")

    if bot.environment == "testnet":
        public_host = "wss://stream-testnet.bybit.com"
        private_host = "wss://stream-testnet.bybit.com"
    elif bot.environment == "demo":
        # Demo has a private demo stream; public prices come from mainnet.
        public_host = "wss://stream.bybit.com"
        private_host = "wss://stream-demo.bybit.com"
    else:
        public_host = "wss://stream.bybit.com"
        private_host = "wss://stream.bybit.com"

    return StreamEndpoints(
        public_url=f"{public_host}/v5/public/{bot.category}",
        private_url=f"{private_host}/v5/private",
        api_key=api_key,
        api_secret=api_secret,
        emulator=False,
    )


def stream_signature(bot: TradingBot) -> tuple[Any, ...]:
    endpoints = stream_endpoints(bot)
    return (
        bot.environment,
        bot.category,
        bot.symbol,
        endpoints.public_url,
        endpoints.private_url,
        endpoints.api_key,
    )


def _auth_payload(api_key: str, api_secret: str) -> dict[str, Any]:
    expires = int(time.time() * 1000) + 10_000
    raw = f"GET/realtime{expires}"
    signature = hmac.new(api_secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return {"op": "auth", "args": [api_key, expires, signature]}


def _topic_matches_symbol(topic: str, data: Any, symbol: str) -> bool:
    if topic.startswith("tickers.") or topic.startswith("kline."):
        return topic.endswith(f".{symbol}") or topic == f"tickers.{symbol}"
    if topic == "wallet":
        return True
    items = data if isinstance(data, list) else [data]
    for item in items:
        if not isinstance(item, dict):
            continue
        item_symbol = str(item.get("symbol") or "").upper()
        if not item_symbol or item_symbol == symbol:
            return True
    return False


class BotExchangeStream:
    def __init__(
        self,
        bot: TradingBot,
        on_event: Callable[[ExchangeStreamEvent], Awaitable[None]],
    ) -> None:
        self.bot_id = bot.id
        self.symbol = bot.symbol.upper()
        self.endpoints = stream_endpoints(bot)
        self._on_event = on_event
        self._tasks: list[asyncio.Task] = []
        self._stopping = False

    def start(self) -> None:
        if self._tasks:
            return
        self._stopping = False
        self._tasks = [
            asyncio.create_task(self._run_public(), name=f"exchange-ws-public-{self.bot_id}"),
            asyncio.create_task(self._run_private(), name=f"exchange-ws-private-{self.bot_id}"),
        ]

    async def stop(self) -> None:
        self._stopping = True
        tasks, self._tasks = self._tasks, []
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _emit(self, message: dict[str, Any]) -> None:
        topic = str(message.get("topic") or "")
        if not topic:
            return
        data = message.get("data")
        if not _topic_matches_symbol(topic, data, self.symbol):
            return
        await self._on_event(ExchangeStreamEvent(
            bot_id=self.bot_id,
            topic=topic,
            data=data,
            received_at=time.time(),
        ))

    async def _receive_loop(self, websocket) -> None:
        while not self._stopping:
            try:
                raw = await asyncio.wait_for(websocket.recv(), timeout=20)
            except asyncio.TimeoutError:
                await websocket.send(json.dumps({"op": "ping"}))
                continue
            message = json.loads(raw)
            if isinstance(message, dict):
                await self._emit(message)

    async def _connect_forever(
        self,
        *,
        url: str,
        subscribe_topics: list[str],
        authenticate: bool,
        label: str,
    ) -> None:
        delay = 1.0
        while not self._stopping:
            try:
                async with websockets.connect(
                    url,
                    ping_interval=20,
                    ping_timeout=20,
                    close_timeout=5,
                    max_queue=256,
                ) as websocket:
                    if authenticate:
                        if not self.endpoints.api_key or not self.endpoints.api_secret:
                            raise ValueError("Private Bybit WebSocket credentials are missing")
                        await websocket.send(json.dumps(_auth_payload(
                            self.endpoints.api_key,
                            self.endpoints.api_secret,
                        )))
                        # Bybit sends an auth acknowledgement before subscriptions.
                        auth_raw = await asyncio.wait_for(websocket.recv(), timeout=10)
                        auth_message = json.loads(auth_raw)
                        if not bool(auth_message.get("success")):
                            raise RuntimeError(f"Bybit WebSocket auth failed: {auth_message}")
                    await websocket.send(json.dumps({"op": "subscribe", "args": subscribe_topics}))
                    delay = 1.0
                    logger.info("Exchange WS connected: bot=%s stream=%s", self.bot_id, label)
                    await self._on_event(ExchangeStreamEvent(
                        bot_id=self.bot_id,
                        topic="system.connected",
                        data={"stream": label},
                        received_at=time.time(),
                    ))
                    await self._receive_loop(websocket)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                if self._stopping:
                    return
                logger.warning(
                    "Exchange WS disconnected: bot=%s stream=%s error=%s; retrying in %.1fs",
                    self.bot_id, label, exc, delay,
                )
                await asyncio.sleep(delay)
                delay = min(delay * 2, 15.0)

    async def _run_public(self) -> None:
        await self._connect_forever(
            url=self.endpoints.public_url,
            subscribe_topics=[f"tickers.{self.symbol}"],
            authenticate=False,
            label="public",
        )

    async def _run_private(self) -> None:
        await self._connect_forever(
            url=self.endpoints.private_url,
            subscribe_topics=list(PRIVATE_TOPICS),
            authenticate=not self.endpoints.emulator,
            label="private",
        )


class ExchangeStreamSupervisor:
    """Own per-bot streams and expose a deduplicated wake-up queue to the worker."""

    def __init__(self) -> None:
        self._streams: dict[int, BotExchangeStream] = {}
        self._signatures: dict[int, tuple[Any, ...]] = {}
        self._queue: asyncio.Queue[int] = asyncio.Queue(maxsize=1000)
        self._queued: set[int] = set()
        self._last_ticker_wake: dict[int, float] = {}
        self._ticker_intervals: dict[int, float] = {}
        self._last_reconcile = 0.0

    async def stop(self) -> None:
        streams = list(self._streams.values())
        self._streams.clear()
        self._signatures.clear()
        if streams:
            await asyncio.gather(*(stream.stop() for stream in streams), return_exceptions=True)

    def _enqueue(self, bot_id: int) -> None:
        if bot_id in self._queued:
            return
        self._queued.add(bot_id)
        try:
            self._queue.put_nowait(bot_id)
        except asyncio.QueueFull:
            self._queued.discard(bot_id)

    async def on_event(self, event: ExchangeStreamEvent) -> None:
        if event.topic.startswith("tickers."):
            now = time.monotonic()
            interval = self._ticker_intervals.get(event.bot_id, 5.0)
            previous = self._last_ticker_wake.get(event.bot_id, 0.0)
            if now - previous < interval:
                return
            self._last_ticker_wake[event.bot_id] = now
        self._enqueue(event.bot_id)

    async def reconcile_if_due(self, *, force: bool = False) -> None:
        now = time.monotonic()
        if not force and now - self._last_reconcile < 2.0:
            return
        self._last_reconcile = now
        db = SessionLocal()
        try:
            bots = db.query(TradingBot).filter(
                TradingBot.runtime_status.in_(("running", "retrying")),
                TradingBot.is_backtest.is_(False),
            ).all()
            active = {bot.id: bot for bot in bots}
            for bot in bots:
                run_interval = float((bot.settings or {}).get(
                    "run_interval_seconds",
                    5 if bot.strategy_type == "pattern_scalper" else 10,
                ))
                self._ticker_intervals[bot.id] = max(min(run_interval, 10.0), 0.5)
                try:
                    signature = stream_signature(bot)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Cannot configure Exchange WS for bot=%s: %s", bot.id, exc)
                    continue
                if self._signatures.get(bot.id) == signature and bot.id in self._streams:
                    continue
                old = self._streams.pop(bot.id, None)
                if old is not None:
                    await old.stop()
                stream = BotExchangeStream(bot, self.on_event)
                self._streams[bot.id] = stream
                self._signatures[bot.id] = signature
                stream.start()
                self._enqueue(bot.id)  # initial reconciliation immediately after start

            stale = [bot_id for bot_id in self._streams if bot_id not in active]
            for bot_id in stale:
                stream = self._streams.pop(bot_id)
                self._signatures.pop(bot_id, None)
                self._ticker_intervals.pop(bot_id, None)
                self._last_ticker_wake.pop(bot_id, None)
                await stream.stop()
        finally:
            db.close()

    async def wait_for_bot_ids(self, timeout: float) -> set[int] | None:
        try:
            first = await asyncio.wait_for(self._queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None
        ids = {first}
        while True:
            try:
                ids.add(self._queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        for bot_id in ids:
            self._queued.discard(bot_id)
        return ids
