import { userIdOf } from "../harness/accounts";
import { signIn } from "../harness/auth";
import { seedRecipe } from "../harness/recipes";
import { expect, SEEDED_RECIPE_IMAGE, test, USER_A } from "./fixture";

const PRINT_RECIPE_NAME = "Print Focaccia";
const PRINT_FLOUR = "print flour";

/** A recipe of its own, so the shared seeded one stays as the other offline specs read it. */
function seedPrintRecipe(): Promise<string> {
  const lines = [
    { name: PRINT_FLOUR, amount: 400, unit: "g" },
    { name: "print water", amount: 300, unit: "ml" },
    { name: "print olive oil", amount: 30, unit: "ml" },
  ];
  // The second step is long enough to continue onto another printed page.
  const steps = [
    "**Mix** half the flour with water, then rest for 10 minutes.",
    "Add the remaining flour and olive oil. Fold until the dough is smooth, then leave it covered in the bowl until ready to bake. "
      .repeat(24)
      .trim(),
  ];

  return userIdOf(USER_A).then((userId) =>
    seedRecipe(
      userId,
      PRINT_RECIPE_NAME,
      lines.map((line) => line.name),
      {
        servings: 4,
        calories: 200,
        fat: "3",
        carbs: "35",
        protein: "6",
        // Borrows the seeded recipe's photo, which the fixture already wrote to the uploads.
        images: [{ image: SEEDED_RECIPE_IMAGE, order: 0 }],
        recipeIngredients: lines.map((line, order) => ({
          ingredientName: line.name,
          ingredientId: null,
          amount: line.amount,
          unit: line.unit,
          order,
          systemUsed: "metric",
        })),
        steps: steps.map((step, order) => ({
          step,
          order,
          systemUsed: "metric",
          images: [],
          stepIngredients:
            order === 0
              ? [
                  { ingredientOrder: 0, share: 0.5, order: 0 },
                  { ingredientOrder: 1, share: 1, order: 1 },
                ]
              : [
                  { ingredientOrder: 0, share: 0.5, order: 0 },
                  { ingredientOrder: 2, share: 1, order: 1 },
                ],
        })),
      }
    )
  );
}

test("prints an A4 recipe card with scaled step ingredients and optional photo", async ({
  offlineHarness,
}, testInfo) => {
  const { page } = offlineHarness;

  await offlineHarness.transition("live");
  const recipeId = await seedPrintRecipe();
  await offlineHarness.context.clearCookies();
  await offlineHarness.context.addCookies(await signIn(offlineHarness.baseURL, USER_A));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/recipes/${recipeId}`);
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
    `500 grams ${PRINT_FLOUR}`
  );
  await expect(preview.getByRole("region", { name: "Instructions" })).toContainText(
    `250 grams ${PRINT_FLOUR}`
  );
  await expect(preview.getByRole("region", { name: "Nutrition" })).toContainText("200 kcal");
  await expect(preview.locator("[data-timer-duration]").first()).toHaveText("10 minutes");
  await expect(preview.getByRole("img", { name: PRINT_RECIPE_NAME })).toBeVisible();
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
