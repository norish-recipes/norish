import { createOpenApiFetchHandler, generateOpenApiDocument } from "trpc-to-openapi";

import type { OperationId } from "@norish/shared/contracts/realtime/envelope";
import { isOperationId } from "@norish/shared/lib/operation-helpers";

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
  nutritionProcedure,
} from "./routers/recipes/recipes";
import { createStoreProcedure, listStoresProcedure } from "./routers/stores/stores";
import { router } from "./trpc";

export const openApiRouter = router({
  health,
  recipeGet: getProcedure,
  recipeNutrition: nutritionProcedure,
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

async function createOpenApiContext(req: Request) {
  const rawOperationId = req.headers.get("x-operation-id");
  const operationId = isOperationId(rawOperationId) ? (rawOperationId as OperationId) : null;

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

// The spec is published on the docs site, so the server is a variable each reader
// fills in with their own instance.
export function getOpenApiDocument() {
  const serverUrl = "{server}/api/v1";
  const document = generateOpenApiDocument(openApiRouter, {
    title: "Norish Recipe API",
    description: "API access for Norish recipes and imports.",
    version: "1.0.0",
    baseUrl: serverUrl,
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

  return {
    ...document,
    servers: [
      {
        url: serverUrl,
        description: "Your Norish server",
        variables: { server: { default: "https://norish.example.com" } },
      },
    ],
  };
}
