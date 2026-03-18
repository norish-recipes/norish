import type { Context } from "./context";

import { initTRPC } from "@trpc/server";
import superjson from "superjson";

import { trpcLogger } from "./logger";

const t = initTRPC.context<Context>().create({
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
export const publicProcedure = t.procedure.use(loggerMiddleware);
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;
