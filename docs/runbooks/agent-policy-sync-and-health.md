# Runbook: agent policy sync and health

See also: `docs/architecture/openclaw-fpmc-source-of-truth.md`

## Overview
This runbook covers how to safely update an agent's policy/templates and verify OpenClaw runtime health alignment with FPMC.

## Core rule
If OpenClaw runtime state and FPMC UI disagree, **OpenClaw wins**.

## Where things live
- **OpenClaw owns runtime truth**
  - model
  - tools
  - workspace files
  - heartbeats
  - execution guardrails
  - live session health
- **FPMC owns control-plane state**
  - boards
  - approvals
  - orchestration
  - desired templates/policy edits
- **Sync/write-through bridge**
  - FPMC desired policy/template changes must materialize into OpenClaw workspace files

## Change agent guardrails safely
1. Update identity/soul templates in FPMC via MCP/API.
2. Prefer updating desired policy in FPMC, not hand-editing runtime files.
3. Trigger or allow write-through sync into the OpenClaw workspace.
4. Verify `SOUL.md` and `AGENTS.md` contain the expected guardrails.

Example guardrails:
- Do not contact leads.
- Do not send outreach messages.
- Do not change pipeline stages.
- Do not create, infer, or store data without evidence.

## Verify model/runtime config
Model/runtime config lives in OpenClaw-owned state. FPMC should display it, not invent it.

Useful checks:
```bash
openclaw models status --agent <agent-id> --status-plain
openclaw sessions --all-agents --active 10080 --json
```

## Verify OpenClaw vs FPMC agreement
Check three places:
1. FPMC desired template/policy state
2. OpenClaw workspace files
3. OpenClaw runtime/session health

If they disagree:
- trust OpenClaw runtime for health
- trust workspace materialization for effective runtime policy
- treat FPMC as needing resync or UI correction

## When UI says `Updating`
Do **not** assume runtime is healthy.

Check:
```bash
mcporter call fpmc.agents_get --args '{"agent_id":"<agent-id>"}' --output json
mcporter call fpmc.agents_health_check --args '{"board_id":"<board-id>"}' --output json
```

Interpretation:
- `ui_status=updating` + `runtime_status=offline` → stale/offline runtime, not healthy
- `ui_status=updating` + `runtime_status=online` → active reprovision/update is plausible

## How to resync a workspace
Use the normal FPMC update/provisioning path so changes survive OpenClaw updates.

Minimal pattern:
1. update agent policy via MCP/API
2. let backend provisioning/materialization write through to OpenClaw files
3. verify the resulting files and runtime state

## Workspace file checks
Look for rendered policy in:
- `SOUL.md`
- `AGENTS.md`

Example checks:
```bash
grep -n "Guardrails\|Do not contact leads\|Do not send outreach" ~/.openclaw/workspace-*/SOUL.md
grep -n "Guardrails\|Do not contact leads\|Do not send outreach" ~/.openclaw/workspace-*/AGENTS.md
```

## MCP checks for agent health/templates
```bash
mcporter call fpmc.agents_get --args '{"agent_id":"<agent-id>"}' --output json
mcporter call fpmc.agents_update_policy --args '{"agent_id":"<agent-id>","guardrails":"- Do not contact leads."}' --output json
```

## FB Marketplace agent sanity check
For the FB Marketplace Scout case, healthy interpretation is:
- desired state may be `updating`
- runtime state should still be shown independently
- guardrails must exist in rendered runtime policy
- offline runtime must never be masked by the UI label

## Troubleshooting checklist
- Check OpenClaw model status for the agent
- Check session binding / runtime session id
- Check `last_seen_at` / runtime status
- Check rendered `SOUL.md` and `AGENTS.md`
- Check FPMC desired templates
- If needed, reprovision/resync through FPMC instead of patching OpenClaw internals
