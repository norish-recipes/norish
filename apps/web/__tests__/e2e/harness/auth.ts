import type { APIRequestContext } from "@playwright/test";
import { request } from "@playwright/test";

import type { HarnessUser } from "./production-stack";

export type SessionCookies = Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];

export async function signIn(baseURL: string, user: HarnessUser): Promise<SessionCookies> {
  // baseURL may carry a base path. The Origin header is still an origin, and
  // the request path must include the prefix rather than replace it.
  const origin = new URL(baseURL).origin;
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { origin } });

  try {
    const response = await api.post(`${baseURL}/api/auth/sign-in/email`, {
      data: { email: user.email, password: user.password },
    });

    if (!response.ok()) {
      throw new Error(`sign-in for ${user.email} failed: ${response.status()}`);
    }

    return (await api.storageState()).cookies;
  } finally {
    await api.dispose();
  }
}
