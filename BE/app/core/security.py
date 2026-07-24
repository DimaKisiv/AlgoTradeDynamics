"""Security helpers: password hashing (bcrypt) + JWT access tokens (HS256)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

# bcrypt via passlib — стандартний підхід для хешування паролів.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Повертає bcrypt-хеш пароля (сіль генерується автоматично)."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Перевіряє, чи відповідає пароль збереженому хешу."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str | int) -> str:
    """Створює підписаний JWT з `sub` (id користувача) та терміном дії."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Декодує та валідує JWT. Кидає jwt.PyJWTError при недійсному токені."""
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
