"""In-process background worker for continuously running bots."""
from __future__ import annotations

import asyncio

from app.bot_engine.events import log_bot_event
from app.bot_engine.bot import tick_bot_once
from app.db.session import SessionLocal
from app.models.trading_bot import TradingBot

WORKER_SLEEP_SECONDS = 5


async def worker_loop(app) -> None:
    while getattr(app.state, "bot_worker_running", False):
        await tick_running_bots(app)
        await asyncio.sleep(WORKER_SLEEP_SECONDS)


async def tick_running_bots(app) -> None:
    db = SessionLocal()
    try:
        bots = db.query(TradingBot).filter(
            TradingBot.runtime_status == "running",
            TradingBot.is_backtest.is_(False),
        ).all()
        for bot in bots:
            lock = app.state.bot_worker_locks.setdefault(
                bot.id, asyncio.Lock())
            if lock.locked():
                continue
            async with lock:
                bot_db = SessionLocal()
                try:
                    current_bot = bot_db.get(TradingBot, bot.id)
                    if current_bot is None or current_bot.runtime_status != "running":
                        continue
                    try:
                        tick_bot_once(bot_db, current_bot)
                    except Exception as exc:
                        current_bot.runtime_status = "error"
                        current_bot.last_error = str(exc)
                        bot_db.add(current_bot)
                        log_bot_event(bot_db, current_bot, "error", str(exc))
                        bot_db.commit()
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
