import { StatusPill } from "@/components/atoms/StatusPill";
import {
  type AgentWithRuntimeHealth,
  resolveAgentHealth,
} from "@/lib/agent-runtime-status";
import { formatRelativeTimestamp as formatRelative } from "@/lib/formatters";

type AgentHealthStatusProps = {
  agent: AgentWithRuntimeHealth;
  now?: Date;
};

export function AgentHealthStatus({ agent, now }: AgentHealthStatusProps) {
  const health = resolveAgentHealth(agent, now);

  return (
    <div data-testid="agent-health-status">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-quiet">
          Health
        </p>
        {health.runtimeStatus ? (
          <StatusPill status={health.runtimeStatus} />
        ) : (
          <StatusPill status={health.desiredStatus} />
        )}
      </div>
      <div className="mt-4 grid gap-3 text-sm text-muted">
        <div className="flex items-center justify-between">
          <span>Runtime health</span>
          <span data-testid="runtime-health" className="text-strong">
            {health.runtimeStatus ?? "unknown"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Desired state</span>
          <span data-testid="desired-state" className="text-strong">
            {health.desiredStatus}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Last seen</span>
          <span>{formatRelative(health.lastSeenAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Session binding</span>
          <span>{health.sessionId ? "Bound" : "Unbound"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Status source</span>
          <span data-testid="status-source">{health.statusSource}</span>
        </div>
      </div>
    </div>
  );
}
