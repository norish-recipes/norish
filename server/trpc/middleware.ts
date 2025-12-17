import type { Context } from "./context";
import type { HouseholdWithUsersNamesDto, User } from "@/types";

import { TRPCError } from "@trpc/server";

import { middleware, publicProcedure } from "./trpc";

import { isUserServerAdmin } from "@/server/db";
import { getCachedHouseholdForUser } from "@/server/db/cached-household";

/**
 * Middleware that enforces authentication and provides full context:
 * - User authentication
 * - Household resolution
 */
const withAuth = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  const household = ctx.household ?? (await getCachedHouseholdForUser(ctx.user.id));

  const householdUserIds = household?.users.map((u: { id: string }) => u.id) ?? [];
  const allUserIds = [ctx.user.id, ...householdUserIds].filter(
    (id, i, arr) => arr.indexOf(id) === i
  );
  const householdKey = household?.id ?? ctx.user.id;
  const isServerAdmin = ctx.user.isServerAdmin ?? false;

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      household,
      householdKey,
      userIds: allUserIds,
      householdUserIds: householdUserIds.length > 0 ? householdUserIds : null,
      isServerAdmin,
    },
  });
});

/**
 * Authenticated procedure with full context:
 * - User must be logged in
 * - Household context available (ctx.household, ctx.householdKey, ctx.userIds)
 * - Use canAccessResource from @/server/auth/permissions for permission checks
 */
export const authedProcedure = publicProcedure.use(withAuth);

export type AuthedProcedureContext = Context & {
  user: User;
  household: HouseholdWithUsersNamesDto | null;
  householdKey: string;
  userIds: string[];
  householdUserIds: string[] | null;
  isServerAdmin: boolean;
};

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

  const isAdmin = await isUserServerAdmin(ctx.user.id);

  if (!isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Server admin access required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
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
