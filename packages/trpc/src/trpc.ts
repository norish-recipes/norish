import type { OpenApiMeta } from "trpc-to-openapi";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";

import type { Context } from "./context";
import { trpcLogger } from "./logger";

const t = initTRPC
  .context<Context>()
  .meta<OpenApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error: _error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
        },
      };
    },
  });

const loggerMiddleware = t.middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();

  const result = await next();

  const durationMs = Date.now() - start;
  const userId = ctx.user?.id;

  if (result.ok) {
    trpcLogger.success(path, type, userId, durationMs);
  } else {
    const error = result.error;

    trpcLogger.error(path, type, userId, durationMs, error.code, error.message);
  }

  return result;
});

export const router = t.router;
/**
 * Build a direct caller for a router. Exported so a test can drive the real
 * procedures — middleware, input parsing and all — rather than re-implementing
 * them beside the thing it is meant to be checking.
 */
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure.use(loggerMiddleware);
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;
