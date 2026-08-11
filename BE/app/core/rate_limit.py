"""Small in-memory API rate limiter for the demo/MVP deployment.

The limiter intentionally avoids Redis/external infrastructure. It is process-local,
which is appropriate for the current single-backend MVP container. Production
horizontal scaling should move counters to a shared store such as Redis.
"""
from __future__ import annotations

import math
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock
from typing import Deque

import jwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from app.core.config import Settings, get_settings


@dataclass(frozen=True)
class RateLimitPolicy:
    """One request budget for one route family."""

    name: str
    limit: int
    window_seconds: int
    key_by_user: bool = False


class InMemoryRateLimiter:
    """Thread-safe sliding-window limiter backed by process memory."""

    def __init__(self) -> None:
        self._requests: dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()
        self._checks = 0

    def check(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int, int, int]:
        """Return (allowed, remaining, retry_after_seconds, reset_epoch_seconds)."""
        now = time.monotonic()
        now_epoch = time.time()
        cutoff = now - window_seconds

        with self._lock:
            bucket = self._requests[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= limit:
                retry_after = max(1, math.ceil(bucket[0] + window_seconds - now))
                reset_at = math.ceil(now_epoch + retry_after)
                return False, 0, retry_after, reset_at

            bucket.append(now)
            remaining = max(0, limit - len(bucket))
            reset_in = max(1, math.ceil(bucket[0] + window_seconds - now))
            reset_at = math.ceil(now_epoch + reset_in)

            # Opportunistic cleanup so inactive identities do not remain forever.
            self._checks += 1
            if self._checks % 500 == 0:
                self._cleanup(now)

            return True, remaining, 0, reset_at

    def _cleanup(self, now: float) -> None:
        # Policies in this app use windows <= 5 minutes by default. Keeping idle
        # buckets for 10 minutes is enough and avoids per-request global scans.
        stale_before = now - 600
        stale_keys = [
            key for key, bucket in self._requests.items() if not bucket or bucket[-1] < stale_before
        ]
        for key in stale_keys:
            self._requests.pop(key, None)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply route-specific rate limits and emit standard 429 metadata."""

    def __init__(self, app, settings: Settings | None = None) -> None:
        super().__init__(app)
        self.settings = settings or get_settings()
        self.limiter = InMemoryRateLimiter()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self.settings.rate_limit_enabled:
            return await call_next(request)

        policy = self._policy_for(request)
        if policy is None:
            return await call_next(request)

        identity = self._identity(request, key_by_user=policy.key_by_user)
        bucket_key = f"{policy.name}:{identity}"
        allowed, remaining, retry_after, reset_at = self.limiter.check(
            bucket_key,
            policy.limit,
            policy.window_seconds,
        )

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Please retry later.",
                    "rate_limit": {
                        "scope": policy.name,
                        "limit": policy.limit,
                        "window_seconds": policy.window_seconds,
                    },
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(policy.limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_at),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(policy.limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_at)
        return response

    def _policy_for(self, request: Request) -> RateLimitPolicy | None:
        path = request.url.path.rstrip("/") or "/"
        method = request.method.upper()

        if method == "POST" and path == "/api/auth/login":
            return RateLimitPolicy(
                "auth_login",
                self.settings.rate_limit_login_requests,
                self.settings.rate_limit_login_window_seconds,
            )
        if method == "POST" and path == "/api/auth/register":
            return RateLimitPolicy(
                "auth_register",
                self.settings.rate_limit_register_requests,
                self.settings.rate_limit_register_window_seconds,
            )
        if method == "POST" and path == "/api/auth/refresh":
            return RateLimitPolicy(
                "auth_refresh",
                self.settings.rate_limit_refresh_requests,
                self.settings.rate_limit_refresh_window_seconds,
            )

        if not path.startswith("/api/"):
            return None

        if method in {"POST", "PUT", "PATCH", "DELETE"}:
            return RateLimitPolicy(
                "api_write",
                self.settings.rate_limit_api_write_requests,
                self.settings.rate_limit_api_write_window_seconds,
                key_by_user=True,
            )

        return RateLimitPolicy(
            "api_read",
            self.settings.rate_limit_api_requests,
            self.settings.rate_limit_api_window_seconds,
            key_by_user=True,
        )

    def _identity(self, request: Request, *, key_by_user: bool) -> str:
        if key_by_user:
            authorization = request.headers.get("authorization", "")
            scheme, _, token = authorization.partition(" ")
            if scheme.lower() == "bearer" and token:
                try:
                    payload = jwt.decode(
                        token,
                        self.settings.jwt_secret_key,
                        algorithms=[self.settings.jwt_algorithm],
                    )
                    if payload.get("type") == "access":
                        subject = payload.get("sub")
                        if subject is not None:
                            return f"user:{subject}"
                except jwt.PyJWTError:
                    # Auth dependency will produce the actual 401. For limiting an
                    # invalid/expired token we safely fall back to client IP.
                    pass

        return f"ip:{self._client_ip(request)}"

    def _client_ip(self, request: Request) -> str:
        # Never trust X-Forwarded-For by default: a direct client can spoof it.
        # Enable only behind a reverse proxy that overwrites/sanitizes this header.
        if self.settings.rate_limit_trust_proxy_headers:
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                return forwarded.split(",", 1)[0].strip()
            real_ip = request.headers.get("x-real-ip")
            if real_ip:
                return real_ip.strip()

        if request.client and request.client.host:
            return request.client.host
        return "unknown"
