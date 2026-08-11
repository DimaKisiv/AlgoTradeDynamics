"""FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.backtests import router as backtests_router
from app.api.bots import router as bots_router
from app.api.bybit import router as bybit_router
from app.api.health import router as health_router
from app.api.notifications import router as notifications_router
from app.bot_engine.runtime import start_bot_worker, stop_bot_worker
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.core.rate_limit import RateLimitMiddleware
from app.db.base import Base
from app.db.session import engine
from app.services.telegram_notifications import start_telegram_workers, stop_telegram_workers
from app.models import backtest, refresh_token, telegram_notification, trading_bot, trading_bot_event, trading_bot_order, user  # noqa: F401  (register models)

configure_logging()
logger = get_logger(__name__)

settings = get_settings()

# Best-effort schema creation when running outside Docker / without Alembic.
if settings.database_url.startswith("sqlite"):
    Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.bot_worker_enabled:
        start_bot_worker(app)
    start_telegram_workers(app)
    logger.info("API ready: env=%s", settings.environment)
    yield
    await stop_telegram_workers(app)
    if settings.bot_worker_enabled:
        await stop_bot_worker(app)
    logger.info("API shutting down")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "AlgoTradeDynamics API: trading bots, local exchange emulator integration, "
        "and deterministic historical backtests of existing bot configurations."
    ),
    lifespan=lifespan,
)

# Add rate limiting first and CORS second. Starlette wraps the most recently
# added middleware outermost, so even 429 responses receive CORS headers.
app.add_middleware(RateLimitMiddleware, settings=settings)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router, prefix="/api")
app.include_router(backtests_router, prefix="/api")
app.include_router(bots_router, prefix="/api")
app.include_router(bybit_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")


@app.get("/", tags=["Root"])
def root() -> dict:
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "environment": settings.environment,
        "docs": "/docs",
        "health": "/health",
    }
