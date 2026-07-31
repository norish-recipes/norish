/**
 * Recipe Enrichment browser scenarios.
 *
 * Acceptance for this flow crosses recipe creation, the enrichment queues, WebSocket
 * delivery, client cache updates, and visible feedback — no single unit seam
 * covers it. Only the AI provider's HTTP boundary is faked; the real Norish
 * server, database, Redis, BullMQ workers, repositories, authorized mutation
 * layer, realtime connection, and UI are all exercised.
 */
import type { AIE2EStack } from "@/e2e-ai/harness";
import type { BrowserContext, Page } from "@playwright/test";
import { E2E_BASE_URL, USER_A } from "@/e2e-ai/env";
import { bootStack, readStoredCategories, setAutomaticEnrichment, signIn } from "@/e2e-ai/harness";
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

/** Extraction output with no categories and no nutrition: enrichment territory. */
function bareRecipe(name: string) {
  return {
    name,
    description: "A deterministic recipe returned by the E2E AI provider.",
    notes: null,
    recipeYield: 4,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    recipeIngredient: {
      metric: ["200 g pinto beans", "1 L vegetable stock"],
      us: ["7 oz pinto beans", "4 cups vegetable stock"],
    },
    recipeInstructions: {
      metric: ["Simmer for 40 minutes.", "Season, then serve."],
      us: ["Simmer for 40 minutes.", "Season, then serve."],
    },
    keywords: null,
    allergyIndications: [],
    categories: [],
    nutrition: { calories: null, fat: null, carbs: null, protein: null },
  };
}

/** Extraction output whose source explicitly supplied categories and nutrition. */
function suppliedRecipe(name: string) {
  return {
    ...bareRecipe(name),
    categories: ["Breakfast"],
    nutrition: { calories: 250, fat: 5, carbs: 30, protein: 10 },
  };
}

let stack: AIE2EStack | null = null;
let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  stack = await bootStack();

  const cookies = await signIn(USER_A);

  context = await browser.newContext({ baseURL: E2E_BASE_URL });
  await context.addCookies(cookies);
  page = await context.newPage();
});

test.afterAll(async () => {
  // Leave the switches off so this file cannot change what another spec's
  // imports enrol.
  await setAutomaticEnrichment({}).catch(() => undefined);
  await context?.close();
  await stack?.stop().catch(() => undefined);
  stack = null;
});

/**
 * Import one recipe through the real AI paste path and open it.
 *
 * `directives` are consumed FIFO: the first serves the import's extraction call,
 * any others serve the enrichment jobs that follow.
 */
async function importAndOpen(name: string, directives: unknown[]): Promise<void> {
  const ai = stack!.ai;

  ai.control.reset();
  ai.control.enqueue(
    ...directives.map((json) => ({ kind: "success" as const, content: JSON.stringify(json) }))
  );
  // Anything beyond the queued directives is a bug in the scenario, not silent
  // extra AI work: fail loudly rather than answering it.
  ai.control.setDefault(null);

  await page.goto("/");
  await openPasteImport();
  await page
    .getByPlaceholder("Paste a recipe (free text) or JSON-LD here...")
    .fill(`Import ${name} — the harness supplies the result.`);
  await page.getByRole("button", { name: "AI Import" }).click();

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { name, exact: true, level: 3 })).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  await openRecipe(name);
}

/** Open the recipe card itself, excluding same-name toasts and dashboard text. */
async function openRecipe(name: string): Promise<void> {
  await page.getByRole("heading", { name, exact: true, level: 3 }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 15_000 });
}

/** Open the actions menu from a known closed state, including inside retries. */
async function openActions(): Promise<void> {
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Actions" }).click();
}

/**
 * Open the create menu and choose Paste.
 *
 * Retried as a unit: a toast left over from a previous scenario can steal the
 * click that opens the menu, and the menu then never appears.
 */
