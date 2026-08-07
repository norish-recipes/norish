import type { Page } from "@playwright/test";

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
