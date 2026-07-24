"""Schemas for strategy metadata endpoints."""
from pydantic import BaseModel


class StrategyParameter(BaseModel):
    name: str
    label: str
    type: str
    default: float
    min: float
    max: float
    step: float
    unit: str = ""


class StrategyInfo(BaseModel):
    id: str
    name: str
    description: str
    parameters: list[StrategyParameter]
