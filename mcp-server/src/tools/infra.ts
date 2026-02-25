/**
 * Infrastructure tools.
 *
 * gateways_list, health_check, metrics_dashboard
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FPMCClient } from "../lib/client.js";
import type { Config } from "../lib/config.js";
import { toolSuccess, catchTool } from "../lib/result.js";

const GatewaysListInput = {};

const HealthCheckInput = {};

const MetricsDashboardInput = {
  range: z.string().optional().describe("Time range, e.g. '7d', '30d'"),
  board_id: z.string().uuid().optional().describe("Scope to a board"),
  group_id: z.string().uuid().optional().describe("Scope to a board group"),
};

export function registerInfraTools(server: McpServer, client: FPMCClient, config: Config) {
  server.tool(
    "gateways_list",
    "List all configured OpenClaw gateways",
    GatewaysListInput,
    async () => {
      try {
        const result = await client.get("/api/v1/gateways");
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "health_check",
    "Check if the FPMC backend is healthy. No auth required.",
    HealthCheckInput,
    async () => {
      try {
        // Health check doesn't need auth, but our client always sends it — that's fine.
        const baseUrl = config.baseUrl.replace(/\/+$/, "");
        const res = await fetch(`${baseUrl}/healthz`);
        const data = await res.json();
        return toolSuccess(data);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "metrics_dashboard",
    "Get the metrics dashboard with task counts, velocity, and agent activity",
    MetricsDashboardInput,
    async (args) => {
      try {
        const params: Record<string, string> = {};
        if (args.range) params.range = args.range;
        if (args.board_id) params.board_id = args.board_id;
        if (args.group_id) params.group_id = args.group_id;
        const result = await client.get("/api/v1/metrics/dashboard", params);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );
}