async function openPasteImport(): Promise<void> {
  // Retried as a unit through to the open dialog: a toast left over from an
  // earlier scenario can steal the click that opens the menu, and the menu can
  // also close again between opening and the next action.
  await expect(async () => {
    await page.getByRole("button", { name: "Add Recipe", exact: true }).click();
    await page.getByRole("menuitem", { name: "Paste" }).click({ timeout: 2_000 });
    await expect(
      page.getByPlaceholder("Paste a recipe (free text) or JSON-LD here...")
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000, intervals: [500, 1_000, 2_000] });
}

/** Create through the ordinary recipe form, then wait for the detail route. */
async function createManuallyAndOpen(name: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Add Recipe", exact: true }).click();
  await page.getByRole("menuitem", { name: "Create" }).click();

  await page.getByLabel("Recipe Name").fill(name);
  await page.getByPlaceholder("e.g., 2 cups flour").fill("200 g pinto beans");
  // Focusing the step field blurs the ingredient row, and blur commits the
  // parsed ingredient immediately — no debounce window left to outwait.
  await page.getByPlaceholder("Step 1: Describe the step...").fill("Simmer until tender.");

  await page.getByRole("button", { name: "Create Recipe" }).click();

  await expect(page).toHaveURL(/\/recipes\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Poll the open recipe page until the assertion holds, reloading each attempt. */
async function eventuallyOnRecipe(assertion: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await page.reload();
    await assertion();
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
}

// One automatic kind per scenario. The enrichment queues run concurrently, so a
// scenario that enabled two would race for the provider's queued responses;
// which kind runs is the coordinator's decision and is asserted directly.
test("an import enrols the enabled automatic kind and renders the result", async () => {
  await setAutomaticEnrichment({ autoTagging: true });

  await importAndOpen("Automatic Enrichment Stew", [
    bareRecipe("Automatic Enrichment Stew"),
    // The one enrichment call that follows the extraction call.
    { tags: ["hearty", "one-pot"] },
  ]);

  // Auto-tagging applied to a recipe whose extraction supplied no tags.
  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("hearty").first()).toBeVisible({ timeout: 3_000 });
  });

  await page.getByRole("button", { name: "Actions" }).click();
  await expect(page.getByText("Completed")).toBeVisible();
  await page.keyboard.press("Escape");

  // Enrichment is quiet on success: the recipe updated, and nothing was raised.
  await expect(page.getByText(/enrichment failed/i)).toHaveCount(0);
});

test("a manual creation enrols the enabled automatic kind", async () => {
  await setAutomaticEnrichment({ autoTagging: true });

  stack!.ai.control.reset();
  stack!.ai.control.succeedWith({ tags: ["created-manually"] });

  await createManuallyAndOpen("Manual Creation Stew");

  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("created-manually").first()).toBeVisible({ timeout: 3_000 });
  });
});

test("a disabled automatic switch leaves that kind alone", async () => {
  await setAutomaticEnrichment({ autoTagging: false });

  // Only the extraction directive is queued: an enrolled auto-tagging job would
  // call the provider, and the null default fails the request loudly.
  await importAndOpen("No Automation Stew", [bareRecipe("No Automation Stew")]);

  expect(stack!.ai.control.requestCount).toBe(1);
});

test("automatic categorization fills an empty category list", async () => {
  await setAutomaticEnrichment({ autoCategorization: true });

  await importAndOpen("Automatic Categories Stew", [
    bareRecipe("Automatic Categories Stew"),
    { categories: ["Dinner"] },
  ]);

  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("Dinner").first()).toBeVisible({ timeout: 3_000 });
  });
});

test("supplied categories and nutrition suppress the automatic replacements", async () => {
  await setAutomaticEnrichment({ autoCategorization: true, nutritionEstimation: true });

  // Only the extraction directive is queued: if either replacement kind were
  // enrolled it would call the provider, and the null default fails the request.
  await importAndOpen("Supplied Data Stew", [suppliedRecipe("Supplied Data Stew")]);

  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("Breakfast").first()).toBeVisible({ timeout: 3_000 });
  });

  // Only the extraction call happened. Neither replacement kind was enrolled,
  // which is the real proof — page text is not, since the mini-calendar renders
  // every meal slot by name regardless of the recipe.
  expect(stack!.ai.control.requestCount).toBe(1);
});

test("a manually requested categorization replaces the supplied categories", async () => {
  await setAutomaticEnrichment({});

  await importAndOpen("Manual Refresh Stew", [suppliedRecipe("Manual Refresh Stew")]);

  // A manual run is a deliberate refresh, so it replaces rather than defers.
  stack!.ai.control.succeedWith({ categories: ["Dinner"] });

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Auto Categorize" }).click();

  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("Dinner").first()).toBeVisible({ timeout: 3_000 });
  });

  // The manual run replaced rather than deferred: it called the provider even
  // though a category was already supplied.
  expect(stack!.ai.control.requestCount).toBeGreaterThanOrEqual(2);
});

