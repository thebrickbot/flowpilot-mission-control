import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AgentRead } from "@/api/generated/model";
import { AgentHealthStatus } from "./AgentHealthStatus";

const buildAgent = (overrides: Partial<AgentRead> = {}): AgentRead => ({
  id: "agent-1",
  name: "Ava",
  gateway_id: "gateway-1",
  status: "online",
  openclaw_session_id: "session-123",
  last_seen_at: "2026-03-07T06:00:00Z",
  created_at: "2026-03-07T06:00:00Z",
  updated_at: "2026-03-07T06:00:00Z",
  ...overrides,
});

describe("AgentHealthStatus", () => {
  it("shows runtime health separately from desired state", () => {
    const agent = {
      ...buildAgent({ status: "updating" }),
      runtime_status: "offline",
      ui_status: "updating",
      status_source: "openclaw_runtime",
    };

    render(<AgentHealthStatus agent={agent} />);

    expect(screen.getByTestId("runtime-health")).toHaveTextContent("offline");
    expect(screen.getByTestId("desired-state")).toHaveTextContent("updating");
    expect(screen.getByTestId("status-source")).toHaveTextContent(
      "openclaw_runtime",
    );
  });

  it("does not treat desired updating as healthy runtime when runtime is stale", () => {
    const now = new Date("2026-03-07T06:20:00Z");
    const agent = {
      ...buildAgent({ status: "updating", last_seen_at: "2026-03-07T06:00:00Z" }),
      ui_status: "updating",
    };

    render(<AgentHealthStatus agent={agent} now={now} />);

    expect(screen.getByTestId("runtime-health")).toHaveTextContent("offline");
    expect(screen.getByTestId("desired-state")).toHaveTextContent("updating");
  });
});
