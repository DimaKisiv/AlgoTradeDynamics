"""Compliance policy and jurisdiction metadata for the diploma MVP."""
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.models.user import User
from app.schemas.compliance import ComplianceOverviewResponse

router = APIRouter(prefix="/compliance", tags=["Compliance"])


@router.get("/overview", response_model=ComplianceOverviewResponse)
def compliance_overview(current_user: User = Depends(get_current_user)):
    del current_user  # authorization boundary; policy itself is platform-wide
    settings = get_settings()
    return {
        "reference_jurisdiction": settings.audit_jurisdiction,
        "compliance_status": "Compliance-oriented diploma MVP; not a statement of licence or legal authorization",
        "frameworks_considered": [
            "GDPR data-protection principles",
            "MiCA-oriented crypto-asset record keeping",
            "DORA-oriented ICT resilience and incident management principles",
        ],
        "hosting_target_region": settings.hosting_target_region,
        "hosting_provider": settings.hosting_provider,
        "data_residency": "Production target: EU/EEA region. Cross-border transfers require an appropriate legal mechanism.",
        "backup_policy": {
            "frequency": settings.backup_frequency,
            "daily_retention_days": settings.backup_retention_days,
            "monthly_retention_months": settings.monthly_backup_retention_months,
            "implementation": "Policy target. A pg_dump helper script is included; production scheduling/provider snapshots must enforce the cadence.",
        },
        "recovery_targets": {
            "RPO_hours": settings.recovery_point_objective_hours,
            "RTO_hours": settings.recovery_time_objective_hours,
        },
        "retention_matrix": [
            {"data_type": "Regulatory audit / financial activity", "retention": f"{settings.audit_retention_years} years", "basis": "Compliance-oriented record keeping", "deletion_behavior": "Immutable during retention; preserved on account deletion where retention is required"},
            {"data_type": "Operations logs", "retention": f"{settings.operations_log_retention_days} days", "basis": "Security and service reliability", "deletion_behavior": "Retention-bound operational data"},
            {"data_type": "Incident register", "retention": f"{settings.incident_retention_days} days", "basis": "Operational resilience / incident investigation", "deletion_behavior": "Retention-bound incident data"},
            {"data_type": "Refresh sessions", "retention": f"Up to {settings.refresh_token_expire_days} days", "basis": "Authentication session management", "deletion_behavior": "Revoked/expired and removed with account"},
            {"data_type": "Telegram linking token", "retention": f"{settings.telegram_link_expire_minutes} minutes", "basis": "Secure account linking", "deletion_behavior": "Single-use/expired and removed with account"},
            {"data_type": "Profile and preferences", "retention": "Until account deletion", "basis": "Service delivery", "deletion_behavior": "Deleted with account"},
            {"data_type": "Backtests and ordinary bot history", "retention": "User-controlled", "basis": "Requested product functionality", "deletion_behavior": "Can be deleted/cleared by the user"},
        ],
        "third_parties": [
            {"name": "Bybit", "purpose": "Exchange connectivity and order execution for configured exchange modes", "data_shared": "API requests required for market/trading operations"},
            {"name": "Telegram", "purpose": "Optional out-of-app notifications", "data_shared": "Telegram chat identifier, username (if available), notification content"},
            {"name": settings.hosting_provider, "purpose": "Production infrastructure / data hosting", "data_shared": "Application and database data according to deployment configuration"},
        ],
        "privacy_principles": [
            "Data minimization and purpose limitation",
            "Access control and per-user ownership boundaries",
            "Export of user-related data",
            "Account deletion for operational/profile data",
            "Regulatory audit records may be retained separately where a legal/compliance retention basis applies",
            "Secrets, passwords and API credentials are excluded/redacted from audit payloads",
        ],
    }
