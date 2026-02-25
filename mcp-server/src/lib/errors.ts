/**
 * Error thrown when the FPMC backend returns a non-2xx response.
 *
 * FastAPI returns errors in two shapes:
 *   { "detail": "string message" }
 *   { "detail": { "message": "...", "conflicts": {...} } }
 *
 * This class normalises both into a consistent structure.
 */
export class FPMCApiError extends Error {
  public readonly status: number;
  public readonly detail: FPMCErrorDetail;

  constructor(status: number, body: unknown) {
    const detail = parseDetail(body);
    super(detail.message);
    this.name = "FPMCApiError";
    this.status = status;
    this.detail = detail;
  }

  /** True if this is a governance rule rejection (409 or 403). */
  get isGovernanceBlock(): boolean {
    return this.status === 409 || this.status === 403;
  }
}

export interface FPMCErrorDetail {
  message: string;
  rule?: string;
  suggestion?: string;
  raw?: unknown;
}

function parseDetail(body: unknown): FPMCErrorDetail {
  if (!body || typeof body !== "object") {
    return { message: String(body ?? "Unknown error") };
  }

  const obj = body as Record<string, unknown>;
  const detail = obj.detail;

  // String detail: { "detail": "Not found" }
  if (typeof detail === "string") {
    return { message: detail, rule: extractRule(detail), suggestion: getSuggestion(detail) };
  }

  // Dict detail: { "detail": { "message": "...", ... } }
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    const message = typeof d.message === "string" ? d.message : JSON.stringify(detail);
    return {
      message,
      rule: extractRule(message),
      suggestion: getSuggestion(message),
      raw: detail,
    };
  }

  return { message: JSON.stringify(body) };
}

const GOVERNANCE_PATTERNS: Array<{ pattern: RegExp; rule: string; suggestion: string }> = [
  {
    pattern: /linked approval has been approved/i,
    rule: "require_approval_for_done",
    suggestion: "Create an approval via approvals_create, then resolve it before retrying.",
  },
  {
    pattern: /from review when the board rule/i,
    rule: "require_review_before_done",
    suggestion: "Move the task to 'review' status first, then to 'done'.",
  },
  {
    pattern: /linked approval is pending/i,
    rule: "block_status_changes_with_pending_approval",
    suggestion: "Resolve the pending approval before changing task status.",
  },
  {
    pattern: /only board leads can change/i,
    rule: "only_lead_can_change_status",
    suggestion: "This action must be performed by the board lead agent.",
  },
];

function extractRule(message: string): string | undefined {
  for (const { pattern, rule } of GOVERNANCE_PATTERNS) {
    if (pattern.test(message)) return rule;
  }
  return undefined;
}

function getSuggestion(message: string): string | undefined {
  for (const { pattern, suggestion } of GOVERNANCE_PATTERNS) {
    if (pattern.test(message)) return suggestion;
  }
  return undefined;
}
