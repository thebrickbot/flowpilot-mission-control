# Board Onboarding Guide

Technical reference for agentic developers integrating with Mission Control's board system. Covers schema definitions, governance rules, webhook configuration, the onboarding flow, agent lifecycle, and approval workflows.

---

## Table of Contents

1. [Board Configuration Schema](#1-board-configuration-schema)
2. [Board Group](#2-board-group)
3. [Board Rules (Governance Flags)](#3-board-rules-governance-flags)
4. [Webhooks](#4-webhooks)
5. [Board Onboarding Flow](#5-board-onboarding-flow)
6. [Agent Lifecycle](#6-agent-lifecycle)
7. [Approval Workflow](#7-approval-workflow)
8. [API Quick Reference](#8-api-quick-reference)

---

## 1. Board Configuration Schema

A **Board** is the primary workspace unit. It groups tasks, agents, and goal metadata under an organization.

**Model:** `backend/app/models/boards.py` — `Board(TenantScoped)`
**Table:** `boards`

### Fields

| Field | Type | Default | Required | Description |
|---|---|---|---|---|
| `id` | UUID | auto | - | Primary key |
| `organization_id` | UUID | - | Yes | FK to `organizations.id` |
| `name` | string | - | Yes | Display name |
| `slug` | string | - | Yes | URL-safe identifier (indexed) |
| `description` | string | `""` | Yes | Non-empty board description. Trimmed on create/update; blank values rejected. |
| `gateway_id` | UUID \| null | null | Yes (on create) | FK to `gateways.id`. Required at board creation; cannot be set to null on update. |
| `board_group_id` | UUID \| null | null | No | FK to `board_groups.id`. Optional grouping for cross-board coordination. |
| `board_type` | string | `"goal"` | No | `"goal"` or `"general"`. Goal boards require `objective` + `success_metrics` when `goal_confirmed=true`. |
| `objective` | string \| null | null | Conditional | Free-text goal statement. Required when `board_type="goal"` and `goal_confirmed=true`. |
| `success_metrics` | JSON dict \| null | null | Conditional | Structured success criteria. Required when `board_type="goal"` and `goal_confirmed=true`. Example: `{"metric": "response_time", "target": "< 200ms"}` |
| `target_date` | datetime \| null | null | No | Optional deadline for goal boards. |
| `goal_confirmed` | boolean | `false` | No | Whether the board goal has been finalized (set by onboarding confirm or manual update). |
| `goal_source` | string \| null | null | No | Origin of goal data. Set to `"lead_agent_onboarding"` when confirmed via onboarding flow. |
| `max_agents` | integer | `1` | No | Maximum number of **worker** agents allowed on the board. The board lead is excluded from this count. Must be >= 0. |
| `require_approval_for_done` | boolean | `true` | No | See [Board Rules](#3-board-rules-governance-flags). |
| `require_review_before_done` | boolean | `false` | No | See [Board Rules](#3-board-rules-governance-flags). |
| `block_status_changes_with_pending_approval` | boolean | `false` | No | See [Board Rules](#3-board-rules-governance-flags). |
| `only_lead_can_change_status` | boolean | `false` | No | See [Board Rules](#3-board-rules-governance-flags). |
| `created_at` | datetime | auto | - | UTC creation timestamp |
| `updated_at` | datetime | auto | - | UTC last-modified timestamp |

### Validation Rules

**On Create (`BoardCreate`):**
- `description` must be non-empty after trimming
- `gateway_id` is required (non-null)
- If `board_type="goal"` AND `goal_confirmed=true`, then `objective` and `success_metrics` are both required

**On Update (`BoardUpdate`):**
- All fields optional
- `gateway_id` cannot be explicitly set to null
- `description` cannot be explicitly set to empty/null

---

## 2. Board Group

Board Groups are logical containers that organize related boards within an organization. When a board's `board_group_id` changes, all agents on all boards in that group are sent a `BOARD GROUP UPDATED` notification.

**Model:** `backend/app/models/board_groups.py` — `BoardGroup(TenantScoped)`
**Table:** `board_groups`

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | auto | Primary key |
| `organization_id` | UUID | - | FK to `organizations.id` |
| `name` | string | - | Display name |
| `slug` | string | - | URL-safe identifier (indexed) |
| `description` | string \| null | null | Optional description |
| `created_at` | datetime | auto | UTC creation timestamp |
| `updated_at` | datetime | auto | UTC last-modified timestamp |

Board groups enable cross-board coordination. Agents can pull group memory and group-level snapshots to understand the broader context of their board's work.

---

## 3. Board Rules (Governance Flags)

Four boolean flags on the Board model compose into a governance rules engine that controls how agents interact with tasks. These rules are enforced server-side in `backend/app/api/tasks.py` and are also injected into the agent's `HEARTBEAT.md` template so agents are aware of the rules they must follow.

### Rule Reference

#### `require_approval_for_done` (default: `true`)

**Purpose:** Tasks cannot move to `done` status without a linked Approval record in `approved` status.

**Enforcement:**
- Gate function: `_require_approved_linked_approval_for_done()`
- Fires when `target_status == "done"` and `previous_status != "done"`
- Checks both `ApprovalTaskLink` records and legacy direct `approval.task_id` references
- **HTTP 409** on failure:
  ```json
  {"message": "Task can only be marked done when a linked approval has been approved."}
  ```

**Onboarding interaction:** When the lead agent's `autonomy_level` is set to `"autonomous"`, `"fully-autonomous"`, or `"full-autonomy"` during onboarding, this flag is automatically set to `false`. All other autonomy levels keep the default `true`.

---

#### `require_review_before_done` (default: `false`)

**Purpose:** Tasks must pass through `review` status before they can transition to `done`.

**Enforcement:**
- Gate function: `_require_review_before_done_when_enabled()`
- Fires when `target_status == "done"` and `previous_status != "done"`
- Requires that `previous_status == "review"`
- **HTTP 409** on failure:
  ```json
  {"message": "Task can only be marked done from review when the board rule is enabled."}
  ```

**Task status flow when enabled:** `inbox` -> `in_progress` -> `review` -> `done`

---

#### `block_status_changes_with_pending_approval` (default: `false`)

**Purpose:** Prevents any task status change while a `pending` approval is linked to the task.

**Enforcement:**
- Gate function: `_require_no_pending_approval_for_status_change_when_enabled()`
- Fires on any status change (when `status_requested=True`)
- Checks `_task_has_pending_linked_approval()` via both `ApprovalTaskLink` and legacy `approval.task_id`
- **HTTP 409** on failure:
  ```json
  {"message": "Task status cannot be changed while a linked approval is pending."}
  ```

---

#### `only_lead_can_change_status` (default: `false`)

**Purpose:** Only the board lead agent (with `is_board_lead=true`) can change task status. Non-lead agents attempting status changes are rejected.

**Enforcement:**
- Enforced inside `_apply_non_lead_agent_task_rules()`
- Queries `Board.only_lead_can_change_status` from the database
- **HTTP 403** on failure:
  ```
  "Only board leads can change task status."
  ```

---

### Rule Propagation to Agents

All four rules plus `max_agents` are injected into the board lead's `HEARTBEAT.md` via the Jinja2 template (`backend/templates/BOARD_HEARTBEAT.md.j2`):

```markdown
### Board Rule Snapshot
- `require_review_before_done`: {{ board_rule_require_review_before_done }}
- `require_approval_for_done`: {{ board_rule_require_approval_for_done }}
- `block_status_changes_with_pending_approval`: {{ board_rule_block_status_changes_with_pending_approval }}
- `only_lead_can_change_status`: {{ board_rule_only_lead_can_change_status }}
- `max_agents`: {{ board_rule_max_agents }}
```

This means agents receive their board's governance configuration at every heartbeat and are expected to plan their actions accordingly.

### Rule Combinations

Rules can be combined for different governance postures:

| Posture | `require_approval` | `require_review` | `block_pending` | `only_lead_status` |
|---|---|---|---|---|
| **Fully autonomous** | `false` | `false` | `false` | `false` |
| **Light oversight** | `true` | `false` | `false` | `false` |
| **Strict review** | `true` | `true` | `true` | `false` |
| **Lead-controlled** | `true` | `true` | `true` | `true` |

---

## 4. Webhooks

Webhooks allow external systems to push data into a board. Each webhook has an instruction (the `description` field) that tells the receiving agent how to process incoming payloads.

### Webhook Schema

**Model:** `backend/app/models/board_webhooks.py` — `BoardWebhook(QueryModel)`
**Table:** `board_webhooks`

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | auto | Primary key. Also used as the webhook endpoint path segment. |
| `board_id` | UUID | - | FK to `boards.id` |
| `agent_id` | UUID \| null | null | FK to `agents.id`. Optional: routes payloads to a specific agent. If null, defaults to the board lead. |
| `description` | string | - | **Agent instruction text.** This is sent to the target agent along with each incoming payload. Non-empty required. |
| `enabled` | boolean | `true` | Whether the webhook accepts payloads. |
| `created_at` | datetime | auto | UTC creation timestamp |
| `updated_at` | datetime | auto | UTC last-modified timestamp |

### How the `description` Field Works

The `description` field serves a dual purpose:
1. **Human documentation** — describes what this webhook is for
2. **Agent instruction** — the exact text sent to the agent when a payload arrives

Example `description`:
```
When a GitHub push event arrives, create a task for each modified file
that needs review. Tag tasks with "github" and include the commit SHA.
```

### Payload Storage

**Model:** `backend/app/models/board_webhook_payloads.py` — `BoardWebhookPayload(QueryModel)`
**Table:** `board_webhook_payloads`

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `board_id` | UUID | FK to `boards.id` |
| `webhook_id` | UUID | FK to `board_webhooks.id` |
| `payload` | JSON | Raw inbound payload (any JSON shape) |
| `headers` | JSON dict | Captured HTTP request headers |
| `source_ip` | string \| null | Client IP address |
| `content_type` | string \| null | Content-Type header value |
| `received_at` | datetime | Indexed receipt timestamp |

### Inbound Endpoint

```
POST /api/v1/boards/{board_id}/webhooks/{webhook_id}
```

**Authentication:** None required (public endpoint).

**Processing flow:**
1. Payload is stored in `board_webhook_payloads`
2. A `BoardMemory` entry is created with `source="webhook"` and tags `["webhook", "webhook:{webhook_id}", "payload:{payload_id}"]`
3. Delivery is enqueued to a Redis-backed RQ queue
4. Worker dispatches the message to the target agent

**Response:** `202 Accepted` with:
```json
{
  "ok": true,
  "board_id": "...",
  "webhook_id": "...",
  "payload_id": "..."
}
```

### Agent Notification Message

When dispatched (`backend/app/services/webhooks/dispatch.py`), the agent receives:

```
WEBHOOK EVENT RECEIVED
Board: {board.name}
Webhook ID: {webhook.id}
Payload ID: {payload.id}
Instruction: {webhook.description}

Take action:
1) Triage this payload against the webhook instruction.
2) Create/update tasks as needed.
3) Reference payload ID {payload.id} in task descriptions.

Payload preview:
{json_preview}

To inspect board memory entries:
GET /api/v1/agent/boards/{board.id}/memory?is_chat=false
```

### Agent Routing

- If `webhook.agent_id` is set, the payload is routed to that specific agent on the board
- If the targeted agent is not found (or `agent_id` is null), the payload falls back to the **board lead** agent
- If no lead agent is available or has no active session, the delivery is silently dropped

### Retry Behavior

Failed deliveries are retried with exponential backoff + jitter, managed by the RQ queue worker (`backend/app/services/webhooks/queue.py`).

---

## 5. Board Onboarding Flow

Board onboarding is a multi-step, agent-mediated conversation that configures a board's goal, rules, and lead agent. The gateway agent conducts a 6-10 question interview with the user.

### Flow Diagram

```
User                    Mission Control              Gateway Agent
  |                          |                            |
  |-- POST /start ---------> |                            |
  |                          |-- prompt (6-10 questions) -> |
  |                          |                            |
  |                          | <--- question + options --- |
  | <-- question rendered -- |                            |
  |                          |                            |
  |-- POST /answer --------> |                            |
  |                          |-- forward answer ---------> |
  |                          |                            |
  |          ... repeat for each question ...             |
  |                          |                            |
  |                          | <--- status: complete ----- |
  | <-- draft rendered ----- |                            |
  |                          |                            |
  |-- POST /confirm -------> |                            |
  |                          |-- provision lead agent ---> |
  |                          |                            |
```

### Step-by-Step

#### Step 1: Start Onboarding

```
POST /api/v1/boards/{board_id}/onboarding/start
```

**Auth:** User with write access to the board.

**What happens:**
- Creates a `BoardOnboardingSession` with `status="active"`
- Sends a prompt to the gateway agent requesting a 6-10 question interview:
  - 3-6 questions to clarify the board goal
  - 1 question to choose a lead agent name (first-name style)
  - 2-4 questions about working preferences (communication style, autonomy, update cadence, output format)
  - 1 final question: "Anything else we should know?"

**If a session already exists:** Resumes the active session by re-sending the last user answer to the gateway agent.

#### Step 2: Answer Questions

```
POST /api/v1/boards/{board_id}/onboarding/answer
```

**Body:**
```json
{
  "answer": "Option label or free text",
  "other_text": "Optional additional context"
}
```

If `other_text` is provided, the answer is formatted as `"{answer}: {other_text}"`.

The answer is forwarded to the gateway agent, which responds with either:

**A question:**
```json
{
  "question": "What is the primary objective?",
  "options": [
    {"id": "1", "label": "Ship feature X by Q2"},
    {"id": "2", "label": "Reduce technical debt"},
    {"id": "3", "label": "Other (I'll type it)"}
  ]
}
```

**Or a completion draft (see Step 3).**

#### Step 3: Gateway Agent Completes Draft

```
POST /api/v1/agent/boards/{board_id}/onboarding
```

**Auth:** Gateway main agent only.

When the agent has enough information, it sends a `status: "complete"` payload:

```json
{
  "status": "complete",
  "board_type": "goal",
  "objective": "Reduce API response time to under 200ms",
  "success_metrics": {
    "p95_latency": "< 200ms",
    "error_rate": "< 0.1%"
  },
  "target_date": "2026-06-30",
  "user_profile": {
    "preferred_name": "Rich",
    "pronouns": "he/him",
    "timezone": "Europe/London",
    "notes": "Prefers async updates",
    "context": "Working on performance sprint"
  },
  "lead_agent": {
    "name": "Atlas",
    "identity_profile": {
      "role": "Board Lead",
      "communication_style": "direct, concise, practical",
      "emoji": ":gear:"
    },
    "autonomy_level": "balanced",
    "verbosity": "concise",
    "output_format": "bullets",
    "update_cadence": "daily",
    "custom_instructions": "Focus on measurable improvements"
  }
}
```

#### Step 4: User Confirms Draft

```
POST /api/v1/boards/{board_id}/onboarding/confirm
```

**Body:**
```json
{
  "board_type": "goal",
  "objective": "Reduce API response time to under 200ms",
  "success_metrics": {"p95_latency": "< 200ms", "error_rate": "< 0.1%"},
  "target_date": "2026-06-30"
}
```

**What happens on confirm:**
1. Board fields updated: `board_type`, `objective`, `success_metrics`, `target_date`
2. `goal_confirmed` set to `true`
3. `goal_source` set to `"lead_agent_onboarding"`
4. `require_approval_for_done` derived from draft's `autonomy_level`:
   - `"autonomous"` / `"fully-autonomous"` / `"full-autonomy"` -> `false`
   - All other values -> `true` (default)
5. User profile preferences applied (preferred_name, pronouns, timezone, notes, context)
6. Board lead agent provisioned via `OpenClawProvisioningService.ensure_board_lead_agent()`

### Lead Agent Draft Schema

**Schema:** `backend/app/schemas/board_onboarding.py` — `BoardOnboardingLeadAgentDraft`

| Field | Type | Values | Description |
|---|---|---|---|
| `name` | string \| null | - | First-name style agent name (e.g., "Atlas", "Sage") |
| `identity_profile` | dict \| null | - | Key-value pairs: `role`, `communication_style`, `emoji` |
| `autonomy_level` | enum \| null | `ask_first` \| `balanced` \| `autonomous` | How independently the lead agent operates |
| `verbosity` | enum \| null | `concise` \| `balanced` \| `detailed` | Communication detail level |
| `output_format` | enum \| null | `bullets` \| `mixed` \| `narrative` | Preferred output structure |
| `update_cadence` | enum \| null | `asap` \| `hourly` \| `daily` \| `weekly` | How often the agent provides updates |
| `custom_instructions` | string \| null | - | Free-text additional instructions for the lead agent |

### Onboarding Session Model

**Model:** `backend/app/models/board_onboarding.py` — `BoardOnboardingSession`
**Table:** `board_onboarding_sessions`

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `board_id` | UUID | FK to `boards.id` |
| `session_key` | string | Gateway session key for messaging |
| `status` | string | `"active"` -> `"completed"` -> `"confirmed"` |
| `messages` | JSON list \| null | Full conversation log (role/content/timestamp objects) |
| `draft_goal` | JSON dict \| null | The completed draft from the agent |
| `created_at` | datetime | UTC creation timestamp |
| `updated_at` | datetime | UTC last-modified timestamp |

---

## 6. Agent Lifecycle

Agents are autonomous actors assigned to boards. There are three categories based on their relationship to boards and gateways.

**Model:** `backend/app/models/agents.py` — `Agent(QueryModel)`
**Table:** `agents`

### Agent Categories

| Category | `board_id` | `is_board_lead` | Description |
|---|---|---|---|
| **Gateway-main** | `null` | `false` | Gateway-scoped agent. Not tied to any board. Handles onboarding and gateway-level operations. |
| **Board Lead** | UUID | `true` | One per board. Enforces board rules, manages task flow, creates/retires worker agents. |
| **Board Worker** | UUID | `false` | Executes tasks. Can only update status on tasks assigned to them (subject to board rules). |

### Agent Fields

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `board_id` | UUID \| null | FK to `boards.id`. Null for gateway-main agents. |
| `gateway_id` | UUID | FK to `gateways.id`. Required. |
| `name` | string | Agent display name (indexed) |
| `status` | string | Lifecycle state (see below) |
| `openclaw_session_id` | string \| null | Active gateway session identifier |
| `agent_token_hash` | string \| null | Hashed authentication token |
| `heartbeat_config` | JSON dict \| null | `interval_seconds`, `missing_tolerance` |
| `identity_profile` | JSON dict \| null | `role`, `communication_style`, `emoji`, `autonomy_level`, `verbosity`, etc. |
| `identity_template` | text \| null | Initial intent/behavior template text |
| `soul_template` | text \| null | Deeper agent instruction text |
| `is_board_lead` | boolean | Whether this agent is the board lead |
| `provision_requested_at` | datetime \| null | When provisioning was requested |
| `provision_confirm_token_hash` | string \| null | Token for confirming provisioning |
| `provision_action` | string \| null | Current provisioning action |
| `delete_requested_at` | datetime \| null | When deletion was requested |
| `delete_confirm_token_hash` | string \| null | Token for confirming deletion |
| `last_seen_at` | datetime \| null | Last heartbeat timestamp |
| `created_at` | datetime | UTC creation timestamp |
| `updated_at` | datetime | UTC last-modified timestamp |

### Agent Status Values

| Status | Description |
|---|---|
| `provisioning` | Agent is being set up on the gateway |
| `online` | Agent is active and responding to heartbeats |
| `offline` | Agent has not sent a heartbeat within the configured tolerance |
| `updating` | Agent configuration is being updated |
| `deleting` | Agent is being decommissioned |

### Lead Agent Provisioning

When a board lead is provisioned (via onboarding confirm or manual creation), the following happens:

1. `LeadAgentOptions` are assembled from the onboarding draft (name, identity_profile, action)
2. Default identity profile if none provided:
   ```json
   {
     "role": "Board Lead",
     "communication_style": "direct, concise, practical",
     "emoji": ":gear:"
   }
   ```
3. `OpenClawProvisioningService.ensure_board_lead_agent()` creates or updates the agent record and initiates gateway provisioning

### Worker Agent Spawn Limit

The board's `max_agents` field caps the number of non-lead agents. Enforcement:
- `enforce_board_spawn_limit_for_lead()` checks `count_non_lead_agents_for_board() < board.max_agents`
- The lead agent itself is excluded from the count
- If the limit is reached, the lead agent cannot create additional workers

---

## 7. Approval Workflow

Approvals gate sensitive actions (primarily task completion) behind human or lead-agent review. They support confidence scoring and rubric-based evaluation.

### Approval Schema

**Model:** `backend/app/models/approvals.py` — `Approval(QueryModel)`
**Table:** `approvals`

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `board_id` | UUID | FK to `boards.id` |
| `task_id` | UUID \| null | Legacy single-task link (FK to `tasks.id`) |
| `agent_id` | UUID \| null | Requesting agent (FK to `agents.id`) |
| `action_type` | string | Freeform action label (e.g., `"task.review"`, `"task.assign"`, `"task.execute"`, `"task.batch_review"`) |
| `payload` | JSON dict \| null | Action context. Must contain `reason` (or `decision.reason`), or use the `lead_reasoning` input field. |
| `confidence` | float | 0-100 score. Below 80.0 typically triggers mandatory approval. |
| `rubric_scores` | JSON dict \| null | Per-criterion score breakdown (e.g., `{"completeness": 8, "quality": 7}`) |
| `status` | string | `"pending"` -> `"approved"` \| `"rejected"` |
| `created_at` | datetime | UTC creation timestamp |
| `resolved_at` | datetime \| null | When status changed from `pending` |

### Multi-Task Approvals

**Model:** `backend/app/models/approval_task_links.py` — `ApprovalTaskLink(QueryModel)`
**Table:** `approval_task_links`

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `approval_id` | UUID | FK to `approvals.id` |
| `task_id` | UUID | FK to `tasks.id` |
| `created_at` | datetime | UTC creation timestamp |

Approvals can be linked to multiple tasks. The `task_ids` field on `ApprovalCreate` creates these links. Unique constraint on `(approval_id, task_id)`.

### Creating an Approval

```
POST /api/v1/boards/{board_id}/approvals
```

**Body (`ApprovalCreate`):**
```json
{
  "action_type": "task.review",
  "task_ids": ["task-uuid-1", "task-uuid-2"],
  "confidence": 85.0,
  "rubric_scores": {"completeness": 9, "quality": 8, "testing": 7},
  "lead_reasoning": "All acceptance criteria met with evidence in comments.",
  "agent_id": "requesting-agent-uuid"
}
```

**Validation:**
- `lead_reasoning` is required. It can be provided as:
  - The `lead_reasoning` field directly
  - `payload.reason` (string)
  - `payload.decision.reason` (nested string)
- Only one `pending` approval per task is allowed. Duplicates return **HTTP 409**.
- `task_id` and `task_ids` are deduplicated and aligned automatically.

### Resolving an Approval

```
PATCH /api/v1/boards/{board_id}/approvals/{approval_id}
```

**Body (`ApprovalUpdate`):**
```json
{
  "status": "approved"
}
```

Valid status values: `"approved"` or `"rejected"`.

**Side effects on resolution:**
- `resolved_at` is set to the current timestamp
- The board lead agent is notified via gateway message:
  ```
  APPROVAL RESOLVED
  Board: {board.name}
  Approval ID: {approval.id}
  Action: {approval.action_type}
  Decision: APPROVED / REJECTED
  Take action: continue execution using the final approval decision.
  ```

### Confidence Threshold

A confidence threshold of `80.0` is used by the lead policy (`backend/app/services/lead_policy.py`). Approvals with confidence below this threshold require human review. Approvals for external or risky actions also require review regardless of confidence.

### Task Status Gate Integration

The approval system integrates with board rules:
- `require_approval_for_done=true`: Tasks need an `approved` approval linked to them before moving to `done`
- `block_status_changes_with_pending_approval=true`: No status changes while any linked approval is `pending`

---

## 8. API Quick Reference

### Board Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/boards` | org member | List all accessible boards |
| `POST` | `/api/v1/boards` | org admin | Create board |
| `GET` | `/api/v1/boards/{board_id}` | org member | Get board |
| `PATCH` | `/api/v1/boards/{board_id}` | org member (write) | Update board |
| `DELETE` | `/api/v1/boards/{board_id}` | org member (write) | Delete board |
| `GET` | `/api/v1/boards/{board_id}/snapshot` | user or agent | Full board snapshot |

### Onboarding Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/boards/{board_id}/onboarding` | user (read) | Get latest onboarding session |
| `POST` | `/api/v1/boards/{board_id}/onboarding/start` | user (write) | Start onboarding |
| `POST` | `/api/v1/boards/{board_id}/onboarding/answer` | user (write) | Answer a question |
| `POST` | `/api/v1/boards/{board_id}/onboarding/confirm` | user (write) | Confirm draft and provision lead |
| `POST` | `/api/v1/boards/{board_id}/onboarding/agent` | gateway agent | Agent sends question/completion |

### Webhook Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/boards/{board_id}/webhooks` | org member | List webhooks |
| `POST` | `/api/v1/boards/{board_id}/webhooks` | org member (write) | Create webhook |
| `GET` | `/api/v1/boards/{board_id}/webhooks/{webhook_id}` | org member | Get webhook |
| `PATCH` | `/api/v1/boards/{board_id}/webhooks/{webhook_id}` | org member (write) | Update webhook |
| `DELETE` | `/api/v1/boards/{board_id}/webhooks/{webhook_id}` | org member (write) | Delete webhook |
| `POST` | `/api/v1/boards/{board_id}/webhooks/{webhook_id}` | **none** | Inbound payload (public) |
| `GET` | `/api/v1/boards/{board_id}/webhooks/{webhook_id}/payloads` | org member | List stored payloads |

### Approval Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/boards/{board_id}/approvals` | org member | List approvals (filter by `?status=`) |
| `GET` | `/api/v1/boards/{board_id}/approvals/stream` | org member | SSE stream of approval events |
| `POST` | `/api/v1/boards/{board_id}/approvals` | agent or user | Create approval |
| `PATCH` | `/api/v1/boards/{board_id}/approvals/{id}` | user | Resolve approval |

### Task Status Values

```
inbox -> in_progress -> review -> done
```

All statuses: `"inbox"`, `"in_progress"`, `"review"`, `"done"`
