import { TRPCError } from "@trpc/server";

import type { RecipeListContext } from "@norish/db";
import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import type { FullRecipeDTO, HouseholdWithUsersNamesDto, User } from "@norish/shared/contracts";
import type { RecipeShareDto } from "@norish/shared/contracts/dto/recipe-shares";
import type { OperationId } from "@norish/shared/contracts/realtime/envelope";
import { isUserServerAdmin } from "@norish/db";
import {
  isPrimaryKeyCollision,
  isRetryableConflict,
} from "@norish/db/repositories/constraint-violation";
import { getActiveRecipeShareByToken } from "@norish/db/repositories/recipe-shares";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import { getCachedHouseholdForUser } from "@norish/shared-server/cache/household";
import { runWithOperationContext } from "@norish/shared-server/lib/operation-context";
import { ResolveSharedRecipeInputSchema } from "@norish/shared/contracts/zod/recipe-shares";

import type { Context } from "./context";
import { withIdempotency } from "./idempotency-middleware";
import { middleware, publicProcedure } from "./trpc";

function signedInUser(ctx: Context): User {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return ctx.user;
}

/**
 * Middleware that enforces authentication and provides full context:
 * - User authentication
 * - Household resolution
 */
const withAuth = middleware(async ({ ctx, next }) => {
  const user = signedInUser(ctx);

  const household = ctx.household ?? (await getCachedHouseholdForUser(user.id));

  // Every account has a household; none means the account was deleted mid-session.
  if (!household) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Your account no longer exists" });
  }

  const isServerAdmin = user.isServerAdmin ?? false;

  const operationId = ctx.operationId ?? undefined;

  return runWithOperationContext({ operationId }, () =>
    next({
      ctx: {
        ...ctx,
        user,
        household,
        householdId: household.id,
        userIds: household.users.map((member: { id: string }) => member.id),
        isServerAdmin,
        operationId: ctx.operationId ?? null,
      },
    })
  );
});

/**
 * Authenticated procedure with full context:
 * - User must be logged in
 * - Household context available (ctx.household, ctx.householdId, and its members as ctx.userIds)
 * - Recipes and cookbooks: the Permission Policy, through the routers' access helpers
 *
 * `withIdempotency` runs first: any mutation carrying an `x-operation-id` is
 * executed at most once, and a duplicate replay returns the stored response
 * (ADR-0002). Claims are scoped by the session user id (populated on the base
 * context before auth), so a cache hit only short-circuits for the same user;
 * an expired/absent session keys differently and falls through to `withAuth`.
 * Queries and mutations without the header pass straight through.
 */
export const authedProcedure = publicProcedure
  .use(withIdempotency)
  .use(withAuth)
  // A client-made id another household's row holds answers like a missing row, without the database's text.
  // A write its Owner's move overtook is a 503, which the Outbox retries (a 409 would park it).
  .use(async ({ next }) => {
    const result = await next();

    if (!result.ok && isPrimaryKeyCollision(result.error)) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
    }
    if (!result.ok && isRetryableConflict(result.error)) {
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Changed meanwhile, try again" });
    }

    return result;
  });

/** Signed in, nothing more: a realtime subscription reads its household itself. */
export const signedInProcedure = publicProcedure.use(({ ctx, next }) =>
  next({ ctx: { ...ctx, user: signedInUser(ctx) } })
);

export type SharedRecipeProcedureContext = Context & {
  sharedRecipe: {
    share: RecipeShareDto;
    token: string;
    recipe: FullRecipeDTO;
  };
};

export const sharedRecipeProcedure = publicProcedure
  .input(ResolveSharedRecipeInputSchema)
  .use(async ({ ctx, input, next }) => {
    const share = await getActiveRecipeShareByToken(input.token, { touchLastAccessedAt: true });

    if (!share) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Shared recipe not found" });
    }

    const recipe = await getRecipeFull(share.recipeId);

    if (!recipe) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Shared recipe not found" });
    }

    return next({
      ctx: {
        ...ctx,
        sharedRecipe: {
          share,
          token: input.token,
          recipe,
        },
      } as SharedRecipeProcedureContext,
    });
  });

export type AuthedProcedureContext = Omit<Context, "household"> & {
  user: User;
  // The request's own household, or the cached one `withAuth` falls back to.
  household: NonNullable<Context["household"]> | HouseholdWithUsersNamesDto;
  householdId: string;
  /** The household's members, the caller included. */
  userIds: string[];
  isServerAdmin: boolean;
  operationId: OperationId | null;
};

/** The caller, as the repositories scope what a viewer may read and edit. */
export function viewerOf(
  ctx: Pick<AuthedProcedureContext, "householdId"> & { user: { id: string } }
): RecipeListContext {
  return { userId: ctx.user.id, householdId: ctx.householdId };
}

/** The caller as the Ingredient catalogue judges an edit: the viewer, with their household's members. */
export function actorOf(
  ctx: Pick<AuthedProcedureContext, "householdId" | "isServerAdmin" | "userIds"> & {
    user: { id: string };
  }
): CatalogueActor {
  return { ...viewerOf(ctx), isServerAdmin: ctx.isServerAdmin, memberIds: ctx.userIds };
}

/**
 * Middleware that enforces server admin access.
 * Checks both authentication and admin role.
 */
const withServerAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  const user = ctx.user;

  const isAdmin = await isUserServerAdmin(user.id);

  if (!isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Server admin access required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user,
    },
  });
});

/**
 * Admin procedure that enforces server admin access:
 * - User must be logged in
 * - User must be a server admin (owner or admin role)
 */
export const adminProcedure = publicProcedure.use(withServerAdmin);

export type AdminProcedureContext = Context & {
  user: User;
};
