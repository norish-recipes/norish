import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Client } from "pg";

import { databaseUrl } from "./database";

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

  await save.click();
  await expect(save).toBeDisabled({ timeout: 15_000 });
}

export async function writePromptsRow(value: Record<string, unknown>): Promise<void> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    await database.query(`update server_config set value = $1::jsonb where key = 'prompts'`, [
      JSON.stringify(value),
    ]);
  } finally {
    await database.end();
  }
}

export async function readPromptsRow(): Promise<Record<string, unknown>> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const result = await database.query<{ value: Record<string, unknown> }>(
      `select value from server_config where key = 'prompts'`
    );

    return result.rows[0]!.value;
  } finally {
    await database.end();
  }
}
