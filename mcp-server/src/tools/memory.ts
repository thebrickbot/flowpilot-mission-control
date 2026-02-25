/**
 * Board memory tools.
 *
 * memory_list, memory_create
 *
 * Board-level memory at /boards/{board_id}/memory.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FPMCClient } from "../lib/client.js";
import { toolSuccess, catchTool } from "../lib/result.js";

const MemoryListInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  is_chat: z.boolean().optional().describe("Filter chat vs non-chat memory"),
};

const MemoryCreateInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  content: z.string().min(1).describe("Memory content"),
  source: z.string().optional().default("mcp").describe("Source label"),
  tags: z.array(z.string()).optional().describe("Tags for filtering"),
};

export function registerMemoryTools(server: McpServer, client: FPMCClient) {
  server.tool(
    "memory_list",
    "List board memory entries with optional chat filter",
    MemoryListInput,
    async (args) => {
      try {
        const params: Record<string, string> = {};
        if (args.is_chat !== undefined) params.is_chat = String(args.is_chat);
        const result = await client.get(
          `/api/v1/boards/${args.board_id}/memory`,
          params,
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "memory_create",
    "Create a board memory entry. Source defaults to 'mcp'.",
    MemoryCreateInput,
    async (args) => {
      try {
        const { board_id, ...body } = args;
        const result = await client.post(`/api/v1/boards/${board_id}/memory`, body);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );
}
