"""Health and readiness probe response schemas."""

from __future__ import annotations

from datetime import datetime

from uuid import UUID

from pydantic import Field
from sqlmodel import SQLModel


class HealthStatusResponse(SQLModel):
    """Standard payload for service liveness/readiness checks."""

    ok: bool = Field(
        description="Indicates whether the probe check succeeded.",
        examples=[True],
    )


class AgentHealthStatusResponse(HealthStatusResponse):
    """Agent-authenticated liveness payload for agent route probes."""

    agent_id: UUID = Field(
        description="Authenticated agent id derived from `X-Agent-Token`.",
        examples=["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
    )
    board_id: UUID | None = Field(
        default=None,
        description="Board scope for the authenticated agent, when applicable.",
        examples=["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"],
    )
    gateway_id: UUID = Field(
        description="Gateway owning the authenticated agent.",
        examples=["cccccccc-cccc-cccc-cccc-cccccccccccc"],
    )
    status: str = Field(
        description="Current persisted lifecycle status for the authenticated agent.",
        examples=["online", "healthy", "updating"],
    )
    is_board_lead: bool = Field(
        description="Whether the authenticated agent is the board lead.",
        examples=[False],
    )
    # New runtime-derived fields (OpenClaw-backed state)
    runtime_status: str | None = Field(
        default=None,
        description="Derive runtime health from the OpenClaw runtime state.",
        examples=["online", "offline", "stale"],
    )
    runtime_last_seen_at: datetime | None = Field(
        default=None,
        description="Last seen timestamp from the OpenClaw runtime heartbeat.",
    )
    runtime_session_id: str | None = Field(
        default=None,
        description="OpenClaw session id associated with the agent runtime.",
        examples=["sess-abc123"],
    )
    ui_status: str | None = Field(
        default=None,
        description="The UI/configured status for the agent (FPMC).",
    )
    status_source: str | None = Field(
        default=None,
        description="Source of truth for the current health status.",
        examples=["OpenClaw", "FPMC"],
    )
