/**
 * MCP resource handlers.
 *
 * Resources provide read-only contextual data that MCP clients can
 * reference. Static resources use server.resource(), templated resources
 * use ResourceTemplate for URI patterns with parameters.
 *
 * Resource URIs:
 *   fpmc://boards                      — all boards summary
 *   fpmc://boards/{board_id}           — single board detail
 *   fpmc://boards/{board_id}/tasks     — board tasks
 *   fpmc://agents                      — all agents
 *   fpmc://agents/{agent_id}           — single agent detail
 *   fpmc://approvals/pending           — pending approvals across boards
 *   fpmc://gateways                    — gateway status
 *   fpmc://groups                      — board groups
 *   fpmc://metrics                     — dashboard metrics
 */

import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FPMCClient } from "../lib/client.js";

function jsonResource(data: unknown): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  return {
    contents: [
      {
        uri: "",
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function registerResources(server: McpServer, client: FPMCClient) {
  // ── Static resources ───────────────────────────────────────────

  server.resource(
    "boards-list",
    "fpmc://boards",
    { description: "All accessible boards" },
    async (uri) => {
      const data = await client.get("/api/v1/boards");
      const res = jsonResource(data);
      res.contents[0].uri = uri.href;
      return res;
    },
  );

  server.resource(
    "agents-list",
    "fpmc://agents",
    { description: "All agents with status" },
    async (uri) => {
      const data = await client.get("/api/v1/agents");
      const res = jsonResource(data);
      res.contents[0].uri = uri.href;
      return res;
    },
  );

  server.resource(
    "approvals-pending",
    "fpmc://approvals/pending",
    { description: "Pending approvals across all boards" },
    async (uri) => {
      // Get all boards, then fetch pending approvals for each
      const boards = await client.get<{ items: Array<{ id: string }> }>("/api/v1/boards");
      const allApprovals: unknown[] = [];
      for (const board of boards.items ?? []) {
        try {
          const approvals = await client.get<{ items: unknown[] }>(
            `/api/v1/boards/${board.id}/approvals`,
            { status: "pending" },
          );
          if (approvals.items?.length) {
            allApprovals.push(...approvals.items);
          }
        } catch {
          // Skip boards where we can't read approvals
        }
      }
      const res = jsonResource({ items: allApprovals, total: allApprovals.length });
      res.contents[0].uri = uri.href;
      return res;
    },
  );

  server.resource(
    "gateways-list",
    "fpmc://gateways",
    { description: "All configured OpenClaw gateways" },
    async (uri) => {
      const data = await client.get("/api/v1/gateways");
      const res = jsonResource(data);
      res.contents[0].uri = uri.href;
      return res;
    },
  );

  server.resource(
    "groups-list",
    "fpmc://groups",
    { description: "All board groups" },
    async (uri) => {
      const data = await client.get("/api/v1/board-groups");
      const res = jsonResource(data);
      res.contents[0].uri = uri.href;
      return res;
    },
  );

  server.resource(
    "metrics-dashboard",
    "fpmc://metrics",
    { description: "Dashboard metrics (task counts, velocity, agent activity)" },
    async (uri) => {
      const data = await client.get("/api/v1/metrics/dashboard");
      const res = jsonResource(data);
      res.contents[0].uri = uri.href;
      return res;
    },
  );

  // ── Templated resources ────────────────────────────────────────

  server.resource(
    "board-detail",
    new ResourceTemplate("fpmc://boards/{board_id}", { list: undefined }),
    { description: "Single board detail by ID" },
    async (uri, params) => {
      const boardId = params.board_id as string;
      const data = await client.get(`/api/v1/boards/${boardId}`);
      const res = jsonResource(data);
      res.contents[0].uri = uri.href;
      return res;
    },
  );

  server.resource(
    "board-tasks",
    new ResourceTemplate("fpmc://boards/{board_id}/tasks", { list: undefined }),
    { description: "Tasks for a specific board" },
    async (uri, params) => {
      const boardId = params.board_id as string;
      const data = await client.get(`/api/v1/boards/${boardId}/tasks`);
      const res = jsonResource(data);
      res.contents[0].uri = uri.href;
      return res;
    },
  );

  server.resource(
    "agent-detail",
    new ResourceTemplate("fpmc://agents/{agent_id}", { list: undefined }),
    { description: "Single agent detail by ID" },
    async (uri, params) => {
      const agentId = params.agent_id as string;
      const data = await client.get(`/api/v1/agents/${agentId}`);
      const res = jsonResource(data);
      res.contents[0].uri = uri.href;
      return res;
    },
  );
}
