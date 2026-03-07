from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from app.api import agent as agent_api
from app.core.agent_auth import AgentAuthContext
from app.core.time import utcnow
from app.models.agents import Agent


def test_fb_marketplace_agent_policy_and_health_flow() -> None:
    last_seen_at = utcnow() - timedelta(minutes=16)
    soul_template = """Sweep FB Marketplace for bike bag hire/rental listings.\n\n## Guardrails\n- Do not contact leads.\n- Do not send outreach messages.\n- Do not change pipeline stages.\n- Do not create, infer, or store data without evidence.\n"""

    agent = Agent(
        id=uuid4(),
        board_id=uuid4(),
        gateway_id=uuid4(),
        name="FB Marketplace Scout",
        status="updating",
        is_board_lead=False,
        last_seen_at=last_seen_at,
        openclaw_session_id="agent:mc-fc0a959f-5cd0-4b43-89fd-7c630b955ac1:main",
        soul_template=soul_template,
    )
    ctx = AgentAuthContext(actor_type="agent", agent=agent)

    response = agent_api.agent_healthz(agent_ctx=ctx)

    assert response.ok is True
    assert response.ui_status == "updating"
    assert response.runtime_status == "offline"
    assert response.status == "offline"
    assert response.status_source == "OpenClaw"
    assert response.runtime_session_id == agent.openclaw_session_id

    assert "## Guardrails" in (agent.soul_template or "")
    assert "Do not contact leads." in (agent.soul_template or "")
    assert "Do not send outreach messages." in (agent.soul_template or "")
    assert "Do not change pipeline stages." in (agent.soul_template or "")
    assert "Do not create, infer, or store data without evidence." in (agent.soul_template or "")
