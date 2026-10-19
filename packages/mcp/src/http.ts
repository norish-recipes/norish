import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createLogger } from "@norish/shared-server/logger";

import type { McpAuthResult } from "./context";
import type { RateLimitResult } from "./rate-limit";
import { authenticateMcpRequest } from "./context";
import { mcpRateLimiter } from "./rate-limit";
import { createMcpServer } from "./server";

const log = createLogger("mcp");

export const MCP_MAX_BODY_BYTES = 256 * 1024;

export type McpRequestOptions = {
  rateLimiter?: { consume: (key: string) => RateLimitResult };
};

function jsonError(
  status: number,
  message: string,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export async function handleMcpRequest(
  request: Request,
  options: McpRequestOptions = {}
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }

  let auth: McpAuthResult;

  try {
    auth = await authenticateMcpRequest(request.headers);
  } catch (error) {
    log.error(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "MCP authentication failed"
    );

    return jsonError(500, "Internal server error");
  }

  if (auth.status === "rate_limited") {
    log.warn({ outcome: "key_rate_limited" }, "MCP request rejected");

    return jsonError(429, "Too many requests", {
      "retry-after": String(auth.retryAfterSeconds),
    });
  }

  if (auth.status === "invalid") {
    log.warn({ outcome: "unauthorized" }, "MCP request rejected");

    return jsonError(401, "Unauthorized", { "www-authenticate": "Bearer" });
  }

  const caller = auth.caller;

  const rate = (options.rateLimiter ?? mcpRateLimiter).consume(caller.userId);

  if (!rate.allowed) {
    log.warn({ userId: caller.userId, outcome: "rate_limited" }, "MCP request rejected");

    return jsonError(429, "Too many requests", {
      "retry-after": String(rate.retryAfterSeconds),
    });
  }

  const server = createMcpServer(caller);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MCP_MAX_BODY_BYTES,
  });

  try {
    await server.connect(transport);

    return await transport.handleRequest(request);
  } catch (error) {
    log.error(
      { userId: caller.userId, errorName: error instanceof Error ? error.name : "UnknownError" },
      "MCP request failed"
    );

    return jsonError(500, "Internal server error");
  } finally {
    try {
      await server.close();
    } catch (error) {
      log.error(
        { userId: caller.userId, errorName: error instanceof Error ? error.name : "UnknownError" },
        "MCP server close failed"
      );
    }
  }
}
