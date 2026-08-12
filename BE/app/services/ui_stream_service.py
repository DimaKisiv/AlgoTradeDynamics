"""In-process notifications for browser WebSocket subscribers."""
from __future__ import annotations

import asyncio
import threading
import time
from dataclasses import dataclass


@dataclass(slots=True)
class _Subscriber:
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue[str]


class BotUiStreamHub:
    def __init__(self, *, queue_size: int = 8) -> None:
        self._queue_size = queue_size
        self._lock = threading.Lock()
        self._subscribers: dict[int, dict[int, _Subscriber]] = {}
        self._next_id = 1

    def subscribe(self, bot_id: int) -> tuple[int, asyncio.Queue[str]]:
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=self._queue_size)
        with self._lock:
            subscription_id = self._next_id
            self._next_id += 1
            self._subscribers.setdefault(bot_id, {})[subscription_id] = _Subscriber(loop, queue)
        return subscription_id, queue

    def unsubscribe(self, bot_id: int, subscription_id: int) -> None:
        with self._lock:
            by_bot = self._subscribers.get(bot_id)
            if not by_bot:
                return
            by_bot.pop(subscription_id, None)
            if not by_bot:
                self._subscribers.pop(bot_id, None)

    def publish(self, bot_id: int, reason: str = "updated") -> None:
        with self._lock:
            subscribers = list((self._subscribers.get(bot_id) or {}).values())
        for subscriber in subscribers:
            if subscriber.loop.is_closed():
                continue
            subscriber.loop.call_soon_threadsafe(self._enqueue_latest, subscriber.queue, reason)

    @staticmethod
    def _enqueue_latest(queue: asyncio.Queue[str], reason: str) -> None:
        while queue.full():
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        try:
            queue.put_nowait(reason)
        except asyncio.QueueFull:
            pass


bot_ui_stream_hub = BotUiStreamHub()


class BacktestUiStreamHub:
    def __init__(self, *, queue_size: int = 32, min_interval_seconds: float = 0.35) -> None:
        self._queue_size = queue_size
        self._min_interval = min_interval_seconds
        self._lock = threading.Lock()
        self._subscribers: dict[int, dict[int, _Subscriber]] = {}
        self._next_id = 1
        self._last_publish: dict[int, float] = {}

    def subscribe(self, user_id: int) -> tuple[int, asyncio.Queue[str]]:
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=self._queue_size)
        with self._lock:
            subscription_id = self._next_id
            self._next_id += 1
            self._subscribers.setdefault(user_id, {})[subscription_id] = _Subscriber(loop, queue)
        return subscription_id, queue

    def unsubscribe(self, user_id: int, subscription_id: int) -> None:
        with self._lock:
            by_user = self._subscribers.get(user_id)
            if not by_user:
                return
            by_user.pop(subscription_id, None)
            if not by_user:
                self._subscribers.pop(user_id, None)

    def publish(self, user_id: int, run_id: int, reason: str = "progress", *, force: bool = False) -> None:
        current = time.monotonic()
        with self._lock:
            previous = self._last_publish.get(run_id, 0.0)
            if not force and current - previous < self._min_interval:
                return
            self._last_publish[run_id] = current
            subscribers = list((self._subscribers.get(user_id) or {}).values())
        payload = f"{run_id}:{reason}"
        for subscriber in subscribers:
            if subscriber.loop.is_closed():
                continue
            subscriber.loop.call_soon_threadsafe(BotUiStreamHub._enqueue_latest, subscriber.queue, payload)


backtest_ui_stream_hub = BacktestUiStreamHub()
