# OpenClaw Runtime Source of Truth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make OpenClaw the source of truth for agent execution policy and runtime health, with FPMC acting as a control/UI layer that reads and writes OpenClaw-backed state instead of maintaining a drifting parallel reality.

**Architecture:** Move agent behavior and runtime truth to OpenClaw-owned workspace/templates/config, then have FPMC surface and mutate that state through explicit sync/write-through mechanisms. Start with the narrow vertical slice already validated by the FB Marketplace agent: guardrails, model/runtime settings, session health, and template generation.

**Tech Stack:** FastAPI backend, Next.js frontend, TypeScript MCP server, Jinja board templates, OpenClaw agent workspaces/config, pytest/vitest.

---

### Task 1: Document the source-of-truth contract

**Files:**
- Create: `docs/architecture/openclaw-fpmc-source-of-truth.md`
- Modify: `README.md` or `docs/README.md` if there is an architecture index

**Step 1: Write the failing artifact**
Create a short architecture doc defining three categories:
- OpenClaw-owned state
- FPMC-owned state
- synchronized/write-through state

Include concrete examples:
- OpenClaw owns: model, tools, workspace files, heartbeats, execution guardrails, live session health
- FPMC owns: boards, task orchestration, approvals, board/group visibility
- Sync/write-through: identity templates, soul/guardrail templates, agent binding metadata

**Step 2: Review current assumptions**
Inspect:
- `backend/templates/BOARD_SOUL.md.j2`
- `backend/templates/BOARD_AGENTS.md.j2`
- backend/frontend code paths that display agent status and templates

Expected: clear list of places where FPMC currently behaves like a source of truth when it should not.

**Step 3: Write minimal documentation**
Write the doc with one explicit rule:
> If OpenClaw runtime state and FPMC UI disagree, OpenClaw wins.

**Step 4: Link it from repo docs**
Add one link from the nearest docs index.

**Step 5: Commit**
```bash
git add docs/architecture/openclaw-fpmc-source-of-truth.md README.md docs/README.md
git commit -m "docs: define OpenClaw as runtime source of truth"
```

### Task 2: Add explicit worker guardrail fields to backend templates

**Files:**
- Modify: `backend/templates/BOARD_SOUL.md.j2`
- Modify: `backend/templates/BOARD_AGENTS.md.j2`
- Test: `backend/tests/test_template_size_budget.py`
- Create: `backend/tests/test_board_worker_guardrails_templates.py`

**Step 1: Write the failing test**
Add a backend test that renders a worker board workspace with supplied role/soul content and asserts the output includes an explicit guardrail section.

Assert examples like:
- `Do not contact leads.`
- `Do not send outreach messages.`
- `Do not change pipeline stages.`
- `Do not create, infer, or store data without evidence.`

**Step 2: Run test to verify it fails**
Run:
```bash
cd backend
pytest tests/test_board_worker_guardrails_templates.py -v
```
Expected: FAIL because templates do not yet guarantee explicit negative guardrails.

**Step 3: Write minimal template implementation**
Add a standard worker guardrails block to the worker branch of:
- `BOARD_SOUL.md.j2`
- `BOARD_AGENTS.md.j2`

Design rule:
- support a board/agent-specific guardrail override if available
- otherwise inject a sane default negative-boundary block

**Step 4: Run tests**
Run:
```bash
cd backend
pytest tests/test_board_worker_guardrails_templates.py tests/test_template_size_budget.py -v
```
Expected: PASS.

**Step 5: Commit**
```bash
git add backend/templates/BOARD_SOUL.md.j2 backend/templates/BOARD_AGENTS.md.j2 backend/tests/test_board_worker_guardrails_templates.py backend/tests/test_template_size_budget.py
git commit -m "feat: add explicit worker guardrails to board templates"
```

### Task 3: Expose agent policy/template update paths in the FPMC MCP

**Files:**
- Modify: `mcp-server/src/tools/agents.ts` (or create if missing in source tree)
- Modify: `mcp-server/src/lib/client.ts`
- Modify: `mcp-server/src/index.ts` only if registration changes are needed
- Test: `mcp-server` test files if present, otherwise backend API tests for route compatibility

**Step 1: Write the failing test/spec**
Create a test or at minimum a typed client contract for an MCP tool that can update agent policy/template fields, such as:
- `agents_update_policy`
- or `agents_update_templates`

Inputs should support at least:
- `agent_id`
- `identity_template?`
- `soul_template?`
- `guardrails?`

**Step 2: Run the test/build to verify it fails**
Run the relevant test/build command for `mcp-server`.
Expected: FAIL because no update tool exists today.

**Step 3: Implement the client/tool minimally**
Add a write-capable MCP tool that updates FPMC-side agent template metadata.

Rule:
- this tool is for UI/control-plane editing only
- it must be clearly documented as writing desired policy that must sync through to OpenClaw runtime

**Step 4: Verify schema**
Run:
```bash
cd mcp-server
npm test
# or
npm run build
```
Then verify:
```bash
mcporter list fpmc --schema
```
Expected: new update tool visible.

**Step 5: Commit**
```bash
git add mcp-server/src
 git commit -m "feat: add MCP tool for agent policy updates"
```

### Task 4: Add backend write-through sync for policy/templates into OpenClaw workspaces

**Files:**
- Modify: backend service/module responsible for agent provisioning and workspace materialization
- Likely inspect/modify: `backend/scripts/sync_gateway_templates.py`
- Likely inspect/modify: agent provisioning services under `backend/app/...`
- Create: `backend/tests/test_agent_policy_sync_to_openclaw_workspace.py`

