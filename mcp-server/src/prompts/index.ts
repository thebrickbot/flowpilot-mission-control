/**
 * MCP prompt handlers — reusable multi-tool workflows.
 *
 * fpmc_onboard  — Execute the full board onboarding SOP (FPMC-SOP-001)
 * fpmc_standup  — Morning briefing across boards/groups
 * fpmc_audit    — Monthly board audit per SOP Section 11.1
 * fpmc_triage   — Route incoming work to the appropriate board
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FPMCClient } from "../lib/client.js";

export function registerPrompts(server: McpServer, _client: FPMCClient) {
  server.prompt(
    "fpmc_onboard",
    "Execute the full board onboarding SOP (FPMC-SOP-001). Creates a board, runs the onboarding interview, and provisions the lead agent.",
    {
      board_name: z.string().describe("Name for the new board"),
      board_type: z.enum(["goal", "general"]).optional().describe("Board type (default: goal)"),
    },
    async (args) => {
      const boardType = args.board_type || "goal";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Execute the FPMC board onboarding SOP for a new board named "${args.board_name}" (type: ${boardType}).

Follow these steps in order:

1. Call health_check to verify the backend is running
2. Call gateways_list to find an available gateway
3. Call boards_create with name="${args.board_name}", board_type="${boardType}", and the first available gateway_id. Provide a suitable description.
4. Call onboarding_start with the new board_id
5. Loop: call onboarding_answer for each question until the draft is returned. Present each question to me and wait for my response before answering.
6. Once the draft is ready, present it for my review
7. Call onboarding_confirm with the confirmed details
8. Call agents_health_check scoped to the new board to verify the lead agent is online
9. Ask if I want to assign this board to a board group (call groups_list to show options, then boards_update if yes)

Report progress at each step.`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    "fpmc_standup",
    "Morning briefing: summarize task movement, pending approvals, and agent health across boards.",
    {
      group_id: z.string().uuid().optional().describe("Scope to a specific board group"),
      since_hours: z.string().optional().describe("Look-back window in hours (default: 24)"),
    },
    async (args) => {
      const sinceHours = args.since_hours || "24";
      const groupScope = args.group_id
        ? `Focus on board group ${args.group_id}.`
        : "Cover all accessible boards.";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Generate a morning standup briefing for the last ${sinceHours} hours. ${groupScope}

Steps:
1. Call boards_list to get all boards${args.group_id ? ` (filter by board_group_id=${args.group_id})` : ""}
2. For each board, call boards_snapshot to get current state
3. Call agents_health_check to assess agent status

Produce a structured brief covering:
- Task movement (new, completed, status changes)
- Pending approvals requiring attention
- Agent health (flag any degraded or offline agents)
- Blocked items or risks

Format as a concise, actionable briefing.`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    "fpmc_audit",
    "Monthly board audit per SOP Section 11.1. Flags boards missing groups, objectives, or recent activity.",
    {},
    async () => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Conduct a monthly board audit per FPMC SOP Section 11.1.

Steps:
1. Call boards_list to get all boards
2. Call groups_list to get all board groups
3. For each board, check and flag:
   - Boards not assigned to any group
   - Goal boards without a confirmed objective
   - Inactive boards (no task updates in 14+ days) — use boards_snapshot to check
   - Boards with max_agents > 1 without clear justification
   - Boards with governance rules disabled that should be enabled

Produce an audit report with:
- Summary statistics
- List of flagged boards with specific issues
- Recommended actions for each flagged item
- Overall health score`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    "fpmc_triage",
    "Route incoming work to the most appropriate board based on objectives and workload.",
    {
      description: z.string().describe("Description of the incoming work item"),
      urgency: z.enum(["low", "medium", "high", "critical"]).optional().describe("Urgency level"),
    },
    async (args) => {
      const urgency = args.urgency || "medium";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Triage and route this incoming work item:

Description: ${args.description}
Urgency: ${urgency}

Steps:
1. Call boards_list to get all boards
2. For promising matches, call boards_snapshot to assess current workload and objectives
3. Score each board on fit (objective alignment, current capacity, agent availability)
4. Either:
   a. Create the task on the best-fit board using tasks_create, OR
   b. If no board fits, recommend creating a new board and explain why

Present your reasoning: which board(s) you considered, why you chose the winner, and the created task details.`,
            },
          },
        ],
      };
    },
  );
}
