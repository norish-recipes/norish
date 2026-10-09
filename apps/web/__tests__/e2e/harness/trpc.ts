import type { Page } from "@playwright/test";
import { request } from "@playwright/test";

import type { SessionCookies } from "./auth";

/**
 * Perform `act` and do not return until the tRPC mutation it fires has come
 * back.
 *
 * Clicking a control resolves as soon as the click is dispatched — before React
 * has issued the request. Whatever navigates next (a polling assertion's
 * `page.reload()`, the following scenario's `goto`) then aborts that request in
 * flight, so the work is never queued, and the poll waiting for its result can
 * only run out its timeout. Awaiting the response turns the submission into a
 * completed fact before anything is allowed to navigate.
 *
 * A non-OK status fails here, naming the procedure, rather than surfacing much
 * later as an unexplained "the result never arrived".
 */
export async function submitMutation(
  page: Page,
  procedure: string,
  act: () => Promise<void>
): Promise<void> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        new URL(candidate.url()).pathname === `/api/trpc/${procedure}`,
      { timeout: 30_000 }
    ),
    act(),
  ]);

  if (!response.ok()) {
    throw new Error(`${procedure} failed with HTTP ${response.status()}`);
  }
}

/**
 * One tRPC procedure over HTTP as the reader the cookies sign in: a query
 * when `input` is left out, a mutation otherwise. Answers the procedure's
 * result and fails on a non-OK status, naming the procedure.
 */
export async function callTrpc<T>(
  baseURL: string,
  cookies: SessionCookies,
  procedure: string,
  ...input: [] | [unknown]
): Promise<T> {
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL,
      cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });

  try {
    const path = `/api/trpc/${procedure}`;
    const response = input.length
      ? await api.post(path, { data: { json: input[0] } })
      : await api.get(path);

    if (!response.ok()) throw new Error(`${procedure} failed: ${response.status()}`);

    return ((await response.json()) as { result: { data: { json: T } } }).result.data.json;
  } finally {
    await api.dispose();
  }
}
