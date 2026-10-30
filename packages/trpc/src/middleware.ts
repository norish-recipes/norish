import { TRPCError } from "@trpc/server";

import type { RecipeListContext } from "@norish/db";
import type { FullRecipeDTO, HouseholdWithUsersNamesDto, User } from "@norish/shared/contracts";
import type { RecipeShareDto } from "@norish/shared/contracts/dto/recipe-shares";
import type { OperationId } from "@norish/shared/contracts/realtime/envelope";
import { isUserServerAdmin } from "@norish/db";
import { getActiveRecipeShareByToken } from "@norish/db/repositories/recipe-shares";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import { getCachedHouseholdForUser } from "@norish/shared-server/cache/household";
import { runWithOperationContext } from "@norish/shared-server/lib/operation-context";
import { ResolveSharedRecipeInputSchema } from "@norish/shared/contracts/zod/recipe-shares";
import { viewerAndHouseholdIds } from "@norish/shared/lib/household";

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

  const householdUserIds = household?.users.map((u: { id: string }) => u.id) ?? [];
  const householdKey = household?.id ?? user.id;
  const isServerAdmin = user.isServerAdmin ?? false;

  const operationId = ctx.operationId ?? undefined;

  return runWithOperationContext({ operationId }, () =>
    next({
      ctx: {
        ...ctx,
        user,
        household,
        householdKey,
        userIds: viewerAndHouseholdIds({ userId: user.id, householdUserIds }),
        householdUserIds: householdUserIds.length > 0 ? householdUserIds : null,
        isServerAdmin,
        operationId: ctx.operationId ?? null,
      },
    })
  );
});

/**
 * Authenticated procedure with full context:
 * - User must be logged in
 * - Household context available (ctx.household, ctx.householdKey, ctx.userIds)
 * - Use canAccessResource from @norish/auth/permissions for permission checks
 *
 * `withIdempotency` runs first: any mutation carrying an `x-operation-id` is
 * executed at most once, and a duplicate replay returns the stored response
 * (ADR-0002). Claims are scoped by the session user id (populated on the base
 * context before auth), so a cache hit only short-circuits for the same user;
 * an expired/absent session keys differently and falls through to `withAuth`.
 * Queries and mutations without the header pass straight through.
 */
export const authedProcedure = publicProcedure.use(withIdempotency).use(withAuth);

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
  household: Context["household"] | HouseholdWithUsersNamesDto | null;
  householdKey: string;
  userIds: string[];
  householdUserIds: string[] | null;
  isServerAdmin: boolean;
  operationId: OperationId | null;
};

/** The caller, as the repositories scope what a viewer may read and edit. */
export function viewerOf(
  ctx: Pick<AuthedProcedureContext, "householdUserIds" | "isServerAdmin"> & { user: { id: string } }
): RecipeListContext {
  return {
    userId: ctx.user.id,
    householdUserIds: ctx.householdUserIds,
    isServerAdmin: ctx.isServerAdmin,
  };
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
