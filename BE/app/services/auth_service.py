"""Service layer for user registration, authentication and refresh sessions."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    """SQLite may return a naive datetime even for timezone-aware columns."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, email: str, password: str) -> User:
    user = User(email=email, hashed_password=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User | None:
    """Return the user for valid credentials, otherwise return None."""
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.hashed_password):
        return None
    return user


def create_refresh_session(db: Session, user_id: int) -> str:
    """Create a refresh session and return the raw secret exactly once."""
    settings = get_settings()
    raw_token = generate_refresh_token()
    session = RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=_utcnow() + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(session)
    db.commit()
    return raw_token


def rotate_refresh_session(db: Session, raw_token: str) -> tuple[User, str] | None:
    """Validate and revoke one refresh token, then create its replacement."""
    token_hash = hash_refresh_token(raw_token)
    session = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .with_for_update()
        .first()
    )
    now = _utcnow()
    if (
        session is None
        or session.revoked_at is not None
        or _as_utc(session.expires_at) <= now
    ):
        return None

    user = db.get(User, session.user_id)
    if user is None:
        return None

    settings = get_settings()
    replacement = generate_refresh_token()
    session.revoked_at = now
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(replacement),
            expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    db.commit()
    return user, replacement


def revoke_refresh_session(db: Session, raw_token: str) -> None:
    """Revoke a refresh session if it exists; logout remains idempotent."""
    session = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == hash_refresh_token(raw_token))
        .first()
    )
    if session is not None and session.revoked_at is None:
        session.revoked_at = _utcnow()
        db.commit()
