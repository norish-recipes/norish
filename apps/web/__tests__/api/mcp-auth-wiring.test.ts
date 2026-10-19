import { describe, expect, it } from "vitest";

import { isApiKeyAuthServiceConfigured } from "@norish/db/repositories/api-keys";

import "@/app/api/mcp/route";

describe("MCP route auth wiring", () => {
  it("loads the Better Auth API key service", () => {
    expect(isApiKeyAuthServiceConfigured()).toBe(true);
  });
});
