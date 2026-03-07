from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest

import app.services.openclaw.provisioning as agent_provisioning


class _ControlPlaneStub:
    def __init__(self, *, existing: dict[str, str]) -> None:
        self._existing = dict(existing)
        self.writes: list[tuple[str, str]] = []

    async def ensure_agent_session(self, session_key, *, label=None):
        return None

    async def reset_agent_session(self, session_key):
        return None

    async def delete_agent_session(self, session_key):
        return None

    async def upsert_agent(self, registration):
        return None

    async def delete_agent(self, agent_id, *, delete_files=True):
        return None

    async def list_agent_files(self, agent_id):
        return {
            name: {"name": name, "missing": False}
            for name in self._existing
        }

    async def get_agent_file_payload(self, *, agent_id: str, name: str):
        content = self._existing.get(name)
        if content is None:
            raise agent_provisioning.OpenClawGatewayError("file not found")
        return {"content": content}

    async def set_agent_file(self, *, agent_id, name, content):
        self.writes.append((name, content))

    async def patch_agent_heartbeats(self, entries):
        return None


@dataclass
class _GatewayTiny:
    id: UUID
    name: str
    url: str
    token: str | None
    workspace_root: str
    allow_insecure_tls: bool = False
    disable_device_pairing: bool = False


class _Manager(agent_provisioning.BaseAgentLifecycleManager):
    def _agent_id(self, agent):
        return "agent-x"

    def _build_context(self, *, agent, auth_token, user, board):
        return {}


@pytest.mark.asyncio
async def test_policy_sync_skips_unchanged_soul_and_agents_files_on_update() -> None:
    gateway = _GatewayTiny(id=uuid4(), name="G", url="ws://x", token=None, workspace_root="/tmp")
    cp = _ControlPlaneStub(existing={"SOUL.md": "same", "AGENTS.md": "same"})
    mgr = _Manager(gateway, cp)  # type: ignore[arg-type]

    await mgr._set_agent_files(
        agent_id="agent-x",
        rendered={"SOUL.md": "same", "AGENTS.md": "same"},
        existing_files=await cp.list_agent_files("agent-x"),
        action="update",
    )

    assert cp.writes == []


@pytest.mark.asyncio
async def test_policy_sync_writes_changed_soul_when_agents_is_unchanged() -> None:
    gateway = _GatewayTiny(id=uuid4(), name="G", url="ws://x", token=None, workspace_root="/tmp")
    cp = _ControlPlaneStub(existing={"SOUL.md": "old", "AGENTS.md": "same"})
    mgr = _Manager(gateway, cp)  # type: ignore[arg-type]

    await mgr._set_agent_files(
        agent_id="agent-x",
        rendered={"SOUL.md": "new", "AGENTS.md": "same"},
        existing_files=await cp.list_agent_files("agent-x"),
        action="update",
    )

    assert cp.writes == [("SOUL.md", "new")]
