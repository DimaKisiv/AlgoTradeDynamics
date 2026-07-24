"""Health-check endpoints."""
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def healthcheck() -> dict:
    return {"status": "ok"}
