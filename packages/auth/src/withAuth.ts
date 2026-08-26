import { headers } from "next/headers";
import { NextResponse } from "next/server";

import type { SessionIdentity } from "@norish/db/repositories/users";
import type { HouseholdWithUsersNamesDto, User } from "@norish/shared/contracts";
import { getHouseholdForUser } from "@norish/db";

import { getVerifiedSession } from "./session";

function toUser(identity: SessionIdentity): User {
  return {
    id: identity.id,
    email: identity.email,
    name: identity.name,
    image: identity.image,
    version: identity.version,
  };
}

async function requireIdentity(): Promise<SessionIdentity> {
  // getVerifiedSession covers session cookies and API keys alike, and confirms
  // the user still exists rather than trusting the cached session payload.
  const headersList = await headers();
  const identity = await getVerifiedSession(headersList);

  if (!identity) {
    throw new Error("UNAUTHORIZED");
  }

  return identity;
}

export async function requireUser(): Promise<User> {
  return toUser(await requireIdentity());
}

export async function requireServerAdmin(): Promise<User> {
  const identity = await requireIdentity();

  if (!identity.isServerAdmin) {
    throw new Error("UNAUTHORIZED");
  }

  return toUser(identity);
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
