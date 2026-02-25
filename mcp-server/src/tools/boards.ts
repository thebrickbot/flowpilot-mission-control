/**
 * Board management tools.
 *
 * boards_list, boards_get, boards_snapshot, boards_create, boards_update, boards_delete
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FPMCClient } from "../lib/client.js";
import { toolSuccess, catchTool } from "../lib/result.js";

const BoardsListInput = {
  gateway_id: z.string().uuid().optional().describe("Filter by gateway UUID"),
  board_group_id: z.string().uuid().optional().describe("Filter by board group UUID"),
};

const BoardsGetInput = {
  board_id: z.string().uuid().describe("Board UUID"),
};

const BoardsSnapshotInput = {
  board_id: z.string().uuid().describe("Board UUID"),
};

const BoardsCreateInput = {
  name: z.string().min(1).describe("Board display name"),
  slug: z.string().optional().describe("URL-friendly slug (auto-generated if omitted)"),
  description: z.string().min(1).describe("Non-empty board description"),
  gateway_id: z.string().uuid().describe("Gateway UUID (required)"),
  board_type: z.enum(["goal", "general"]).optional().default("goal").describe("Board type"),
  board_group_id: z.string().uuid().optional().describe("Assign to existing board group"),
  max_agents: z.number().int().min(0).optional().default(1).describe("Max worker agents"),
};

const BoardsUpdateInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  name: z.string().min(1).optional().describe("Updated name"),
  description: z.string().min(1).optional().describe("Updated description"),
  objective: z.string().optional().describe("Goal statement"),
  success_metrics: z.record(z.unknown()).optional().describe("Structured success criteria"),
  target_date: z.string().optional().describe("ISO datetime target date"),
  max_agents: z.number().int().min(0).optional().describe("Worker agent cap"),
  board_group_id: z.string().uuid().nullable().optional().describe("Board group assignment"),
  require_approval_for_done: z.boolean().optional().describe("Governance flag"),
  require_review_before_done: z.boolean().optional().describe("Governance flag"),
  block_status_changes_with_pending_approval: z.boolean().optional().describe("Governance flag"),
  only_lead_can_change_status: z.boolean().optional().describe("Governance flag"),
};

const BoardsDeleteInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  confirm: z.literal(true).describe("Must be true to confirm deletion"),
};

export function registerBoardTools(server: McpServer, client: FPMCClient) {
  server.tool(
    "boards_list",
    "List all accessible boards with optional filters",
    BoardsListInput,
    async (args) => {
      try {
        const params: Record<string, string> = {};
        if (args.gateway_id) params.gateway_id = args.gateway_id;
        if (args.board_group_id) params.board_group_id = args.board_group_id;
        const result = await client.get("/api/v1/boards", params);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "boards_get",
    "Get a single board by ID with full details and governance flags",
    BoardsGetInput,
    async (args) => {
      try {
        const result = await client.get(`/api/v1/boards/${args.board_id}`);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "boards_snapshot",
    "Get a board snapshot including tasks, agents, memory, and approvals",
    BoardsSnapshotInput,
    async (args) => {
      try {
        const result = await client.get(`/api/v1/boards/${args.board_id}/snapshot`);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "boards_create",
    "Create a new board. Requires name, description, and gateway_id.",
    BoardsCreateInput,
    async (args) => {
      try {
        const { ...body } = args;
        const result = await client.post("/api/v1/boards", body);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "boards_update",
    "Update board metadata, governance flags, or group assignment",
    BoardsUpdateInput,
    async (args) => {
      try {
        const { board_id, ...body } = args;
        const result = await client.patch(`/api/v1/boards/${board_id}`, body);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "boards_delete",
    "Delete a board permanently. Requires confirm: true.",
    BoardsDeleteInput,
    async (args) => {
      try {
        const result = await client.delete(`/api/v1/boards/${args.board_id}`);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );
}
