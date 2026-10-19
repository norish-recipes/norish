import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { listGroceriesByUsers } from "@norish/db/repositories/groceries";
import { listRecurringGroceriesByUsers } from "@norish/db/repositories/recurring-groceries";

import type { McpCaller } from "../context";
import { runTool } from "./helpers";

const ListGroceriesInputSchema = z.object({
  includeDone: z.boolean().default(true).describe("Include groceries that are already done."),
});

export function registerGroceriesTools(server: McpServer, caller: McpCaller): void {
  server.registerTool(
    "list_groceries",
    {
      title: "List groceries",
      description:
        "List the groceries shared with this user's household, including recurring groceries.",
      inputSchema: ListGroceriesInputSchema,
      annotations: { readOnlyHint: true },
    },
    (input) =>
      runTool("list_groceries", caller, async () => {
        const [groceries, recurringGroceries] = await Promise.all([
          listGroceriesByUsers(caller.userIds, { includeDone: input.includeDone }),
          listRecurringGroceriesByUsers(caller.userIds),
        ]);

        return { groceries, recurringGroceries };
      })
  );
}
