"""Authentication endpoints: register, login, refresh, logout and current user."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.backtest import BacktestRun
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse
from app.services.audit_service import record_audit_event
from app.services.auth_service import (
    authenticate,
    create_refresh_session,
    create_user,
    get_user_by_email,
    revoke_refresh_session,
    rotate_refresh_session,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
logger = get_logger(__name__)


def _request_meta(request: Request) -> tuple[str | None, str | None]:
    return (request.client.host if request.client else None, request.headers.get("user-agent"))


def _to_response(user: User, runs_count: int) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        runs_count=runs_count,
    )


def _token_response(user_id: int) -> Token:
    settings = get_settings()
    return Token(
        access_token=create_access_token(user_id),
        expires_in=settings.access_token_expire_minutes * 60,
    )


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        path="/api/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path="/api/auth",
        secure=settings.refresh_cookie_secure,
        httponly=True,
        samesite=settings.refresh_cookie_samesite,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    if get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Користувач з таким email вже існує",
        )
    user = create_user(db, payload.email, payload.password)
    ip, user_agent = _request_meta(request)
    record_audit_event(
        db, actor_type="USER", actor_label=user.email, category="SECURITY", event_type="USER_REGISTERED",
        message="User account registered", user_id=user.id, ip_address=ip, user_agent=user_agent,
        correlation_id=f"user:{user.id}", payload={"email": user.email},
    )
    db.commit()
    logger.info("New user registered: id=%s", user.id)
    return _to_response(user, 0)


@router.post("/login", response_model=Token)
def login(payload: UserLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    user = authenticate(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невірний email або пароль",
        )

    refresh_token = create_refresh_session(db, user.id)
    _set_refresh_cookie(response, refresh_token)
    ip, user_agent = _request_meta(request)
    record_audit_event(
        db, actor_type="USER", actor_label=user.email, category="SECURITY", event_type="USER_LOGIN",
        message="User authenticated", user_id=user.id, ip_address=ip, user_agent=user_agent,
        correlation_id=f"user:{user.id}",
    )
    db.commit()
    logger.info("User logged in: id=%s", user.id)
    return _token_response(user.id)


@router.post("/refresh", response_model=Token)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    settings = get_settings()
    raw_token = request.cookies.get(settings.refresh_cookie_name)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token відсутній",
        )

    rotated = rotate_refresh_session(db, raw_token)
    if rotated is None:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token недійсний або протермінований",
        )

    user, replacement = rotated
    _set_refresh_cookie(response, replacement)
    ip, user_agent = _request_meta(request)
    record_audit_event(
        db, actor_type="SYSTEM", actor_label=user.email, category="SECURITY", event_type="SESSION_REFRESHED",
        message="Access session refreshed", user_id=user.id, ip_address=ip, user_agent=user_agent,
        correlation_id=f"user:{user.id}",
    )
    db.commit()
    logger.info("Refresh token rotated: user_id=%s", user.id)
    return _token_response(user.id)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    settings = get_settings()
    raw_token = request.cookies.get(settings.refresh_cookie_name)
    if raw_token:
        revoke_refresh_session(db, raw_token)
    _clear_refresh_cookie(response)
    return None


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    runs_count = (
        db.query(BacktestRun).filter(BacktestRun.user_id == current_user.id).count()
    )
    return _to_response(current_user, runs_count)
