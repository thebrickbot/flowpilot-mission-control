import { z } from "zod";

const ConfigSchema = z.object({
  baseUrl: z.string().url(),
  authToken: z.string().min(50, "FPMC_AUTH_TOKEN must be at least 50 characters"),
  orgId: z.string().uuid().optional(),
  defaultGatewayId: z.string().uuid().optional(),
  transport: z.enum(["stdio", "sse"]).default("stdio"),
  mcpPort: z.coerce.number().int().positive().default(3100),
  pollIntervalMs: z.coerce.number().int().positive().default(30000),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const raw = {
    baseUrl: process.env.FPMC_BASE_URL,
    authToken: process.env.FPMC_AUTH_TOKEN,
    orgId: process.env.FPMC_ORG_ID || undefined,
    defaultGatewayId: process.env.FPMC_DEFAULT_GATEWAY_ID || undefined,
    transport: process.env.FPMC_MCP_TRANSPORT || "stdio",
    mcpPort: process.env.FPMC_MCP_PORT || 3100,
    pollIntervalMs: process.env.FPMC_POLL_INTERVAL_MS || 30000,
  };

  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`Configuration error:\n${issues}`);
    process.exit(1);
  }

  return result.data;
}
