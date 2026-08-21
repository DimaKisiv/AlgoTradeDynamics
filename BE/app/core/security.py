"""Security helpers: password hashing, access JWTs and refresh-token hashing."""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import get_settings

# New passwords use Argon2. Bcrypt remains enabled so users created by older
# project versions can still sign in after the dependency upgrade.
password_hash = PasswordHash((Argon2Hasher(), BcryptHasher()))


def hash_password(password: str) -> str:
    """Return an Argon2 password hash with an automatically generated salt."""
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against an Argon2 or legacy bcrypt hash."""
    return password_hash.verify(plain_password, hashed_password)


def create_access_token(subject: str | int) -> str:
    """Create a short-lived signed JWT for API authorization."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {
        "sub": str(subject),
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "jti": uuid.uuid4().hex,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Decode and validate an access JWT, rejecting non-access token types."""
    settings = get_settings()
    payload = jwt.decode(
        token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Invalid token type")
    return payload


def generate_refresh_token() -> str:
    """Return a cryptographically secure opaque refresh-token secret."""
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    """Hash an opaque refresh token before database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
