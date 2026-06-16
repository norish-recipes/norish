import { headers } from "next/headers";
import { NextResponse } from "next/server";

import type { HouseholdWithUsersNamesDto, User } from "@norish/shared/contracts";
import { auth } from "@norish/auth/auth";
import { getHouseholdForUser, getUserById, isUserServerAdmin } from "@norish/db";

export async function requireUser(): Promise<User> {
  // Use BetterAuth's getSession API which handles both session cookies and API keys
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (session?.user?.id) {
    const user = await getUserById(session.user.id);

    if (user) {
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        version: user.version,
      };
    }
  }

  throw new Error("UNAUTHORIZED");
}

export async function requireServerAdmin(): Promise<User> {
  const user = await requireUser();

  const isAdmin = await isUserServerAdmin(user.id);

  if (!isAdmin) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

export async function requireUserAndHousehold(): Promise<{
  user: User;
  household: HouseholdWithUsersNamesDto | null;
}> {
  const user = await requireUser();
  const household = await getHouseholdForUser(user.id);

  return { user, household };
}

export async function withAuth<R>(fn: (user: User) => Promise<R>): Promise<R> {
  const user = await requireUser();

  return fn(user);
}

export async function withAuthAndHousehold<R>(
  fn: (user: User, household: HouseholdWithUsersNamesDto | null) => Promise<R>
): Promise<R> {
  const { user, household } = await requireUserAndHousehold();

  return fn(user, household);
}

function handleApiError(err: any): Response {
  const message = err?.message || "Internal Server Error";
  let status = 500;

  if (message === "UNAUTHORIZED") {
    status = 401;
  } else if (message === "FORBIDDEN") {
    status = 403;
  }

  return NextResponse.json({ ok: false, error: { message } }, { status });
}

export function withHouseholdApiAuth(
  fn: (ctx: {
    user: User;
    household: HouseholdWithUsersNamesDto | null;
    searchParams: URLSearchParams;
    params: Record<string, string>;
  }) => Promise<Response>
) {
  return async (
    req: Request,
    routeCtx: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    try {
      const { user, household } = await requireUserAndHousehold();
      const searchParams = new URL(req.url).searchParams;
      const params = await routeCtx.params;

      return await fn({ user, household, searchParams, params });
    } catch (err: any) {
      return handleApiError(err);
    }
  };
}

export function withUserApiAuth(
  fn: (ctx: {
    req: Request;
    user: User;
    searchParams: URLSearchParams;
    params: Record<string, string>;
  }) => Promise<Response>
) {
  return async (
    req: Request,
    routeCtx: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    try {
      const user = await requireUser();
      const searchParams = new URL(req.url).searchParams;
      const params = await routeCtx.params;

      return await fn({
        req,
        user,
        searchParams,
        params,
      });
    } catch (err: any) {
      return handleApiError(err);
    }
  };
}

export async function withServerAdmin<R>(fn: (user: User) => Promise<R>): Promise<R> {
  const user = await requireServerAdmin();

  return fn(user);
}

export function withServerAdminApiAuth(
  fn: (ctx: {
    req: Request;
    user: User;
    searchParams: URLSearchParams;
    params: Record<string, string>;
  }) => Promise<Response>
) {
  return async (
    req: Request,
    routeCtx: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    try {
      const user = await requireServerAdmin();
      const searchParams = new URL(req.url).searchParams;
      const params = await routeCtx.params;

      return await fn({
        req,
        user,
        searchParams,
        params,
      });
    } catch (err: any) {
      return handleApiError(err);
    }
  };
}
