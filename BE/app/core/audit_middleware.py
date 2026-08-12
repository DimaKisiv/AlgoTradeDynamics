"""Generic audit coverage for authenticated state-changing API requests."""
from __future__ import annotations

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.logging import get_logger
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.user import User
from app.services.audit_service import extract_bot_id_from_path, record_audit_event

logger = get_logger(__name__)


class AuditMutationMiddleware(BaseHTTPMiddleware):
    """Record a coarse immutable trace for every authenticated API mutation.

    Semantic trading records are written by the bot/audit service in the same
    transaction.  This middleware is the safety net for settings, notifications,
    backtests and future write endpoints so platform mutations are not silently
    omitted from the audit history.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        method = request.method.upper()
        path = request.url.path
        user_id = self._authenticated_user_id(request)
        response = await call_next(request)

        if (
            user_id is not None
            and path.startswith("/api/")
            and not path.startswith("/api/audit")
            and method in {"POST", "PUT", "PATCH", "DELETE"}
        ):
            db = SessionLocal()
            try:
                user = db.get(User, user_id)
                if user is not None:
                    success = response.status_code < 400
                    event_type = "API_MUTATION_SUCCEEDED" if success else "API_MUTATION_FAILED"
                    record_audit_event(
                        db,
                        actor_type="USER",
                        actor_label=user.email,
                        category="API_ACTION",
                        event_type=event_type,
                        message=f"{method} {path}",
                        user_id=user.id,
                        bot_id=extract_bot_id_from_path(path),
                        ip_address=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        correlation_id=f"http:{method}:{path}",
                        status=str(response.status_code),
                        payload={
                            "method": method,
                            "path": path,
                            "status_code": response.status_code,
                            "query": dict(request.query_params),
                        },
                    )
                    db.commit()
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                # Audit logging must never turn a successful trade/API response into
                # an application failure.  Operational monitoring should surface it.
                logger.error("Audit mutation logging failed: %s %s: %s", method, path, exc)
            finally:
                db.close()

        return response

    @staticmethod
    def _authenticated_user_id(request: Request) -> int | None:
        authorization = request.headers.get("authorization", "")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
        try:
            payload = decode_access_token(token)
            return int(payload.get("sub"))
        except Exception:  # noqa: BLE001
            return None
