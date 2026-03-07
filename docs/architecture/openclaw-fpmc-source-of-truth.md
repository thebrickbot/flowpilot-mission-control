OpenClaw-FPMC source-of-truth contract

Goal
- Define how runtime state, agent policy, and templates are owned and synchronized between OpenClaw (runtime truth) and FPMC (control/UI plane).

Ownership model
- OpenClaw-owned state
  - Model, tools, workspace files, heartbeats, execution guardrails, and live session health.
- FPMC-owned state
  - Boards, task orchestration, approvals, and board/group visibility.
- Synchronized/write-through state
  - Identity templates, soul/guardrail templates, and agent binding metadata.

Concrete examples
- OpenClaw owns:
  - model, tools, workspace files, heartbeats, execution guardrails, live session health
- FPMC owns:
  - boards, task orchestration, approvals, board visibility
- Sync/write-through:
  - identity templates, soul/guardrail templates, agent binding metadata

Current assumptions (derived from review of templates and UI paths)
- BOARD_SOUL.md.j2 and BOARD_AGENTS.md.j2 currently reflect FPMC-driven rendering and do not guarantee runtime truth to OpenClaw.
- Frontend agent-status displays aggregates of both desired (FPMC) and runtime (OpenClaw) states, sometimes masking discrepancies.
- There are places where FPMC acts as a source of truth (UI and modeling) rather than the runtime, which is OpenClaw-owned.

Rule
- If OpenClaw runtime state and FPMC UI disagree, OpenClaw wins.

Minimal sync/write-through contract
- When FPMC changes policy/templates, write-through should reach OpenClaw workspaces and apply to runtime state.
- Changes to agent identity templates and guardrails should be reflected in OpenClaw workspace files (SOUL.md, AGENTS.md) via explicit write-through/sync actions.
- Bindings between agent identifiers in FPMC and OpenClaw runtime should be stable and auditable.

Linking
- This contract will be referenced by the docs index and related documentation.
