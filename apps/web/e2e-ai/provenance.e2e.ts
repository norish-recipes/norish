/**
 * Recipe Provenance browser scenarios.
 *
 * The cross-cutting flows that only exist once every other piece has shipped:
 * an import entering automatic inference, supplied provenance suppressing it,
 * a manual run replacing the whole group, a quiet automatic failure, and a
 * rendered recipe updating in place.
 *
 * Only the AI provider's HTTP boundary is faked. The real Norish server,
 * database, Redis, BullMQ workers, repositories, authorized mutation layer,
 * realtime connection, and UI are all exercised.
 */
import type { AIE2EStack } from "@/e2e-ai/harness";
import type { BrowserContext, Page } from "@playwright/test";
import { E2E_BASE_URL, USER_A } from "@/e2e-ai/env";
import {
  bootStack,
  findCuisineIdByName,
  readStoredProvenance,
  setAutomaticEnrichment,
  signIn,
  submitPasteImport,
  supplyProvenance,
} from "@/e2e-ai/harness";
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

/** Extraction output with nothing an enrichment kind would defer to. */
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

/** A provenance claim as the model would return it: names, not ids. */
function provenanceClaim(overrides: Record<string, unknown> = {}) {
  return {
    originCountry: "IT",
    originRegion: "Lazio",
    cuisines: ["Italian"],
    provenanceNote: "Questa ricetta viene dalla cucina romana.",
    ...overrides,
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
  // Leave the switches off so this file cannot change what another spec enrols.
  await setAutomaticEnrichment({}).catch(() => undefined);
  await context?.close();
  await stack?.stop().catch(() => undefined);
  stack = null;
});

async function openRecipe(name: string): Promise<void> {
  await page.getByRole("heading", { name, exact: true, level: 3 }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 15_000 });
}

/** Import one recipe through the real AI paste path, without opening it. */
async function importRecipe(name: string, directives: unknown[]): Promise<void> {
  const ai = stack!.ai;

  ai.control.reset();
  ai.control.enqueue(
    ...directives.map((json) => ({ kind: "success" as const, content: JSON.stringify(json) }))
  );
  // Anything beyond the queued directives is a bug in the scenario, not silent
  // extra AI work: fail loudly rather than answering it.
  ai.control.setDefault(null);

  await page.goto("/");
  await submitPasteImport(page, `Import ${name} — the harness supplies the result.`);

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { name, exact: true, level: 3 })).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
}

async function importAndOpen(name: string, directives: unknown[]): Promise<void> {
  await importRecipe(name, directives);
  await openRecipe(name);
}

/** Poll the open recipe page until the assertion holds, reloading each attempt. */
async function eventuallyOnRecipe(assertion: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await page.reload();
    await assertion();
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
}

test("an import enters automatic provenance inference and the result is stored and rendered", async () => {
  await setAutomaticEnrichment({ recipeProvenance: true });

  await importAndOpen("Automatic Provenance Stew", [
    bareRecipe("Automatic Provenance Stew"),
    provenanceClaim(),
  ]);

  await eventuallyOnRecipe(async () => {
    // The country is localised at render time from the stored alpha-2 code.
    await expect(page.getByText("Italia").first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("Lazio").first()).toBeVisible({ timeout: 3_000 });
    // `.first()`: the section renders in both the desktop and mobile layouts,
    // one of which CSS hides — the same reason the other specs scope this way.
    await expect(page.getByText("Questa ricetta viene dalla cucina romana.").first()).toBeVisible({
      timeout: 3_000,
    });
    await expect(page.getByText("Italian").first()).toBeVisible({ timeout: 3_000 });
  });

  // Stored as a code and as a resolved vocabulary row, not as rendered text.
  const stored = await readStoredProvenance("Automatic Provenance Stew");

  expect(stored.originCountry).toBe("IT");
  expect(stored.originRegion).toBe("Lazio");
  expect(stored.cuisines).toEqual(["Italian"]);
});

