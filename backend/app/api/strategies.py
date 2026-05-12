"""Strategy catalog endpoint."""
from fastapi import APIRouter

from app.bot_engine.strategies import STRATEGIES
from app.schemas.strategy import StrategyInfo

router = APIRouter(prefix="/strategies", tags=["Strategies"])


@router.get("", response_model=list[StrategyInfo])
def list_strategies() -> list[dict]:
    return list(STRATEGIES.values())
