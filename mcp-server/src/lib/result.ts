/**
 * Shared helpers for converting API responses / errors into MCP tool results.
 */

import { FPMCApiError } from "./errors.js";

/** Wrap a successful API response as an MCP tool result. */
export function toolSuccess(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/** Return an MCP tool error result (isError: true). */
export function toolError(message: string): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Catch-all wrapper for tool handlers.
 * Converts FPMCApiError into structured error text with governance context.
 */
export function catchTool(err: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  if (err instanceof FPMCApiError) {
    const parts: string[] = [`Error ${err.status}: ${err.detail.message}`];
    if (err.detail.rule) {
      parts.push(`Governance rule: ${err.detail.rule}`);
    }
    if (err.detail.suggestion) {
      parts.push(`Suggestion: ${err.detail.suggestion}`);
    }
    return toolError(parts.join("\n"));
  }

  if (err instanceof Error) {
    return toolError(err.message);
  }

  return toolError(String(err));
}
