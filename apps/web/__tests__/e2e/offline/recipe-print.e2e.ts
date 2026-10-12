import { Client } from "pg";

import { signIn } from "../harness/auth";
import {
  expect,
  SEEDED_RECIPE_ID,
  SEEDED_RECIPE_LINE,
  SEEDED_RECIPE_NAME,
  test,
  USER_A,
} from "./fixture";

async function seedPrintRecipe(databaseUrl: string): Promise<void> {
  const database = new Client({ connectionString: databaseUrl });

  await database.connect();

  try {
    await database.query(
      `update recipes set calories = 200, fat = 3, carbs = 35, protein = 6 where id = $1`,
      [SEEDED_RECIPE_ID]
    );
    const flourLine = await database.query<{ id: string }>(
      `update recipe_ingredients set amount = 400, unit = 'g'
       where recipe_id = $1 and name = $2 returning id`,
      [SEEDED_RECIPE_ID, SEEDED_RECIPE_LINE]
    );
    const ingredientLines = [
      { name: "Water", amount: 300, unit: "ml" },
      { name: "Olive oil", amount: 30, unit: "ml" },
    ];
    const lineIds = [flourLine.rows[0]!.id];

    for (const [order, item] of ingredientLines.entries()) {
      const line = await database.query<{ id: string }>(
        `insert into recipe_ingredients (recipe_id, name, amount, unit, "order", system_used) values ($1, $2, $3, $4, $5, 'metric') returning id`,
        [SEEDED_RECIPE_ID, item.name, item.amount, item.unit, order + 1]
      );

      lineIds.push(line.rows[0].id);
    }
    // Repetition exercises a step that must continue onto another printed page.
    const instructions = [
      "**Mix** half the flour with water, then rest for 10 minutes.",
      "Add the remaining flour and olive oil. Fold until the dough is smooth, then leave it covered in the bowl until ready to bake. "
        .repeat(24)
        .trim(),
    ];

    for (const [index, instruction] of instructions.entries()) {
      const step = await database.query<{ id: string }>(
        `insert into steps (recipe_id, step, "order", system_used) values ($1, $2, $3, 'metric') returning id`,
        [SEEDED_RECIPE_ID, instruction, index]
      );
      const orders = index === 0 ? [0, 1] : [0, 2];

      for (const [order, ingredientOrder] of orders.entries()) {
        await database.query(
          `insert into step_ingredients (step_id, recipe_ingredient_id, share, "order") values ($1, $2, $3, $4)`,
          [step.rows[0].id, lineIds[ingredientOrder], ingredientOrder === 0 ? 0.5 : 1, order]
        );
      }
    }
  } finally {
    await database.end();
  }
}

test("prints an A4 recipe card with scaled step ingredients and optional photo", async ({
  offlineHarness,
}, testInfo) => {
  const { page } = offlineHarness;

  await offlineHarness.transition("live");
  await seedPrintRecipe(offlineHarness.databaseUrl);
  await offlineHarness.context.clearCookies();
  await offlineHarness.context.addCookies(await signIn(offlineHarness.baseURL, USER_A));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/recipes/${SEEDED_RECIPE_ID}`);
  await page.getByRole("button", { name: "More servings" }).filter({ visible: true }).click();
  await expect(
    page.getByRole("button", { name: "Print recipe", exact: true }).filter({ visible: true })
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Actions", exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("menu", { name: "Actions" })
    .getByRole("button", { name: "Print recipe", exact: true })
    .filter({ visible: true })
    .click();
  const preview = page.getByRole("dialog", { name: "Print recipe" });

  await expect(preview).toBeVisible();
  await expect(preview).toContainText("5 servings");
  await expect(preview.getByRole("region", { name: "Ingredients" })).toContainText(
    `500 g ${SEEDED_RECIPE_LINE}`
  );
  await expect(preview.getByRole("region", { name: "Instructions" })).toContainText(
    `250 g ${SEEDED_RECIPE_LINE}`
  );
  await expect(preview.getByRole("region", { name: "Nutrition" })).toContainText("200 kcal");
  await expect(preview.locator("[data-timer-duration]").first()).toHaveText("10 minutes");
  await expect(preview.getByRole("img", { name: SEEDED_RECIPE_NAME })).toBeVisible();
  await preview.getByRole("checkbox", { name: "Include photo" }).press("Space");
  await expect(preview.getByRole("img")).toHaveCount(0);
  await preview.getByRole("button", { name: "Text size" }).click();
  await page.getByRole("option", { name: "13 pt", exact: true }).click();
  await page.evaluate(() => {
    window.addEventListener(
      "beforeprint",
      () => {
        document.documentElement.dataset.printRequested = "true";
      },
      { once: true }
    );
  });
  await preview.getByRole("button", { name: "Print / Save PDF" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-requested", "true");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation")).toBeHidden();
  await expect(page.locator(".recipe-print-document .recipe-print-step").first()).toHaveCSS(
    "break-inside",
    "avoid"
  );
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });

  await testInfo.attach("recipe-a4.pdf", { body: pdf, contentType: "application/pdf" });
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length).toBeGreaterThan(1);
  const pageSize = pdf.toString("latin1").match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);

  expect(Number(pageSize?.[1])).toBeCloseTo((210 / 25.4) * 72, 0);
  expect(Number(pageSize?.[2])).toBeCloseTo((297 / 25.4) * 72, 0);
  await page.emulateMedia({ media: "screen" });
  await preview.getByRole("button", { name: "Close", exact: true }).click();
  await expect(preview).toBeHidden();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".recipe-print-document .recipe-print-card")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Print recipe", exact: true }).filter({ visible: true })
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Actions", exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("menu", { name: "Actions" })
    .getByRole("button", { name: "Print recipe", exact: true })
    .filter({ visible: true })
    .click();
  await expect(preview).toBeVisible();
  await preview.getByRole("button", { name: "Close", exact: true }).click();
});
