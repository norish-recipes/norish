import { createOpenApiFetchHandler, generateOpenApiDocument } from "trpc-to-openapi";

import type { OperationId } from "@norish/shared/contracts/realtime-envelope";
import { isOperationId } from "@norish/shared/lib/operation-helpers";

import { createHttpContextFromHeaders } from "./context";
import {
  getProcedure,
  importFromPasteProcedure,
  importFromUrlProcedure,
  listProcedure,
} from "./routers/recipes/recipes";
import { router } from "./trpc";

export const openApiRouter = router({
  recipeGet: getProcedure,
  recipeSearch: listProcedure,
  recipeImportUrl: importFromUrlProcedure,
  recipeImportPaste: importFromPasteProcedure,
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

export function getOpenApiDocument(baseUrl: string) {
  return generateOpenApiDocument(openApiRouter, {
    title: "Norish Recipe API",
    description: "API access for Norish recipes and imports.",
    version: "1.0.0",
    baseUrl,
    tags: ["Recipes", "Recipe Imports"],
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
}
