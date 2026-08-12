"""Schemas for compliance policy, privacy controls and operations observability."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RetentionPolicyItem(BaseModel):
    data_type: str
    retention: str
    basis: str
    deletion_behavior: str


class ThirdPartyItem(BaseModel):
    name: str
    purpose: str
    data_shared: str


class ComplianceOverviewResponse(BaseModel):
    reference_jurisdiction: str
    compliance_status: str
    frameworks_considered: list[str]
    hosting_target_region: str
    hosting_provider: str
    data_residency: str
    backup_policy: dict[str, Any]
    recovery_targets: dict[str, Any]
    retention_matrix: list[RetentionPolicyItem]
    third_parties: list[ThirdPartyItem]
    privacy_principles: list[str]


class AccountDeleteRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    confirmation: str


class OperationLogResponse(BaseModel):
    id: int
    occurred_at: datetime
    level: str
    service: str
    request_id: str | None = None
    correlation_id: str | None = None
    user_id: int | None = None
    bot_id: int | None = None
    method: str | None = None
    path: str | None = None
    status_code: int | None = None
    duration_ms: float | None = None
    exchange: str | None = None
    error_type: str | None = None
    message: str
    retention_until: datetime

    model_config = {"from_attributes": True}


class OperationLogListResponse(BaseModel):
    items: list[OperationLogResponse]
    total: int
    page: int
    page_size: int


class IncidentResponse(BaseModel):
    id: int
    opened_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None
    retention_until: datetime
    user_id: int | None = None
    bot_id: int | None = None
    source_event_id: int | None = None
    correlation_id: str | None = None
    severity: str
    incident_type: str
    status: str
    title: str
    description: str | None = None
    action_taken: str | None = None
    resolution: str | None = None

    model_config = {"from_attributes": True}


class IncidentListResponse(BaseModel):
    items: list[IncidentResponse]
    total: int
    page: int
    page_size: int
