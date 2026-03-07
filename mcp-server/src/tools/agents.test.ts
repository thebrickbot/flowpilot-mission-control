import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("agents MCP tools", () => {
  it("exposes agents_update_policy tool in source", () => {
    const path = resolve(process.cwd(), "src/tools/agents.ts");
    const text = readFileSync(path, "utf8");
    expect(text).toContain('"agents_update_policy"');
    expect(text).toContain("identity_template");
    expect(text).toContain("soul_template");
    expect(text).toContain("guardrails");
    expect(text).toContain("force");
    expect(text).toContain("openclaw_runtime_sync_pending");
    expect(text).toContain("Provide at least one policy field");
  });
});
