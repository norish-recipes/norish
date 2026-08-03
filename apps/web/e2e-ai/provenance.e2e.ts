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
    originCountryName: "Italia",
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
    // The card titles itself with the stored written name, in the language the
    // inference wrote the note in.
    await expect(page.getByText("Italia").first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("Lazio").first()).toBeVisible({ timeout: 3_000 });
    // `.first()`: the section renders in both the desktop and mobile layouts,
    // one of which CSS hides — the same reason the other specs scope this way.
    await expect(page.getByText("Questa ricetta viene dalla cucina romana.").first()).toBeVisible({
      timeout: 3_000,
    });
    await expect(page.getByText("Italian").first()).toBeVisible({ timeout: 3_000 });
  });

  // Stored as a code, a written name, and a resolved vocabulary row.
  const stored = await readStoredProvenance("Automatic Provenance Stew");

  expect(stored.originCountry).toBe("IT");
  expect(stored.originCountryName).toBe("Italia");
  expect(stored.originRegion).toBe("Lazio");
  expect(stored.cuisines).toEqual(["Italian"]);
});

test("the provenance heading speaks the recipe's language, not the country's or the reader's", async () => {
  await setAutomaticEnrichment({ recipeProvenance: true });

  // A Dutch recipe about a Turkish dish: the model writes the note in Dutch
  // and names the country in Dutch too. The reader's locale is English and the
  // endonym would be "Türkiye" — "Turkije" can only come from the stored name.
  await importAndOpen("Turkse Linzensoep", [
    bareRecipe("Turkse Linzensoep"),
    provenanceClaim({
      originCountry: "TR",
      originCountryName: "Turkije",
      originRegion: null,
      cuisines: [],
      provenanceNote: "Dit gerecht komt uit de Turkse keuken.",
    }),
  ]);

  await eventuallyOnRecipe(async () => {
    await expect(page.getByRole("heading", { name: "Turkije", level: 2 }).first()).toBeVisible({
      timeout: 3_000,
    });
    await expect(page.getByText("Dit gerecht komt uit de Turkse keuken.").first()).toBeVisible({
      timeout: 3_000,
    });
  });

  const stored = await readStoredProvenance("Turkse Linzensoep");

  expect(stored.originCountry).toBe("TR");
  expect(stored.originCountryName).toBe("Turkije");
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
    originCountryName: null,
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
    originCountryName: "Italia",
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
    originCountryName: null,
    originRegion: null,
    provenanceNote: null,
    cuisines: [],
  });
  await expect(page.getByText("Questa ricetta")).toHaveCount(0);
});

test("a genuinely unplaceable dish keeps an empty country, titled by the section itself", async () => {
  await setAutomaticEnrichment({});

  await importAndOpen("Unplaceable Fusion Bowl", [bareRecipe("Unplaceable Fusion Bowl")]);

  // The model follows the null-only-when-unplaceable rule: no country, no
  // name, no region — but the note explains, so the claim is substantive.
  stack!.ai.control.succeedWith(
    provenanceClaim({
      originCountry: null,
      originCountryName: null,
      originRegion: null,
      cuisines: [],
      provenanceNote: "Dit gerecht is niet aan één land te koppelen.",
    })
  );

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Work Out Provenance" }).click();
  await page.keyboard.press("Escape");

  await eventuallyOnRecipe(async () => {
    // No invented country: the section falls back to naming itself, and the
    // note is stored intact rather than wiped with the empty fields.
    await expect(page.getByRole("heading", { name: "Provenance", level: 2 }).first()).toBeVisible({
      timeout: 3_000,
    });
    await expect(
      page.getByText("Dit gerecht is niet aan één land te koppelen.").first()
    ).toBeVisible({ timeout: 3_000 });
  });

  const stored = await readStoredProvenance("Unplaceable Fusion Bowl");

  expect(stored).toEqual({
    originCountry: null,
    originCountryName: null,
    originRegion: null,
    provenanceNote: "Dit gerecht is niet aan één land te koppelen.",
    cuisines: [],
  });
});

test("a rendered recipe updates in place when provenance arrives", async () => {
  await setAutomaticEnrichment({});

  await importAndOpen("Live Provenance Stew", [bareRecipe("Live Provenance Stew")]);

  // Nothing stored and nothing running: the eventual provenance content is absent.
  await expect(page.getByRole("heading", { name: "日本", exact: true, level: 2 })).toHaveCount(0);
  await expect(page.getByText("Japanese", { exact: true })).toHaveCount(0);

  stack!.ai.control.succeedWith(
    provenanceClaim({
      originCountry: "JP",
      originCountryName: "日本",
      originRegion: null,
      cuisines: ["Japanese"],
    })
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

test("a manually picked country reaches the dashboard card without a reload", async () => {
  // Pins the drift regression: the realtime echo used to hand-copy dashboard
  // fields and forgot originCountry, so a card only gained its flag after a
  // full refresh — the detail cache got the full write, the list cache never
  // (see RECIPE_DASHBOARD_KEYS).
  await setAutomaticEnrichment({});

  const name = "Dashboard Flag Rigatoni";

  await importRecipe(name, [bareRecipe(name)]);

  // A second page parks on the dashboard and is never navigated again: only
  // the realtime echo may deliver the flag to it.
  const dashboard = await context.newPage();

  await dashboard.goto("/");

  const heading = dashboard.getByRole("heading", { name, exact: true, level: 3 });

  await expect(heading).toBeVisible({ timeout: 15_000 });
  const card = heading.locator("xpath=ancestor::*[contains(@class, 'group/row')][1]");

  await expect(card.getByTitle("Italy")).toHaveCount(0);

  // Manual provenance through the real edit form and the real update mutation.
  await openRecipe(name);
  const recipeId = new URL(page.url()).pathname.split("/").pop();

  await page.goto(`/recipes/edit/${recipeId}`);

  // The form re-renders as the recipe's data arrives; retry until the country
  // picker takes the selection (same pattern as the screenshot suite).
  const country = page.getByRole("combobox", { name: "Country" });

  await expect(async () => {
    await expect(country).toBeVisible({ timeout: 5_000 });
    await country.fill("Italy");
    await page.getByRole("option", { name: "Italy", exact: true }).click({ timeout: 5_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  await page.getByRole("button", { name: "Save Changes" }).click();

  // The parked dashboard gains the flag purely through the echo.
  await expect(card.getByTitle("Italy").first()).toBeVisible({ timeout: 30_000 });
  await dashboard.close();
});
