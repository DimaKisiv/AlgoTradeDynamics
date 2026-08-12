"""In-process background worker for continuously running bots."""
from __future__ import annotations

import asyncio

from app.bot_engine.bot import tick_bot_once
from app.bot_engine.error_handling import clear_bot_runtime_error, handle_bot_runtime_error
from app.core.clock import utcnow
from app.db.session import SessionLocal
from app.models.trading_bot import TradingBot

WORKER_SLEEP_SECONDS = 5


async def worker_loop(app) -> None:
    while getattr(app.state, "bot_worker_running", False):
        await tick_running_bots(app)
        await asyncio.sleep(WORKER_SLEEP_SECONDS)


def _retry_is_due(bot: TradingBot) -> bool:
    return bot.next_retry_at is None or bot.next_retry_at <= utcnow()


async def tick_running_bots(app) -> None:
    db = SessionLocal()
    try:
        bots = db.query(TradingBot).filter(
            TradingBot.runtime_status.in_(("running", "retrying")),
            TradingBot.is_backtest.is_(False),
        ).all()
        for bot in bots:
            if bot.runtime_status == "retrying" and not _retry_is_due(bot):
                continue
            lock = app.state.bot_worker_locks.setdefault(bot.id, asyncio.Lock())
            if lock.locked():
                continue
            async with lock:
                bot_db = SessionLocal()
                try:
                    current_bot = bot_db.get(TradingBot, bot.id)
                    if current_bot is None or current_bot.runtime_status not in {"running", "retrying"}:
                        continue
                    if current_bot.runtime_status == "retrying":
                        if not _retry_is_due(current_bot):
                            continue
                        # Strategy ticks intentionally execute only in running state.
                        # We do not commit this transition until the tick succeeds.
                        current_bot.runtime_status = "running"
                        bot_db.add(current_bot)
                        bot_db.flush()
                    try:
                        tick_bot_once(bot_db, current_bot)
                        # A successful tick proves the transient problem is gone.
                        current_bot = bot_db.get(TradingBot, bot.id)
                        if current_bot is not None and current_bot.runtime_status == "running":
                            clear_bot_runtime_error(current_bot)
                            bot_db.add(current_bot)
                            bot_db.commit()
                    except Exception as exc:  # noqa: BLE001
                        # Discard partially staged local changes before deciding whether
                        # this failure is safe to retry. Exchange state is reconciled on
                        # the next strategy tick when RESYNC_AND_RETRY is selected.
                        bot_db.rollback()
                        failed_bot = bot_db.get(TradingBot, bot.id)
                        if failed_bot is not None:
                            handle_bot_runtime_error(bot_db, failed_bot, exc, source="worker")
                finally:
                    bot_db.close()
    finally:
        db.close()


def start_bot_worker(app) -> None:
    if getattr(app.state, "bot_worker_task", None) is not None:
        return
    app.state.bot_worker_running = True
    app.state.bot_worker_locks = {}
    app.state.bot_worker_task = asyncio.create_task(worker_loop(app))


async def stop_bot_worker(app) -> None:
    task = getattr(app.state, "bot_worker_task", None)
    app.state.bot_worker_running = False
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    finally:
        app.state.bot_worker_task = None
