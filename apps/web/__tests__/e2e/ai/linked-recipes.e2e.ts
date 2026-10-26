/**
 * Linked Recipes end to end: a recipe whose steps link other recipes with `/`
 * reads, cooks and shops as one dish. Each linked recipe's steps follow the
 * step that first links it, under a header naming the recipe (nested when a
 * linked recipe links another); its ingredients sit after the recipe's own,
 * scaled with the servings; cooking mode walks the linked steps in place and
 * lists the linked lines; and Add to groceries offers them too.
 */
import type { BrowserContext, Locator, Page } from "@playwright/test";
import { Client } from "pg";

import type { AIE2EStack } from "./fixture";
import { callTrpc } from "../harness/trpc";
import { databaseUrl } from "./database";
import { expect, test } from "./fixture";
import { setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

const PHONE_VIEWPORT = { width: 390, height: 844 };

type StepInput = {
  step: string;
  stepIngredients?: { ingredientOrder: number; share: number }[];
};

function recipeInput(
  name: string,
  servings: number,
  lines: [string, number | null, string | null][],
  steps: StepInput[]
) {
  return {
    name,
    description: null,
    url: null,
    servings,
    prepMinutes: null,
    cookMinutes: null,
    totalMinutes: null,
    systemUsed: "metric",
    recipeIngredients: lines.map(([ingredientName, amount, unit], order) => ({
      ingredientName,
      ingredientId: null,
      amount,
      unit,
      order,
    })),
    steps: steps.map(({ step, stepIngredients = [] }, order) => ({
      step,
      order,
      systemUsed: "metric",
      stepIngredients,
    })),
    tags: [],
    cuisines: [],
    categories: [],
    images: [],
    videos: [],
  };
}

let stack: AIE2EStack;
let context: BrowserContext;
let page: Page;
const ids = { starter: "", dough: "", sauce: "", pizza: "", fries: "" };

async function createRecipe(input: ReturnType<typeof recipeInput>): Promise<string> {
  const id = await callTrpc<string>(stack.baseURL, stack.ownerCookies, "recipes.create", input);
  // The mutation answers before the transaction lands; wait for the rows.
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();
  try {
    await expect
      .poll(
        async () =>
          (await database.query("select 1 from steps where recipe_id = $1", [id])).rowCount,
        { timeout: 30_000 }
      )
      .toBe(input.steps.length);
  } finally {
    await database.end();
  }

  return id;
}

const link = (name: string, id: string) => `[${name}](id:${id})`;

/** The visible steps card: the recipe page renders a phone and a desktop tree. */
function stepsCard(): Locator {
  return page
    .locator("div[class*='rounded-2xl']")
    .filter({ has: page.getByRole("heading", { name: "Steps", exact: true }) })
    .locator("visible=true")
    .last();
}

function ingredientsCard(): Locator {
  return page
    .locator("div[class*='rounded-2xl']")
    .filter({ has: page.getByRole("heading", { name: "Ingredients", exact: true }) })
    .locator("visible=true")
    .last();
}

test.beforeAll(async ({ aiStack, browser }) => {
  stack = aiStack;
  await setAutomaticEnrichment({});

  ids.starter = await createRecipe(
    recipeInput(
      "Rye Starter",
      1,
      [["rye flour", 50, "g"]],
      [{ step: "Feed the starter with rye flour the night before." }]
    )
  );
  ids.dough = await createRecipe(
    recipeInput(
      "Neapolitan Dough",
      2,
      [
        ["tipo 00 flour", 500, "g"],
        ["sea salt", 10, "g"],
      ],
      [
        { step: `Stir in the ${link("Rye Starter", ids.starter)}.` },
        { step: "Work in the salt.", stepIngredients: [{ ingredientOrder: 1, share: 1 }] },
        { step: "Knead the dough for 10 minutes." },
      ]
    )
  );
  ids.sauce = await createRecipe(
    recipeInput(
      "San Marzano Sauce",
      2,
      [["san marzano tomatoes", 400, "g"]],
      [{ step: "Crush the tomatoes by hand." }]
    )
  );
  ids.pizza = await createRecipe(
    recipeInput(
      "Margherita Night",
      2,
      [["fior di latte", 250, "g"]],
      [
        { step: `Make the ${link("Neapolitan Dough", ids.dough)}.` },
        { step: `Spread the ${link("San Marzano Sauce", ids.sauce)}.` },
        { step: `Stretch the ${link("Neapolitan Dough", ids.dough)} into rounds.` },
        { step: "Tear the cheese over and bake." },
      ]
    )
  );

  ids.fries = await createRecipe(
    recipeInput(
      "Loaded Fries",
      2,
      [["potatoes", 500, "g"]],
      [
        { step: "Fry the potatoes until golden." },
        // Nothing but the link: the linked section stands in for it.
        { step: link("San Marzano Sauce", ids.sauce) },
        { step: "Serve hot." },
      ]
    )
  );

  context = await browser.newContext({
    baseURL: stack.baseURL,
    storageState: { cookies: stack.ownerCookies, origins: [] },
    serviceWorkers: "allow",
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
});

test("each linked recipe's steps read after the step that first links it", async () => {
  await page.goto(`/recipes/${ids.pizza}`);

  const steps = stepsCard();
  const sections = steps.getByTestId("linked-recipe-steps");

  await expect(sections).toHaveCount(3);
  await expect(sections.nth(0)).toHaveAttribute("data-linked-recipe-id", ids.dough);
  await expect(sections.nth(1)).toHaveAttribute("data-linked-recipe-id", ids.starter);
  await expect(sections.nth(2)).toHaveAttribute("data-linked-recipe-id", ids.sauce);

  // Reading order, linked steps included; the second dough link stays a link.
  // innerText follows the header's uppercase styling, so compare caselessly.
  const text = (await steps.innerText()).replace(/\s+/g, " ").toLowerCase();
  const order = [
    "Make the Neapolitan Dough.",
    "From recipe Neapolitan Dough",
    "Stir in the Rye Starter.",
    "From recipe Rye Starter",
    "Feed the starter with rye flour the night before.",
    "Work in the salt.",
    // The duration reads as a timer chip, set apart from the sentence.
    "Knead the dough for",
    "Spread the San Marzano Sauce.",
    "From recipe San Marzano Sauce",
    "Crush the tomatoes by hand.",
    "Stretch the Neapolitan Dough into rounds.",
    "Tear the cheese over and bake.",
  ];
  const positions = order.map((fragment) => text.indexOf(fragment.toLowerCase()));

  expect(positions.every((position) => position >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  expect(text.split("knead the dough for").length).toBe(2);

  // The starter is linked from inside the dough, so it reads inside it.
  await expect(sections.nth(0).getByTestId("linked-recipe-steps")).toHaveCount(1);

  // A linked step's ingredient chip resolves against its own recipe's lines.
  await expect(sections.nth(0).getByText("10 grams sea salt")).toBeVisible();

  // A linked step's timers work like the recipe's own.
  await expect(
    sections
      .nth(0)
      .locator("[data-slot=chip]")
      .filter({ hasText: /^10 minutes$/ })
  ).toBeVisible();
});

test("a linked recipe's section folds away and back", async () => {
  const sauce = stepsCard().getByTestId("linked-recipe-steps").nth(2);

  await sauce.getByRole("button", { name: "Hide steps" }).click();
  await expect(sauce.getByText("Crush the tomatoes by hand.")).toHaveCount(0);
  await expect(sauce.getByRole("link", { name: "San Marzano Sauce" })).toBeVisible();

  await sauce.getByRole("button", { name: "Show steps" }).click();
  await expect(sauce.getByText("Crush the tomatoes by hand.")).toBeVisible();
});

test("linked ingredients sit after the recipe's own and scale with its servings", async () => {
  const ingredients = ingredientsCard();
  const sections = ingredients.getByTestId("linked-recipe-ingredients");

  await expect(ingredients.getByText("fior di latte")).toBeVisible();
  await expect(sections).toHaveCount(3);
  await expect(sections.nth(0)).toContainText("Neapolitan Dough");
  await expect(sections.nth(0)).toContainText("tipo 00 flour");
  await expect(sections.nth(0)).toContainText("500");
  await expect(sections.nth(1)).toContainText("rye flour");
  await expect(sections.nth(2)).toContainText("san marzano tomatoes");

  // Double the pizza: its dough doubles with it.
  await ingredients.getByRole("button", { name: "More servings" }).click();
  await ingredients.getByRole("button", { name: "More servings" }).click();
  await expect(sections.nth(0)).toContainText("1000");
  await expect(sections.nth(2)).toContainText("800");

  await ingredients.getByRole("button", { name: "Fewer servings" }).click();
  await ingredients.getByRole("button", { name: "Fewer servings" }).click();
  await expect(sections.nth(0)).toContainText("500");
});

test("cooking mode walks the linked steps in place and lists the linked lines", async () => {
  await page.getByRole("button", { name: "Cook", exact: true }).locator("visible=true").click();

  const dialog = page.getByRole("dialog");

  // 4 own steps + 3 dough + 1 starter + 1 sauce.
  await expect(dialog.getByText("1 / 9")).toBeVisible();
  await expect(dialog.getByText("Make the Neapolitan Dough.").first()).toBeVisible();

  const expected = [
    ["Stir in the Rye Starter.", "From Neapolitan Dough"],
    ["Feed the starter with rye flour the night before.", "From Rye Starter"],
    ["Work in the salt.", "From Neapolitan Dough"],
    ["Knead the dough for 10 minutes.", "From Neapolitan Dough"],
    ["Spread the San Marzano Sauce.", null],
    ["Crush the tomatoes by hand.", "From San Marzano Sauce"],
    ["Stretch the Neapolitan Dough into rounds.", null],
    ["Tear the cheese over and bake.", null],
  ] as const;

  for (const [index, [stepText, from]] of expected.entries()) {
    await dialog.getByRole("button", { name: "Next step" }).click();
    await expect(dialog.getByText(`${index + 2} / 9`)).toBeVisible();

    // The centred card is the only one that scrolls on its own.
    const active = dialog.locator(".can-scroll-natively");

    await expect(active).toContainText(stepText);
    if (from) {
      await expect(active.getByTestId("cooking-step-linked-from")).toHaveText(from);
    } else {
      await expect(active.getByTestId("cooking-step-linked-from")).toHaveCount(0);
    }

    if (stepText === "Work in the salt.") {
      await expect(active.getByText("10 grams sea salt")).toBeVisible();
    }
  }

  // The ingredients view lists the linked recipes' lines under their names.
  await dialog.getByRole("button", { name: "Ingredients", exact: true }).click();

  const linked = dialog.getByTestId("linked-recipe-ingredients");

  await expect(dialog.getByText("fior di latte")).toBeVisible();
  await expect(linked).toHaveCount(3);
  await expect(linked.nth(0)).toContainText("tipo 00 flour");

  // A linked line ticks on its own and stays ticked across the two views.
  const flour = linked.nth(0).getByRole("button", { name: /tipo 00 flour/ });

  await flour.click();
  await expect(flour).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Steps", exact: true }).click();
  await dialog.getByRole("button", { name: "Ingredients", exact: true }).click();
  await expect(
    dialog
      .getByTestId("linked-recipe-ingredients")
      .nth(0)
      .getByRole("button", { name: /tipo 00 flour/ })
  ).toHaveAttribute("aria-pressed", "true");

  await dialog.getByRole("button", { name: "Close", exact: true }).click();
});

test("Add to groceries offers the linked recipes' lines with the recipe's own", async () => {
  await ingredientsCard().getByRole("button", { name: "Add", exact: true }).click();

  // Vaul's drawer content carries the panel's title as its name.
  const panel = page.getByRole("dialog", { name: "Add to Groceries" });

  for (const name of [
    "fior di latte",
    "tipo 00 flour",
    "sea salt",
    "rye flour",
    "san marzano tomatoes",
  ]) {
    await expect(panel.getByRole("checkbox", { name, exact: true })).toHaveCount(1);
  }

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("a step that only names a linked recipe gives way to its section", async () => {
  await page.goto(`/recipes/${ids.fries}`);

  const steps = stepsCard();
  const sauce = steps.getByTestId("linked-recipe-steps");

  await expect(sauce).toHaveCount(1);
  await expect(sauce.getByRole("link", { name: "San Marzano Sauce" })).toBeVisible();
  await expect(sauce.getByText("Crush the tomatoes by hand.")).toBeVisible();
  // The only link to the sauce is the section's own header.
  await expect(steps.getByRole("link", { name: "San Marzano Sauce" })).toHaveCount(1);
  // The recipe's own steps number on without it: Fry 1, Serve 2.
  await expect(steps.getByRole("button", { name: /^2 Serve hot\./ })).toBeVisible();

  await page.getByRole("button", { name: "Cook", exact: true }).locator("visible=true").click();

  const dialog = page.getByRole("dialog");

  // Fry, the sauce's one step, Serve: no slide for the bare link.
  await expect(dialog.getByText("1 / 3")).toBeVisible();
  await dialog.getByRole("button", { name: "Next step" }).click();
  await expect(dialog.locator(".can-scroll-natively")).toContainText("Crush the tomatoes by hand.");
  await expect(
    dialog.locator(".can-scroll-natively").getByTestId("cooking-step-linked-from")
  ).toHaveText("From San Marzano Sauce");
  await dialog.getByRole("button", { name: "Next step" }).click();
  await expect(dialog.locator(".can-scroll-natively")).toContainText("Serve hot.");

  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto(`/recipes/${ids.pizza}`);
});

test("a linked recipe's header takes the reader to it", async () => {
  await stepsCard()
    .getByTestId("linked-recipe-steps")
    .nth(2)
    .getByRole("link", { name: "San Marzano Sauce" })
    .click();

  await expect(page).toHaveURL(new RegExp(`/recipes/${ids.sauce}$`));
  await expect(stepsCard()).toContainText("Crush the tomatoes by hand.");
  // The sauce links nothing, so it reads as it always did.
  await expect(stepsCard().getByTestId("linked-recipe-steps")).toHaveCount(0);
});

test("the phone layout and its cooking mode show the linked recipes too", async ({ browser }) => {
  const phone = await browser.newContext({
    baseURL: stack.baseURL,
    storageState: { cookies: stack.ownerCookies, origins: [] },
    serviceWorkers: "allow",
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
  });

  try {
    const phonePage = await phone.newPage();

    page = phonePage;
    await phonePage.goto(`/recipes/${ids.pizza}`);

    await expect(stepsCard().getByTestId("linked-recipe-steps")).toHaveCount(3);
    await expect(ingredientsCard().getByTestId("linked-recipe-ingredients")).toHaveCount(3);

    await phonePage.getByRole("button", { name: "Cook", exact: true }).click();

    const dialog = phonePage.getByRole("dialog");

    await expect(dialog.getByText("1 / 9")).toBeVisible();
    await dialog.getByRole("button", { name: "Next step" }).click();
    await expect(dialog.locator(".can-scroll-natively")).toContainText("Stir in the Rye Starter.");
    await expect(
      dialog.locator(".can-scroll-natively").getByTestId("cooking-step-linked-from")
    ).toHaveText("From Neapolitan Dough");
  } finally {
    await phone.close();
  }
});