test("supplied provenance suppresses the automatic run for the whole group", async () => {
  await setAutomaticEnrichment({});

  // Import with automation off, then supply provenance the way an editor would.
  await importRecipe("Supplied Provenance Stew", [bareRecipe("Supplied Provenance Stew")]);
  await supplyProvenance("Supplied Provenance Stew", {
    originCountry: "NL",
    provenanceNote: "Set by an editor.",
  });

  // Now import a second recipe with automation on. Only the extraction
  // directive is queued, so an enrolled provenance job would call the provider
  // and the null default would fail loudly.
  await setAutomaticEnrichment({ recipeProvenance: true });
  await importAndOpen("Second Provenance Stew", [
    bareRecipe("Second Provenance Stew"),
    provenanceClaim(),
  ]);
  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("Italia").first()).toBeVisible({ timeout: 3_000 });
  });

  // The supplied recipe was never touched: the whole group is what a person set,
  // including the Cuisines the AI would have added beside it.
  const stored = await readStoredProvenance("Supplied Provenance Stew");

  expect(stored).toEqual({
    originCountry: "NL",
    originRegion: null,
    provenanceNote: "Set by an editor.",
    cuisines: [],
  });
});

test("a manual run replaces the entire group", async () => {
  await setAutomaticEnrichment({});

  await importAndOpen("Manual Provenance Stew", [bareRecipe("Manual Provenance Stew")]);
  await supplyProvenance("Manual Provenance Stew", {
    originCountry: "NL",
    provenanceNote: "An earlier claim.",
    cuisineIds: [await findCuisineIdByName("French")],
  });

  // A manual request is a deliberate refresh: it runs while the automatic
  // switch is off, and replaces regardless of what is stored.
  stack!.ai.control.succeedWith(provenanceClaim());

  await page.reload();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Work Out Provenance" }).click();

  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("Italia").first()).toBeVisible({ timeout: 3_000 });
  });

  const stored = await readStoredProvenance("Manual Provenance Stew");

  expect(stored).toEqual({
    originCountry: "IT",
    originRegion: "Lazio",
    provenanceNote: "Questa ricetta viene dalla cucina romana.",
    // The whole group was replaced: the earlier Cuisine is gone, not merged.
    cuisines: ["Italian"],
  });
});

test("an automatic failure is quiet and leaves the recipe untouched and unmarked", async () => {
  await setAutomaticEnrichment({ recipeProvenance: true });

  const ai = stack!.ai;

  ai.control.reset();
  ai.control.enqueue({
    kind: "success",
    content: JSON.stringify(bareRecipe("Quiet Provenance Stew")),
  });
  // Every inference attempt fails permanently, so the kind reaches `failed`.
  ai.control.failPermanently("provider refused");

  await page.goto("/");
  await submitPasteImport(page, "Import Quiet Provenance Stew — the harness supplies the result.");

  await expect(async () => {
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Quiet Provenance Stew", exact: true, level: 3 })
    ).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  await openRecipe("Quiet Provenance Stew");

  // Wait for the retained terminal state before the next scenario resets the
  // provider. Otherwise this job can consume that scenario's extraction reply.
  await expect(async () => {
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Actions" }).click();
    const action = page
      .getByRole("menuitem")
      .filter({ has: page.getByText("Work Out Provenance", { exact: true }) });

    await expect(action.getByText("Last run failed", { exact: true })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 60_000, intervals: [500, 1_000, 2_000] });
  await page.keyboard.press("Escape");

  // Nothing was surfaced: no error toast for work the user did not ask for.
  await expect(page.getByText("Enrichment failed")).toHaveCount(0);

  // And the recipe is genuinely untouched and unmarked, not merely un-errored.
  const stored = await readStoredProvenance("Quiet Provenance Stew");

  expect(stored).toEqual({
    originCountry: null,
    originRegion: null,
    provenanceNote: null,
    cuisines: [],
  });
  await expect(page.getByText("Questa ricetta")).toHaveCount(0);
});

test("a rendered recipe updates in place when provenance arrives", async () => {
  await setAutomaticEnrichment({});

  await importAndOpen("Live Provenance Stew", [bareRecipe("Live Provenance Stew")]);

  // Nothing stored and nothing running: the eventual provenance content is absent.
  await expect(page.getByRole("heading", { name: "日本", exact: true, level: 2 })).toHaveCount(0);
  await expect(page.getByText("Japanese", { exact: true })).toHaveCount(0);

  stack!.ai.control.succeedWith(
    provenanceClaim({ originCountry: "JP", originRegion: null, cuisines: ["Japanese"] })
  );

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Work Out Provenance" }).click();
  await page.keyboard.press("Escape");

  // No reload: the canonical recipe update arrives over the existing realtime
  // connection and the open page re-renders.
  await expect(page.getByRole("heading", { name: "日本", exact: true, level: 2 })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("Japanese", { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
});
