import type { AgentRead } from "@/api/generated/model";

/**
 * Extended agent type that includes optional runtime health fields
 * returned by the backend health endpoint (Task 5 fields).
 * These are forward-compatible: when the backend starts returning them
 * on the main agent GET endpoint, the UI will use them directly.
 */
export type AgentWithRuntimeHealth = AgentRead & {
  runtime_status?: string | null;
  runtime_last_seen_at?: string | null;
  runtime_session_id?: string | null;
  ui_status?: string | null;
  status_source?: string | null;
};

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Derive runtime health from last_seen_at when the backend doesn't
 * provide explicit runtime_status. Mirrors backend logic in agent.py.
 */
export function deriveRuntimeStatus(
  lastSeenAt: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!lastSeenAt) return null;
  const seen = new Date(lastSeenAt);
  if (Number.isNaN(seen.getTime())) return null;
  const deltaMs = now.getTime() - seen.getTime();
  if (deltaMs <= STALE_THRESHOLD_MS) return "online";
  if (deltaMs <= OFFLINE_THRESHOLD_MS) return "stale";
  return "offline";
}

export type ResolvedAgentHealth = {
  runtimeStatus: string | null;
  desiredStatus: string;
  lastSeenAt: string | null;
  sessionId: string | null;
  statusSource: string;
};

/**
 * Resolve runtime health vs desired/config state for display.
 * Separates the two so the UI never conflates "updating" with "healthy runtime".
 */
export function resolveAgentHealth(
  agent: AgentWithRuntimeHealth,
  now: Date = new Date(),
): ResolvedAgentHealth {
  const runtimeStatus =
    agent.runtime_status ?? deriveRuntimeStatus(agent.last_seen_at, now);
  const desiredStatus = agent.ui_status ?? agent.status ?? "unknown";
  const lastSeenAt =
    (agent.runtime_last_seen_at as string | null) ?? agent.last_seen_at ?? null;
  const sessionId =
    (agent.runtime_session_id as string | null) ??
    agent.openclaw_session_id ??
    null;
  const statusSource = agent.status_source ?? (runtimeStatus ? "OpenClaw" : "FPMC");

  return { runtimeStatus, desiredStatus, lastSeenAt, sessionId, statusSource };
}
