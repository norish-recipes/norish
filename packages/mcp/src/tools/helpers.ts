import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { PermissionAction } from "@norish/auth/permissions";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import { canAccessResource } from "@norish/auth/permissions";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import { createLogger } from "@norish/shared-server/logger";

import type { McpCaller } from "../context";
import { forbidden, McpToolError, notFound } from "../errors";

const log = createLogger("mcp");

export async function requireRecipe(
  caller: McpCaller,
  recipeId: string,
  action: PermissionAction
): Promise<FullRecipeDTO> {
  const recipe = await getRecipeFull(recipeId);

  if (!recipe) throw notFound();

  if (recipe.userId) {
    const canView = await canAccessResource(
      "view",
      caller.userId,
      recipe.userId,
      caller.householdUserIds,
      caller.isServerAdmin
    );

    if (!canView) throw notFound();

    if (action !== "view") {
      const allowed = await canAccessResource(
        action,
        caller.userId,
        recipe.userId,
        caller.householdUserIds,
        caller.isServerAdmin
      );

      if (!allowed) {
        throw forbidden("You do not have permission to change this recipe.");
      }
    }
  }

  return recipe;
}

export async function runTool(
  name: string,
  caller: McpCaller,
  action: () => Promise<unknown>
): Promise<CallToolResult> {
  const startedAt = Date.now();

  try {
    const value = await action();

    log.info(
      { userId: caller.userId, tool: name, outcome: "ok", durationMs: Date.now() - startedAt },
      "MCP tool call"
    );

    return {
      content: [{ type: "text", text: JSON.stringify(value) }],
    };
  } catch (error) {
    if (error instanceof McpToolError) {
      log.info(
        {
          userId: caller.userId,
          tool: name,
          outcome: error.failure,
          durationMs: Date.now() - startedAt,
        },
        "MCP tool call rejected"
      );

      return {
        content: [{ type: "text", text: error.message }],
        isError: true,
      };
    }

    log.error(
      {
        userId: caller.userId,
        tool: name,
        errorName: error instanceof Error ? error.name : "UnknownError",
        durationMs: Date.now() - startedAt,
      },
      "MCP tool call failed"
    );

    return {
      content: [{ type: "text", text: "The request could not be completed." }],
      isError: true,
    };
  }
}
