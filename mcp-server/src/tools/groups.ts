/**
 * Board group tools.
 *
 * groups_list, groups_get, groups_snapshot,
 * groups_memory_list, groups_create, groups_memory_create
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FPMCClient } from "../lib/client.js";
import { toolSuccess, catchTool } from "../lib/result.js";

const GroupsListInput = {};

const GroupsGetInput = {
  group_id: z.string().uuid().describe("Board group UUID"),
};

const GroupsSnapshotInput = {
  group_id: z.string().uuid().describe("Board group UUID"),
  include_done: z.boolean().optional().default(false).describe("Include done tasks"),
  per_board_task_limit: z.number().int().min(0).optional().default(5).describe("Max tasks per board"),
};

const GroupsMemoryListInput = {
  group_id: z.string().uuid().describe("Board group UUID"),
  is_chat: z.boolean().optional().describe("Filter chat vs non-chat memory"),
};

const GroupsCreateInput = {
  name: z.string().min(1).describe("Group display name"),
  slug: z.string().optional().describe("URL-friendly slug (auto-generated if omitted)"),
  description: z.string().optional().describe("Group description"),
};

const GroupsMemoryCreateInput = {
  group_id: z.string().uuid().describe("Board group UUID"),
  content: z.string().min(1).describe("Memory content"),
  source: z.string().optional().describe("Source label"),
  tags: z.array(z.string()).optional().describe("Tags for filtering"),
};

export function registerGroupTools(server: McpServer, client: FPMCClient) {
  server.tool(
    "groups_list",
    "List all board groups in the organization",
    GroupsListInput,
    async () => {
      try {
        const result = await client.get("/api/v1/board-groups");
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "groups_get",
    "Get a single board group by ID",
    GroupsGetInput,
    async (args) => {
      try {
        const result = await client.get(`/api/v1/board-groups/${args.group_id}`);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "groups_snapshot",
    "Get a snapshot across all boards in a group including tasks and agents",
    GroupsSnapshotInput,
    async (args) => {
      try {
        const params: Record<string, string> = {};
        if (args.include_done) params.include_done = "true";
        if (args.per_board_task_limit !== undefined) {
          params.per_board_task_limit = String(args.per_board_task_limit);
        }
        const result = await client.get(
          `/api/v1/board-groups/${args.group_id}/snapshot`,
          params,
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "groups_memory_list",
    "List shared memory entries for a board group",
    GroupsMemoryListInput,
    async (args) => {
      try {
        const params: Record<string, string> = {};
        if (args.is_chat !== undefined) params.is_chat = String(args.is_chat);
        const result = await client.get(
          `/api/v1/board-groups/${args.group_id}/memory`,
          params,
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "groups_create",
    "Create a new board group. Name is required.",
    GroupsCreateInput,
    async (args) => {
      try {
        const result = await client.post("/api/v1/board-groups", args);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "groups_memory_create",
    "Create a shared memory entry in a board group. Content is required.",
    GroupsMemoryCreateInput,
    async (args) => {
      try {
        const { group_id, ...body } = args;
        const result = await client.post(
          `/api/v1/board-groups/${group_id}/memory`,
          body,
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );
}
