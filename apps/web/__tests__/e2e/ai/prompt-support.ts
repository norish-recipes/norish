import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { getConfig, setConfig } from "@norish/db/repositories/server-config";

export async function openPromptsPanel(page: Page) {
  await page.goto("/settings?tab=admin");

  const trigger = page.getByRole("button", { name: /^Prompts/ }).first();

  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const panelId = await trigger.getAttribute("aria-controls");

  return page.locator(`[id="${panelId}"]`);
}

export async function editPrompts(page: Page, edits: Record<string, string>): Promise<void> {
  const panel = await openPromptsPanel(page);

  for (const [label, text] of Object.entries(edits)) {
    const field = panel.getByRole("textbox", { name: label });

    await field.scrollIntoViewIfNeeded();
    await field.fill(text);
  }

  const save = panel.getByRole("button", { name: "Save", exact: true });
  // A pending Save is disabled too, so the button alone cannot say the row
  // has been written; the mutation's response can.
  const saved = page.waitForResponse((response) =>
    response.url().includes("admin.content.updatePrompts")
  );

  await save.click();
  await saved;
  await expect(save).toBeDisabled({ timeout: 15_000 });
}

export async function writePromptsRow(value: Record<string, unknown>): Promise<void> {
  await setConfig("prompts", value, null);
}

export async function readPromptsRow(): Promise<Record<string, unknown>> {
  const value = await getConfig<Record<string, unknown>>("prompts");

  if (!value) throw new Error("The prompts row is missing");

  return value;
}
