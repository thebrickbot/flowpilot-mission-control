from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID, uuid4

from app.api import agent as agent_api
from app.core.agent_auth import AgentAuthContext
from app.models.agents import Agent
from app.core.time import utcnow


def _agent_ctx(
    *,
    board_id: UUID | None,
    status: str,
    is_board_lead: bool,
    last_seen_at: datetime | None = None,
    openclaw_session_id: str | None = None,
) -> AgentAuthContext:
    return AgentAuthContext(
        actor_type="agent",
        agent=Agent(
            id=uuid4(),
            board_id=board_id,
            gateway_id=uuid4(),
            name="Health Probe Agent (OpenClaw)",
            status=status,
            is_board_lead=is_board_lead,
            last_seen_at=last_seen_at,
            openclaw_session_id=openclaw_session_id,
        ),
    )


def test_agent_health_prefers_openclaw_runtime_offline() -> None:
    # Simulate an agent with a stale OpenClaw heartbeat (offline)
    board_id = uuid4()
    last_seen_at = utcnow() - timedelta(minutes=15)
    agent_ctx = _agent_ctx(
        board_id=board_id,
        status="updating",
        is_board_lead=False,
        last_seen_at=last_seen_at,
        openclaw_session_id="openclaw-sess-456",
    )

    response = agent_api.agent_healthz(agent_ctx=agent_ctx)

    # Runtime reports offline; OpenClaw takes precedence over stale UI state
    assert response.ok is True
    assert response.agent_id == agent_ctx.agent.id
    assert response.ui_status == "updating"
    assert response.runtime_status == "offline"
    assert response.status == "offline"
    assert response.status_source == "OpenClaw"
    assert response.runtime_last_seen_at == last_seen_at
