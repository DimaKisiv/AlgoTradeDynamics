"""User-scoped operational logs and incident register."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.operations import Incident, OperationLog
from app.models.user import User
from app.schemas.compliance import IncidentListResponse, OperationLogListResponse

router = APIRouter(prefix="/operations", tags=["Operations & Incidents"])


@router.get("/logs", response_model=OperationLogListResponse)
def list_operation_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    level: str | None = None,
    bot_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(OperationLog).filter(OperationLog.user_id == current_user.id)
    if level:
        query = query.filter(OperationLog.level == level.upper())
    if bot_id is not None:
        query = query.filter(OperationLog.bot_id == bot_id)
    total = query.count()
    items = query.order_by(desc(OperationLog.occurred_at), desc(OperationLog.id)).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/incidents", response_model=IncidentListResponse)
def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: str | None = None,
    severity: str | None = None,
    bot_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Incident).filter(Incident.user_id == current_user.id)
    if status:
        query = query.filter(Incident.status == status.upper())
    if severity:
        query = query.filter(Incident.severity == severity.upper())
    if bot_id is not None:
        query = query.filter(Incident.bot_id == bot_id)
    total = query.count()
    items = query.order_by(desc(Incident.opened_at), desc(Incident.id)).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}
