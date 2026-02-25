/**
 * Webhook management tools.
 *
 * webhooks_list, webhooks_payloads, webhooks_create
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FPMCClient } from "../lib/client.js";
import { toolSuccess, catchTool } from "../lib/result.js";

const WebhooksListInput = {
  board_id: z.string().uuid().describe("Board UUID"),
};

const WebhooksPayloadsInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  webhook_id: z.string().uuid().describe("Webhook UUID"),
};

const WebhooksCreateInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  description: z.string().min(1).describe("Agent instruction text"),
  agent_id: z.string().uuid().optional().describe("Route to specific agent (default: board lead)"),
  enabled: z.boolean().optional().default(true).describe("Enable webhook"),
};

export function registerWebhookTools(server: McpServer, client: FPMCClient) {
  server.tool(
    "webhooks_list",
    "List webhooks configured for a board",
    WebhooksListInput,
    async (args) => {
      try {
        const result = await client.get(`/api/v1/boards/${args.board_id}/webhooks`);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "webhooks_payloads",
    "List stored inbound payloads for a specific webhook",
    WebhooksPayloadsInput,
    async (args) => {
      try {
        const result = await client.get(
          `/api/v1/boards/${args.board_id}/webhooks/${args.webhook_id}/payloads`,
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "webhooks_create",
    "Create a new webhook for a board. Description is required.",
    WebhooksCreateInput,
    async (args) => {
      try {
        const { board_id, ...body } = args;
        const result = await client.post(`/api/v1/boards/${board_id}/webhooks`, body);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );
}
