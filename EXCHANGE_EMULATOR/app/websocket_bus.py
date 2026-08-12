"""Thread-safe in-process event bus backing the emulator WebSocket API.

The matching engine runs both in FastAPI worker threads and in the dedicated
runtime thread.  ``publish`` is therefore intentionally synchronous and hands
messages to the FastAPI event loop with ``call_soon_threadsafe``.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class StreamEvent:
    topic: str
    data: Any
    account_id: int | None = None
    message_type: str = "snapshot"
    timestamp_ms: int | None = None

    def payload(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "topic": self.topic,
            "type": self.message_type,
            "data": self.data,
        }
        if self.timestamp_ms is not None:
            result["ts"] = self.timestamp_ms
        return result


@dataclass(slots=True)
class Subscription:
    queue: asyncio.Queue[StreamEvent]
    topics: set[str] = field(default_factory=set)
    account_id: int | None = None


class WebSocketEventBus:
    def __init__(self, *, queue_size: int = 1000) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._subscriptions: dict[int, Subscription] = {}
        self._next_id = 1
        self._queue_size = queue_size

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def unbind_loop(self) -> None:
        self._loop = None
        self._subscriptions.clear()

    def subscribe(self, *, account_id: int | None = None) -> tuple[int, Subscription]:
        subscription_id = self._next_id
        self._next_id += 1
        subscription = Subscription(
            queue=asyncio.Queue(maxsize=self._queue_size),
            account_id=account_id,
        )
        self._subscriptions[subscription_id] = subscription
        return subscription_id, subscription

    def unsubscribe(self, subscription_id: int) -> None:
        self._subscriptions.pop(subscription_id, None)

    def add_topics(self, subscription_id: int, topics: list[str]) -> None:
        subscription = self._subscriptions.get(subscription_id)
        if subscription is not None:
            subscription.topics.update(str(topic) for topic in topics if topic)

    def remove_topics(self, subscription_id: int, topics: list[str]) -> None:
        subscription = self._subscriptions.get(subscription_id)
        if subscription is not None:
            subscription.topics.difference_update(str(topic) for topic in topics if topic)

    def publish(self, event: StreamEvent) -> None:
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        loop.call_soon_threadsafe(self._deliver, event)

    def _deliver(self, event: StreamEvent) -> None:
        for subscription in tuple(self._subscriptions.values()):
            if event.topic not in subscription.topics:
                continue
            # Private events are account-scoped. Public market events use
            # account_id=None and can wake every subscriber for the symbol.
            if event.account_id is not None and subscription.account_id != event.account_id:
                continue
            try:
                subscription.queue.put_nowait(event)
            except asyncio.QueueFull:
                # Real-time streams should prefer fresh state over stale backlog.
                try:
                    subscription.queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    subscription.queue.put_nowait(event)
                except asyncio.QueueFull:
                    pass


websocket_bus = WebSocketEventBus()
