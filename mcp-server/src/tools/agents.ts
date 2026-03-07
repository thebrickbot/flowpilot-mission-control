/**
 * Agent management tools.
 *
 * agents_list, agents_get, agents_health_check
 *
 * agents_health_check is synthetic — computed from agents_list data,
 * not a dedicated backend endpoint.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FPMCClient } from "../lib/client.js";
import { toolSuccess, catchTool } from "../lib/result.js";

const AgentsListInput = {
  board_id: z.string().uuid().optional().describe("Filter by board"),
  gateway_id: z.string().uuid().optional().describe("Filter by gateway"),
};

const AgentsGetInput = {
  agent_id: z.string().uuid().describe("Agent UUID"),
};

const AgentsHealthCheckInput = {
  board_id: z.string().uuid().optional().describe("Scope to a board"),
};

const AgentsUpdatePolicyInput = {
  agent_id: z.string().uuid().describe("Agent UUID"),
  identity_template: z.string().min(1).optional().describe("Replacement identity template"),
  soul_template: z.string().min(1).optional().describe("Replacement soul template"),
  guardrails: z.string().min(1).optional().describe("Guardrails markdown to append to the soul template as desired policy text"),
  force: z.boolean().optional().describe("Force reprovision after update"),
};

interface AgentRecord {
  id: string;
  name: string;
  status: string;
  is_board_lead: boolean;
  board_id: string | null;
  last_seen_at: string | null;
}

interface AgentPolicyFields {
  identity_template?: string;
  soul_template?: string;
}

function mergeSoulTemplateWithGuardrails(
  soulTemplate: string | undefined,
  guardrails: string | undefined,
): string | undefined {
  const soul = soulTemplate?.trim();
  const policy = guardrails?.trim();
  if (!policy) return soul;
  const section = `## Guardrails\n${policy}`;
  if (!soul) return section;
  if (soul.includes("## Guardrails")) return soul;
  return `${soul}\n\n${section}`;
}

export function registerAgentTools(server: McpServer, client: FPMCClient) {
  server.tool(
    "agents_list",
    "List agents with optional board or gateway filter",
    AgentsListInput,
    async (args) => {
      try {
        const params: Record<string, string> = {};
        if (args.board_id) params.board_id = args.board_id;
        if (args.gateway_id) params.gateway_id = args.gateway_id;
        const result = await client.get("/api/v1/agents", params);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "agents_get",
    "Get a single agent by ID with full details including identity profile and heartbeat config",
    AgentsGetInput,
    async (args) => {
      try {
        const result = await client.get(`/api/v1/agents/${args.agent_id}`);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "agents_health_check",
    "Synthetic health check: fetch agents, compute last_seen_at deltas, flag degraded/offline",
    AgentsHealthCheckInput,
    async (args) => {
      try {
        const params: Record<string, string> = {};
        if (args.board_id) params.board_id = args.board_id;
        const data = await client.get<{ items: AgentRecord[] }>("/api/v1/agents", params);

        const now = Date.now();
        const DEGRADED_MS = 5 * 60 * 1000; // 5 minutes
        const OFFLINE_MS = 15 * 60 * 1000; // 15 minutes

        const agents = (data.items ?? []).map((agent) => {
          const lastSeen = agent.last_seen_at ? new Date(agent.last_seen_at).getTime() : 0;
          const deltaMs = lastSeen ? now - lastSeen : Infinity;
          let health: "healthy" | "degraded" | "offline" = "healthy";
          if (agent.status === "offline" || deltaMs > OFFLINE_MS) {
            health = "offline";
          } else if (deltaMs > DEGRADED_MS) {
            health = "degraded";
          }
          return {
            id: agent.id,
            name: agent.name,
            status: agent.status,
            is_board_lead: agent.is_board_lead,
            board_id: agent.board_id,
            last_seen_at: agent.last_seen_at,
            delta_seconds: lastSeen ? Math.round((now - lastSeen) / 1000) : null,
            health,
          };
        });

        const summary = {
          total: agents.length,
          healthy: agents.filter((a) => a.health === "healthy").length,
          degraded: agents.filter((a) => a.health === "degraded").length,
          offline: agents.filter((a) => a.health === "offline").length,
          agents,
        };

        return toolSuccess(summary);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "agents_update_policy",
    "Update FPMC-side desired agent policy/templates. This is a control-plane write that should sync through to OpenClaw runtime state.",
    AgentsUpdatePolicyInput,
    async (args) => {
      try {
        const needsExistingSoul = Boolean(args.guardrails && !args.soul_template);
        const existing = needsExistingSoul
          ? await client.get<AgentPolicyFields>(`/api/v1/agents/${args.agent_id}`)
          : undefined;

        const mergedSoul = mergeSoulTemplateWithGuardrails(
          args.soul_template ?? existing?.soul_template,
          args.guardrails,
        );

        const payload: AgentPolicyFields = {};
        if (args.identity_template) payload.identity_template = args.identity_template.trim();
        if (mergedSoul) payload.soul_template = mergedSoul;

        if (!payload.identity_template && !payload.soul_template) {
          throw new Error("Provide at least one policy field: identity_template, soul_template, or guardrails");
        }

        const result = await client.patch(
          `/api/v1/agents/${args.agent_id}`,
          payload,
          args.force === true ? { force: "true" } : undefined,
        );
        return toolSuccess({
          updated: true,
          write_through_target: "openclaw_runtime_sync_pending",
          result,
        });
      } catch (err) {
        return catchTool(err);
      }
    },
  );
}
