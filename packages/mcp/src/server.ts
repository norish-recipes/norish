import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpCaller } from "./context";
import { registerGroceriesTools } from "./tools/groceries";
import { registerPlanningTools } from "./tools/planning";
import { registerRecipeTools } from "./tools/recipes";

export const MCP_SERVER_NAME = "norish";

const INSTRUCTIONS =
  "Norish is a household recipe app. Every tool acts as the authenticated user and enforces that user's Norish permissions.";

export function createMcpServer(caller: McpCaller): McpServer {
  const server = new McpServer(
    {
      name: MCP_SERVER_NAME,
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
    },
    { instructions: INSTRUCTIONS }
  );

  registerRecipeTools(server, caller);
  registerGroceriesTools(server, caller);
  registerPlanningTools(server, caller);

  return server;
}