**Step 1: Write the failing test**
Create an integration-style test that:
1. updates an agent’s soul/guardrails in FPMC
2. triggers sync/materialization
3. asserts the OpenClaw workspace files (`SOUL.md`, `AGENTS.md`) contain the new guardrails

**Step 2: Run test to verify it fails**
Run the focused pytest file.
Expected: FAIL because current sync path does not round-trip policy cleanly.

**Step 3: Implement minimal sync**
Ensure the backend can render/update the OpenClaw workspace from FPMC-stored agent template state.

Requirements:
- idempotent writes
- safe overwrite rules
- only agent-managed regions should be overwritten if partial-file updates are needed
- log sync actions clearly

**Step 4: Run tests**
Run focused test + relevant provisioning/template tests.
Expected: PASS.

**Step 5: Commit**
```bash
git add backend
 git commit -m "feat: sync agent policy into OpenClaw workspaces"
```

### Task 5: Make FPMC health derive from real OpenClaw runtime state

**Files:**
- Modify: backend agent health service/API
- Test: `backend/tests/test_agent_health_api.py`
- Create: `backend/tests/test_agent_health_prefers_openclaw_runtime.py`
- Modify: frontend agent detail/status components once backend shape is stable

**Step 1: Write the failing backend test**
Add a test asserting:
- if FPMC cached status says `updating`
- but OpenClaw session state shows stale/no heartbeat/offline
- returned API health should resolve to an OpenClaw-derived status such as `offline`, `stale`, or `degraded`

**Step 2: Run test to verify it fails**
Run:
```bash
cd backend
pytest tests/test_agent_health_api.py tests/test_agent_health_prefers_openclaw_runtime.py -v
```
Expected: FAIL because current status is too FPMC-centric.

**Step 3: Implement minimal backend logic**
Health precedence rule:
1. live OpenClaw session/heartbeat state
2. recent successful sync/provision state
3. FPMC cached lifecycle label

Also return structured fields like:
- `runtime_status`
- `runtime_last_seen_at`
- `runtime_session_id`
- `ui_status`
- `status_source`

**Step 4: Run tests**
Expected: PASS.

**Step 5: Commit**
```bash
git add backend
 git commit -m "feat: derive agent health from OpenClaw runtime state"
```

### Task 6: Update FPMC UI to distinguish desired state from runtime state

**Files:**
- Modify: frontend agent detail page/components
- Modify: frontend status badges/components
- Test: frontend vitest/cypress coverage around agent detail rendering

**Step 1: Write the failing UI test**
Add a component test for an agent with:
- desired status/template state = `updating`
- runtime state = `offline`

Assert the UI shows both clearly instead of a single misleading badge.

**Step 2: Run test to verify it fails**
Run the relevant frontend test command.
Expected: FAIL because current UI collapses states too aggressively.

**Step 3: Implement minimal UI**
Show separate concepts:
- Runtime health
- Desired/config sync state
- Last seen
- Session binding
- Status source

Design rule:
- never let `Updating` masquerade as healthy runtime.

**Step 4: Run tests**
Expected: PASS.

**Step 5: Commit**
```bash
git add frontend
 git commit -m "feat: separate runtime health from desired sync state in UI"
```

### Task 7: Add a narrow end-to-end check using the FB Marketplace agent case

**Files:**
- Create: `backend/tests/test_fb_marketplace_agent_policy_and_health_flow.py`
- Optionally create a small script under `backend/scripts/` or `mcp-server/scripts/`

**Step 1: Write the failing scenario test**
Model the exact case we just hit:
- worker agent has explicit guardrails
- model is OpenClaw-owned runtime config
- FPMC can read/display desired templates
- offline runtime is shown as offline, not just `updating`

**Step 2: Run test to verify it fails**
Run the focused pytest file.
Expected: FAIL.

**Step 3: Implement glue as needed**
Only add the smallest missing pieces required to make the scenario true.

**Step 4: Run the focused suite**
Run all new tests from Tasks 2–7.
Expected: PASS.

**Step 5: Commit**
```bash
git add backend frontend mcp-server
 git commit -m "test: cover OpenClaw-backed agent policy and health flow"
```

### Task 8: Add operator-facing notes for migration and rollout

**Files:**
- Create: `docs/runbooks/agent-policy-sync-and-health.md`
- Modify: architecture doc from Task 1

**Step 1: Write the runbook**
Include:
- how to change an agent’s guardrails safely
- where model/runtime config lives
- how to verify FPMC vs OpenClaw agreement
- what to do when UI says `Updating`
- how to resync a workspace

**Step 2: Add explicit troubleshooting checks**
Commands/examples should include:
- OpenClaw model status for an agent
- session lookup
- workspace file checks
- MCP checks for agent health/templates

**Step 3: Review for bluntness and usefulness**
Keep it practical. No fluffy architecture sermonizing.

**Step 4: Commit**
```bash
git add docs/runbooks/agent-policy-sync-and-health.md docs/architecture/openclaw-fpmc-source-of-truth.md
 git commit -m "docs: add runbook for agent policy sync and health"
```

## Notes / Recommended Order

Recommended implementation order:
1. Task 1 (architecture contract)
2. Task 2 (template guardrails)
3. Task 3 (MCP write surface)
4. Task 4 (sync into OpenClaw)
5. Task 5 (health precedence)
6. Task 6 (UI clarity)
7. Task 7 (end-to-end proof)
8. Task 8 (runbook)

## Quick Reality Check

This plan deliberately avoids a giant rewrite. It aims for a vertical slice that proves the rule:
- OpenClaw owns runtime truth
- FPMC surfaces and edits it without drifting

That gets you out of the current half-truth state fast, without pretending the whole platform needs to be rebuilt first.