test("auto-tagging appends without removing existing tags", async () => {
  await setAutomaticEnrichment({});

  await importAndOpen("Append Tags Stew", [
    { ...bareRecipe("Append Tags Stew"), keywords: ["supplied-tag"] },
  ]);

  await expect(page.getByText("supplied-tag").first()).toBeVisible({ timeout: 15_000 });

  stack!.ai.control.succeedWith({ tags: ["added-tag"] });

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Auto-tag" }).click();

  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("added-tag").first()).toBeVisible({ timeout: 3_000 });
    // The supplied tag is still there: enrichment appends, it never rewrites.
    await expect(page.getByText("supplied-tag").first()).toBeVisible({ timeout: 3_000 });
  });
});

test("an automatic failure stays quiet and leaves the recipe intact", async () => {
  await setAutomaticEnrichment({ autoCategorization: true });

  const ai = stack!.ai;

  ai.control.reset();
  ai.control.enqueue({
    kind: "success",
    content: JSON.stringify(bareRecipe("Quiet Failure Stew")),
  });
  // Every enrichment attempt fails permanently, so the kind reaches `failed`.
  ai.control.failPermanently("provider refused");

  await page.goto("/");
  await openPasteImport();
  await page
    .getByPlaceholder("Paste a recipe (free text) or JSON-LD here...")
    .fill("Import Quiet Failure Stew — the harness supplies the result.");
  await page.getByRole("button", { name: "AI Import" }).click();

  // The recipe still arrives: enrichment cannot turn a successful import into
  // a failure, and its own failure raises no error for the user.
  await expect(async () => {
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Quiet Failure Stew", exact: true, level: 3 })
    ).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  await openRecipe("Quiet Failure Stew");

  // Wait for the retained terminal state before the next scenario resets the
  // provider. Otherwise this job can consume that scenario's extraction reply.
  await expect(async () => {
    await openActions();
    const action = page
      .getByRole("menuitem")
      .filter({ has: page.getByText("Auto Categorize", { exact: true }) });

    await expect(action.getByText("Last run failed", { exact: true })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 60_000, intervals: [500, 1_000, 2_000] });

  // The discoverable inline status is not an automatic error toast.
  await expect(page.getByText("Enrichment failed")).toHaveCount(0);
});

test("a manual failure is reported to the requester", async () => {
  await setAutomaticEnrichment({});

  await importAndOpen("Manual Failure Stew", [bareRecipe("Manual Failure Stew")]);

  stack!.ai.control.failPermanently("provider refused");

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Auto Categorize" }).click();

  // Unlike the automatic case, an action the user asked for reports its failure.
  await expect(page.getByText(/enrichment failed/i).first()).toBeVisible({ timeout: 60_000 });
});

test("lifecycle state survives a page reload and reconnect", async () => {
  await setAutomaticEnrichment({});

  await importAndOpen("Reload Recovery Stew", [bareRecipe("Reload Recovery Stew")]);

  // Hold the provider so the job stays in flight while we reload: the state on
  // screen must come from the status query, not from having watched the events.
  stack!.ai.control.succeedWith({ categories: ["Dinner"] });
  stack!.ai.control.hold();
  let isOffline = false;

  try {
    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitem", { name: "Auto Categorize" }).click();

    await expect(async () => {
      expect(stack!.ai.control.requestCount).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 30_000 });

    await page.reload();

    // The action reads as in-flight after a reload, recovered from the status
    // query alone — this browser never saw the queued or processing event.
    await expect(async () => {
      await openActions();
      await expect(
        page.getByRole("menuitem", { name: /Auto-categorizing.*In progress/i })
      ).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000, intervals: [500, 1_000, 2_000] });

    await page.keyboard.press("Escape");

    // Miss the terminal realtime events while disconnected. Reconnect Recovery
    // must converge both the recipe and lifecycle query without another reload.
    await context.setOffline(true);
    isOffline = true;
    stack!.ai.control.release();
    // Stay offline until the released worker has persisted its result: the
    // terminal events then provably fired while this browser was disconnected,
    // so reconnecting exercises recovery rather than live delivery.
    await expect(async () => {
      expect(await readStoredCategories("Reload Recovery Stew")).toContain("Dinner");
    }).toPass({ timeout: 30_000, intervals: [250, 500, 1_000] });
    await context.setOffline(false);
    isOffline = false;

    await expect(async () => {
      await expect(page.getByText("Dinner").first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000, intervals: [500, 1_000, 2_000] });

    await page.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByText("Completed")).toBeVisible({ timeout: 10_000 });
  } finally {
    // Always release: a held provider would hang every later scenario's
    // extraction call, turning one failure into a cascade.
    stack!.ai.control.release();
    if (isOffline) await context.setOffline(false);
  }
});
