"""FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.backtests import router as backtests_router
from app.api.health import router as health_router
from app.api.strategies import router as strategies_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.db.base import Base
from app.db.session import engine
from app.models import backtest  # noqa: F401  (register models)

configure_logging()
logger = get_logger(__name__)

settings = get_settings()

# Best-effort schema creation when running outside Docker / without Alembic.
if settings.database_url.startswith("sqlite"):
    Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("API ready: env=%s", settings.environment)
    yield
    logger.info("API shutting down")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "REST API для MVP веб-платформи AlgoTradeDynamics. "
        "Дозволяє запускати backtesting криптовалютних торгових стратегій, "
        "переглядати метрики, equity curve та журнал угод."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(strategies_router, prefix="/api")
app.include_router(backtests_router, prefix="/api")


@app.get("/", tags=["Root"])
def root() -> dict:
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "environment": settings.environment,
        "docs": "/docs",
        "health": "/health",
    }
