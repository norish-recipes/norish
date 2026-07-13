import { randomUUID } from "node:crypto";
import { createOpenApiFetchHandler, generateOpenApiDocument } from "trpc-to-openapi";

import type { OperationId } from "@norish/shared/contracts/realtime-envelope";
import { isUuid } from "@norish/shared/lib/operation-helpers";

import { createHttpContextFromHeaders } from "./context";
import {
  createPlannedRecipeProcedure,
  deletePlannedRecipeProcedure,
  listMonthPlannedRecipesProcedure,
  listTodayPlannedRecipesProcedure,
  listWeekPlannedRecipesProcedure,
} from "./routers/calendar/planned-items";
import { health } from "./routers/config/procedures";
import {
  assignGroceryToStoreProcedure,
  createGroceryProcedure,
  deleteGroceryProcedure,
  listGroceriesProcedure,
  markGroceryDoneProcedure,
  markGroceryUndoneProcedure,
} from "./routers/groceries/groceries";
import {
  createRecipeProcedure,
  getProcedure,
  importFromPasteProcedure,
  importFromUrlProcedure,
  listProcedure,
} from "./routers/recipes/recipes";
import { createStoreProcedure, listStoresProcedure } from "./routers/stores/stores";
import { router } from "./trpc";

export const openApiRouter = router({
  health,
  recipeGet: getProcedure,
  recipeSearch: listProcedure,
  recipeCreate: createRecipeProcedure,
  recipeImportUrl: importFromUrlProcedure,
  recipeImportPaste: importFromPasteProcedure,
  groceryList: listGroceriesProcedure,
  groceryCreate: createGroceryProcedure,
  groceryMarkDone: markGroceryDoneProcedure,
  groceryMarkUndone: markGroceryUndoneProcedure,
  groceryDelete: deleteGroceryProcedure,
  groceryAssignStore: assignGroceryToStoreProcedure,
  storeList: listStoresProcedure,
  storeCreate: createStoreProcedure,
  plannedRecipesToday: listTodayPlannedRecipesProcedure,
  plannedRecipesWeek: listWeekPlannedRecipesProcedure,
  plannedRecipesMonth: listMonthPlannedRecipesProcedure,
  plannedRecipeCreate: createPlannedRecipeProcedure,
  plannedRecipeDelete: deletePlannedRecipeProcedure,
});

function buildOpenApiHeaders(req: Request) {
  const headers = new Headers();

  for (const headerName of ["x-api-key", "authorization", "bearer", "x-operation-id"]) {
    const value = req.headers.get(headerName);

    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

export function resolveOpenApiOperationId(req: Request): OperationId {
  const rawOperationId = req.headers.get("x-operation-id");

  return (isUuid(rawOperationId) ? rawOperationId : randomUUID()) as OperationId;
}

async function createOpenApiContext(req: Request) {
  const operationId = resolveOpenApiOperationId(req);

  return createHttpContextFromHeaders(buildOpenApiHeaders(req), operationId);
}

export function handleOpenApiRequest(req: Request) {
  return createOpenApiFetchHandler({
    endpoint: "/api/v1",
    router: openApiRouter,
    req,
    createContext: () => createOpenApiContext(req),
  });
}

export function getOpenApiDocument(baseUrl: string) {
  const document = generateOpenApiDocument(openApiRouter, {
    title: "Norish Recipe API",
    description: "API access for Norish recipes and imports.",
    version: "1.0.0",
    baseUrl: new URL("/api/v1", `${baseUrl}/`).toString(),
    tags: ["Health", "Recipes", "Recipe Imports", "Groceries", "Stores", "Planned Recipes"],
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
      },
      BearerAuth: {
        type: "http",
        scheme: "bearer",
      },
    },
  });

  const procedures = (
    openApiRouter as unknown as {
      _def?: { procedures?: Record<string, { _def?: { type?: string } }> };
    }
  )._def?.procedures;

  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== "object" || !("operationId" in operation)) {
        continue;
      }

      const operationId = (operation as { operationId?: unknown }).operationId;

      if (typeof operationId !== "string" || procedures?.[operationId]?._def?.type !== "mutation") {
        continue;
      }

      const typedOperation = operation as {
        parameters?: Array<Record<string, unknown>>;
      };

      typedOperation.parameters = [
        ...(typedOperation.parameters ?? []),
        {
          name: "x-operation-id",
          in: "header",
          required: false,
          description:
            "Optional UUID for idempotent retries. When omitted, the server generates a new UUID for this request.",
          schema: {
            type: "string",
            format: "uuid",
          },
        },
      ];
    }
  }

  document.info.description = `${document.info.description ?? ""} Mutation operation IDs are generated automatically; callers may provide a UUID to make retries idempotent.`;

  return document;
}
