#!/usr/bin/env node

/**
 * @flowpilot/fpmc-mcp — MCP server for FlowPilot Mission Control
 *
 * Exposes FPMC boards, tasks, agents, approvals, webhooks, memory, and
 * orchestration workflows as MCP tools, resources, and prompts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./lib/config.js";
import { FPMCClient } from "./lib/client.js";

import { registerBoardTools } from "./tools/boards.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerAgentTools } from "./tools/agents.js";
import { registerApprovalTools } from "./tools/approvals.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerMemoryTools } from "./tools/memory.js";
import { registerGroupTools } from "./tools/groups.js";
import { registerInfraTools } from "./tools/infra.js";
import { registerOnboardingTools } from "./tools/onboarding.js";

import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

async function main() {
  const config = loadConfig();
  const client = new FPMCClient(config.baseUrl, config.authToken);

  const server = new McpServer({
    name: "@flowpilot/fpmc-mcp",
    version: "0.1.0",
  });

  // ── Register tool categories ──────────────────────────────────
  registerBoardTools(server, client);
  registerTaskTools(server, client);
  registerAgentTools(server, client);
  registerApprovalTools(server, client);
  registerWebhookTools(server, client);
  registerMemoryTools(server, client);
  registerGroupTools(server, client);
  registerInfraTools(server, client, config);
  registerOnboardingTools(server, client);

  // ── Register resources ────────────────────────────────────────
  registerResources(server, client);

  // ── Register prompts ──────────────────────────────────────────
  registerPrompts(server, client);

  // ── Transport ─────────────────────────────────────────────────
  if (config.transport === "sse") {
    console.error("SSE transport not yet implemented. Use stdio.");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`@flowpilot/fpmc-mcp running (${config.transport} transport)`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
