import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { submitMutation } from "../harness/trpc";

export async function submitPasteImport(page: Page, text: string): Promise<void> {
  const pasteArea = page.getByPlaceholder("Paste a recipe (free text) or JSON-LD here...");
  let attempt = 0;

  await expect(async () => {
    if (attempt++ > 0) await page.reload();

    if (!(await pasteArea.isVisible().catch(() => false))) {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Add Recipe", exact: true }).click();
      await page.getByRole("menuitem", { name: "Paste" }).click({ timeout: 2_000 });
      await expect(pasteArea).toBeVisible({ timeout: 2_000 });
    }

    await pasteArea.fill(text);
    await submitMutation(page, "recipes.importFromPaste", () =>
      page.getByRole("button", { name: "AI Import" }).click({ timeout: 3_000 })
    );
  }).toPass({ timeout: 90_000, intervals: [500, 1_000, 2_000] });
}

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

export async function submitImageImport(page: Page): Promise<void> {
  let attempt = 0;

  await expect(async () => {
    if (attempt++ > 0) await page.reload();

    const fileInput = page.locator("input[type='file']");

    if (!(await fileInput.isVisible().catch(() => false))) {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Add Recipe", exact: true }).click();
      await page.getByRole("menuitem", { name: "Image" }).click({ timeout: 2_000 });
    }

    await fileInput.setInputFiles({
      name: "cookbook-page.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    });
    await submitMutation(page, "recipes.importFromImages", () =>
      page.getByRole("button", { name: "Import with AI" }).click({ timeout: 3_000 })
    );
  }).toPass({ timeout: 90_000, intervals: [500, 1_000, 2_000] });
}
