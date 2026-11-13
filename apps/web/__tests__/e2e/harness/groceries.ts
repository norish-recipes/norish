import type { Page } from "@playwright/test";

/** One grocery's row, whichever section it sits in; `visible` passes over a hidden one. */
export function rowFor(page: Page, name: string, { visible = false } = {}) {
  return page.locator(`[data-grocery-name="${name}"]${visible ? ":visible" : ""}`).first();
}

/** Open `/groceries` and wait for its Add button. */
export async function openGroceries(page: Page): Promise<void> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).waitFor();
}

/** Close the open panel and wait until no dialog is left, a Select's leaving popover included. */
export async function closePanel(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("dialog").first().waitFor({ state: "detached" });
}
