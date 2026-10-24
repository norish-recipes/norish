import type { APIRequestContext } from "@playwright/test";
import { request } from "@playwright/test";

import type { HarnessUser } from "./production-stack";

export type SessionCookies = Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];

export async function signIn(baseURL: string, user: HarnessUser): Promise<SessionCookies> {
  // A root-relative path would drop the base path from baseURL, so the request URL is absolute.
  const api = await request.newContext({ extraHTTPHeaders: { origin: new URL(baseURL).origin } });

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
