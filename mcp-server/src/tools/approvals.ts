/**
 * Approval management tools.
 *
 * approvals_list, approvals_create, approvals_resolve
 *
 * Approvals gate task completion behind human or lead-agent review.
 * Only one pending approval per task (409 on duplicate).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FPMCClient } from "../lib/client.js";
import { toolSuccess, catchTool } from "../lib/result.js";

const ApprovalsListInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  status: z.enum(["pending", "approved", "rejected"]).optional().describe("Filter by status"),
};

const ApprovalsCreateInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  action_type: z.string().min(1).describe("Action label, e.g. 'task.review'"),
  task_ids: z.array(z.string().uuid()).min(1).describe("Task UUIDs to link"),
  confidence: z.number().min(0).max(100).optional().describe("Confidence score (below 80 = mandatory review)"),
  rubric_scores: z.record(z.number()).optional().describe("Per-criterion breakdown"),
  lead_reasoning: z.string().min(1).describe("Justification text (required)"),
  agent_id: z.string().uuid().optional().describe("Requesting agent UUID"),
};

const ApprovalsResolveInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  approval_id: z.string().uuid().describe("Approval UUID"),
  status: z.enum(["approved", "rejected"]).describe("Resolution decision"),
};

export function registerApprovalTools(server: McpServer, client: FPMCClient) {
  server.tool(
    "approvals_list",
    "List approvals for a board with optional status filter",
    ApprovalsListInput,
    async (args) => {
      try {
        const params: Record<string, string> = {};
        if (args.status) params.status = args.status;
        const result = await client.get(`/api/v1/boards/${args.board_id}/approvals`, params);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "approvals_create",
    "Create an approval request linked to one or more tasks. Lead reasoning is required.",
    ApprovalsCreateInput,
    async (args) => {
      try {
        const { board_id, ...body } = args;
        const result = await client.post(`/api/v1/boards/${board_id}/approvals`, body);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "approvals_resolve",
    "Approve or reject a pending approval. Triggers agent notification.",
    ApprovalsResolveInput,
    async (args) => {
      try {
        const result = await client.patch(
          `/api/v1/boards/${args.board_id}/approvals/${args.approval_id}`,
          { status: args.status },
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );
}
