/**
 * Board onboarding tools (Phase 3).
 *
 * Multi-step, agent-mediated flow:
 *   status → start → answer (loop) → confirm
 *
 * The gateway agent conducts a 6-10 question interview. Each answer
 * returns either the next question (with options) or a completion draft.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FPMCClient } from "../lib/client.js";
import { toolSuccess, catchTool } from "../lib/result.js";

const OnboardingStatusInput = {
  board_id: z.string().uuid().describe("Board UUID"),
};

const OnboardingStartInput = {
  board_id: z.string().uuid().describe("Board UUID"),
};

const OnboardingAnswerInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  answer: z.string().min(1).describe("Selected option label or free text"),
  other_text: z.string().optional().describe("Additional context"),
};

const OnboardingConfirmInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  board_type: z.enum(["goal", "general"]).describe("Confirmed board type"),
  objective: z.string().optional().describe("Required for goal boards"),
  success_metrics: z.record(z.unknown()).optional().describe("Required for goal boards"),
  target_date: z.string().optional().describe("ISO datetime"),
};

export function registerOnboardingTools(server: McpServer, client: FPMCClient) {
  server.tool(
    "onboarding_status",
    "Get the current onboarding session status for a board",
    OnboardingStatusInput,
    async (args) => {
      try {
        const result = await client.get(
          `/api/v1/boards/${args.board_id}/onboarding`,
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "onboarding_start",
    "Start a new onboarding session. Creates session and sends prompt to gateway agent.",
    OnboardingStartInput,
    async (args) => {
      try {
        const result = await client.post(
          `/api/v1/boards/${args.board_id}/onboarding/start`,
          {},
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "onboarding_answer",
    "Answer the current onboarding question. Returns next question or completion draft.",
    OnboardingAnswerInput,
    async (args) => {
      try {
        const { board_id, ...body } = args;
        const result = await client.post(
          `/api/v1/boards/${board_id}/onboarding/answer`,
          body,
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "onboarding_confirm",
    "Confirm onboarding draft and provision the lead agent",
    OnboardingConfirmInput,
    async (args) => {
      try {
        const { board_id, ...body } = args;
        const result = await client.post(
          `/api/v1/boards/${board_id}/onboarding/confirm`,
          body,
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );
}
