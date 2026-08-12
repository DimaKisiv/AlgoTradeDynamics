"""Database-backed request operations log for MVP observability."""
from __future__ import annotations

import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.logging import get_logger
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.services.audit_service import extract_bot_id_from_path
from app.services.operations_service import record_operation_log

logger = get_logger(__name__)


class OperationsLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        # Avoid log-on-log recursion/noise and keep health checks cheap.
        should_log = (
            path.startswith("/api/")
            and not path.startswith("/api/operations/logs")
            and path != "/api/privacy/delete-account"
        )
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            if should_log:
                self._persist(
                    request=request,
                    request_id=request_id,
                    status_code=500,
                    duration_ms=(time.perf_counter() - started) * 1000,
                    message=f"Unhandled {type(exc).__name__}: {str(exc)[:600]}",
                    error_type=type(exc).__name__,
                )
            raise

        response.headers["X-Request-ID"] = request_id
        if should_log:
            self._persist(
                request=request,
                request_id=request_id,
                status_code=response.status_code,
                duration_ms=(time.perf_counter() - started) * 1000,
                message=f"{request.method.upper()} {path} -> {response.status_code}",
            )
        return response

    def _persist(
        self,
        *,
        request: Request,
        request_id: str,
        status_code: int,
        duration_ms: float,
        message: str,
        error_type: str | None = None,
    ) -> None:
        db = SessionLocal()
        try:
            user_id = self._authenticated_user_id(request)
            level = "ERROR" if status_code >= 500 else "WARN" if status_code >= 400 else "INFO"
            path = request.url.path
            record_operation_log(
                db,
                level=level,
                service="API",
                message=message,
                request_id=request_id,
                correlation_id=f"http:{request.method.upper()}:{path}",
                user_id=user_id,
                bot_id=extract_bot_id_from_path(path),
                method=request.method.upper(),
                path=path,
                status_code=status_code,
                duration_ms=round(duration_ms, 3),
                error_type=error_type,
            )
            db.commit()
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            logger.error("Operations log persistence failed: %s", exc)
        finally:
            db.close()

    @staticmethod
    def _authenticated_user_id(request: Request) -> int | None:
        authorization = request.headers.get("authorization", "")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
        try:
            return int(decode_access_token(token).get("sub"))
        except Exception:  # noqa: BLE001
            return None
