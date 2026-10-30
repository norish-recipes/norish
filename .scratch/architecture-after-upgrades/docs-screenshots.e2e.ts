/**
 * Capture the documentation screenshot of a cancelled job in the job monitor,
 * against the E2E harness: the fake AI provider holds the import's request,
 * so the job is running when the administrator cancels it.
 *
 * Not part of the gate. To re-capture: copy this file into
 * `apps/web/__tests__/e2e/ai/`, build (`pnpm build`), run `pnpm exec
 * playwright test --config __tests__/e2e/playwright.config.ts --project=ai
 * __tests__/e2e/ai/docs-screenshots.e2e.ts` from `apps/web`, and delete the
 * copy again.
 */
import path from "node:path";

import { expect, test } from "./fixture";
import { submitPasteImport } from "./import-support";

const DOCS = path.resolve(import.meta.dirname, "../../../../../apps/docs/static/img/screenshots");

test("the job monitor shows a cancelled job", async ({ browser, aiStack }) => {
  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
    viewport: { width: 1100, height: 820 },
    deviceScaleFactor: 1.5,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  aiStack.ai.control.reset();
  aiStack.ai.control.setDefault(null);
  aiStack.ai.control.hold();

  try {
    await page.goto("/");
    await submitPasteImport(page, "Import Slow Cooker Chili — the harness never answers.");
    await expect.poll(() => aiStack.ai.control.requestCount, { timeout: 30_000 }).toBe(1);

    await page.goto("/settings?tab=admin");
    const running = page
      .getByRole("row")
      .filter({ hasText: "Paste import" })
      .filter({ hasText: "Active" });

    await expect(running).toHaveCount(1, { timeout: 15_000 });
    await running.click();

    const dialog = page.getByRole("dialog");

    await dialog.getByRole("button", { name: "Cancel job" }).click();
    await expect(dialog.getByText("An administrator cancelled this job.")).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(DOCS, "admin-job-cancelled.png") });
  } finally {
    aiStack.ai.control.release();
    await context.close();
  }
});
