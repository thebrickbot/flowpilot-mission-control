# ruff: noqa: S101
"""Guardrails template presence tests for worker boards."""

from __future__ import annotations

from pathlib import Path

TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "templates"

GUARDRAILS_SECTION_HEADER = "## Guardrails"
GUARDRAIL_LINES = [
    "Do not contact leads.",
    "Do not send outreach messages.",
    "Do not change pipeline stages.",
    "Do not create, infer, or store data without evidence.",
]


def test_board_soul_template_includes_guardrails_block() -> None:
    path = TEMPLATES_DIR / "BOARD_SOUL.md.j2"
    text = path.read_text()
    assert GUARDRAILS_SECTION_HEADER in text, "Guardrails section missing in BOARD_SOUL.md.j2"
    for line in GUARDRAIL_LINES:
        assert line in text, f"Guardrail line missing in BOARD_SOUL.md.j2: {line}"


def test_board_agents_template_includes_guardrails_block() -> None:
    path = TEMPLATES_DIR / "BOARD_AGENTS.md.j2"
    text = path.read_text()
    assert GUARDRAILS_SECTION_HEADER in text, "Guardrails section missing in BOARD_AGENTS.md.j2"
    for line in GUARDRAIL_LINES:
        assert line in text, f"Guardrail line missing in BOARD_AGENTS.md.j2: {line}"
