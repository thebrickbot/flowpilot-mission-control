/**
 * Task management tools.
 *
 * tasks_list, tasks_comments_list, tasks_create, tasks_update,
 * tasks_change_status, tasks_comment_create
 *
 * IMPORTANT: tasks_change_status is separate from tasks_update.
 * Status changes enforce board governance rules and may return 409/403.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FPMCClient } from "../lib/client.js";
import { toolSuccess, catchTool } from "../lib/result.js";

const TASK_STATUSES = ["inbox", "in_progress", "review", "done"] as const;

const TasksListInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  status: z.string().optional().describe("Filter by status (comma-separated: inbox,in_progress,review,done)"),
  assigned_agent_id: z.string().uuid().optional().describe("Filter by assigned agent"),
  unassigned: z.boolean().optional().describe("Filter to unassigned tasks only"),
};

const TasksCommentsListInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  task_id: z.string().uuid().describe("Task UUID"),
};

const TasksCreateInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  title: z.string().min(1).describe("Task title"),
  description: z.string().optional().describe("Task detail"),
  status: z.enum(TASK_STATUSES).optional().default("inbox").describe("Initial status"),
  assigned_agent_id: z.string().uuid().optional().describe("Assign to agent"),
  tags: z.array(z.string()).optional().describe("String tags"),
};

const TasksUpdateInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  task_id: z.string().uuid().describe("Task UUID"),
  title: z.string().min(1).optional().describe("Updated title"),
  description: z.string().optional().describe("Updated description"),
  assigned_agent_id: z.string().uuid().optional().describe("Reassign"),
  tags: z.array(z.string()).optional().describe("Updated tags"),
};

const TasksChangeStatusInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  task_id: z.string().uuid().describe("Task UUID"),
  status: z.enum(TASK_STATUSES).describe("Target status"),
};

const TasksCommentCreateInput = {
  board_id: z.string().uuid().describe("Board UUID"),
  task_id: z.string().uuid().describe("Task UUID"),
  message: z.string().min(1).describe("Comment message text"),
};

export function registerTaskTools(server: McpServer, client: FPMCClient) {
  server.tool(
    "tasks_list",
    "List tasks on a board with optional status and assignment filters",
    TasksListInput,
    async (args) => {
      try {
        const params: Record<string, string> = {};
        if (args.status) params.status = args.status;
        if (args.assigned_agent_id) params.assigned_agent_id = args.assigned_agent_id;
        if (args.unassigned !== undefined) params.unassigned = String(args.unassigned);
        const result = await client.get(`/api/v1/boards/${args.board_id}/tasks`, params);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "tasks_comments_list",
    "List comments on a task in chronological order",
    TasksCommentsListInput,
    async (args) => {
      try {
        const result = await client.get(
          `/api/v1/boards/${args.board_id}/tasks/${args.task_id}/comments`,
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "tasks_create",
    "Create a new task on a board. Title is required.",
    TasksCreateInput,
    async (args) => {
      try {
        const { board_id, ...body } = args;
        const result = await client.post(`/api/v1/boards/${board_id}/tasks`, body);
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "tasks_update",
    "Update task metadata (title, description, assignment, tags). Does NOT change status.",
    TasksUpdateInput,
    async (args) => {
      try {
        const { board_id, task_id, ...body } = args;
        const result = await client.patch(
          `/api/v1/boards/${board_id}/tasks/${task_id}`,
          body,
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "tasks_change_status",
    "Change a task's status. Enforces governance rules — may return 409/403 with rule context.",
    TasksChangeStatusInput,
    async (args) => {
      try {
        const result = await client.patch(
          `/api/v1/boards/${args.board_id}/tasks/${args.task_id}`,
          { status: args.status },
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );

  server.tool(
    "tasks_comment_create",
    "Add a comment to a task. Supports @mentions to notify agents.",
    TasksCommentCreateInput,
    async (args) => {
      try {
        const result = await client.post(
          `/api/v1/boards/${args.board_id}/tasks/${args.task_id}/comments`,
          { message: args.message },
        );
        return toolSuccess(result);
      } catch (err) {
        return catchTool(err);
      }
    },
  );
}
