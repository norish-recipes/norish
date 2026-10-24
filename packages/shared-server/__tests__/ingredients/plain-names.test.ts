// @vitest-environment node
/**
 * Plain Names against a real database: AI renames a food to its plain name
 * as an AI Change, which settles the name; merges it into the food already
 * spelling it; settles a name already plain; and the recheck never renames
 * a settled name from the words. The language model is mocked at
 * `generateStructured`.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { listAIChanges } from "@norish/db/repositories/ingredient-ai-changes";
import { adoptPlainName } from "@norish/db/repositories/ingredient-seed";
import { ingredientAliases, ingredients } from "@norish/db/schema";
import { generateStructured } from "@norish/shared-server/ai/runtime/runtime";
import { isAIEnabled } from "@norish/shared-server/config/server-config-loader";
import { undoAIChange } from "@norish/shared-server/ingredients/ai-changes";
import { markDistinct, renameIngredient } from "@norish/shared-server/ingredients/catalogue";
import { giveItsPlainName } from "@norish/shared-server/ingredients/plain-names";
import { resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import {
  getSpellingTexts,
  getTestDb,
  nameInATestRecipe,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  decide: vi.fn(),
  generateStructured: vi.fn(),
}));
vi.mock("@norish/shared-server/config/server-config-loader", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isAIEnabled: vi.fn(),
}));

/** What the language model reads the next name as. */
function readsAs(plainName: string | null) {
  vi.mocked(generateStructured).mockResolvedValueOnce({ plainName });
}

describe("Plain Names", () => {
  const testBase = new RepositoryTestBase("test_ingredient_plain_names");

  let actor: CatalogueActor;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    actor = { userId: user.id, householdUserIds: null, isServerAdmin: false };
    vi.mocked(generateStructured).mockReset();
    vi.mocked(isAIEnabled).mockResolvedValue(false);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** A food a recipe line names, so AI may name it, flagged as the upgrade leaves them. */
  async function food(text: string) {
    const [resolved] = await resolveIngredients([text], { userId: actor.userId });

    await nameInATestRecipe(actor.userId, resolved!.aliasId, text);
    await getTestDb()
      .update(ingredients)
      .set({ flagged: true, flagReason: "upgrade" })
      .where(eq(ingredients.id, resolved!.ingredientId));

    return resolved!.ingredientId;
  }

  async function row(id: string) {
    const [found] = await getTestDb()
      .select({
        name: ingredients.name,
        flagged: ingredients.flagged,
        nameSettled: ingredients.nameSettled,
      })
      .from(ingredients)
      .where(eq(ingredients.id, id));

    return found!;
  }

  it("renames the food to its plain name, settles it, and lists the rename to undo", async () => {
    const tonijn = await food("Lekkerste Tonijn Uit Blik");

    readsAs("tonijn uit blik");
    await expect(giveItsPlainName(tonijn)).resolves.toEqual({
      outcome: "rename",
      to: "tonijn uit blik",
    });
    // The question saw the food's other spellings too.
    expect(vi.mocked(generateStructured).mock.calls[0]![0].sections).toEqual([
      "Name: Lekkerste Tonijn Uit Blik",
    ]);
    // A tidier name says nothing about whether the food is a duplicate: the flag stays.
    expect(await row(tonijn)).toEqual({
      name: "tonijn uit blik",
      flagged: true,
      nameSettled: true,
    });
    // The old name stays a spelling, so lines written so still find the food.
    expect(await getSpellingTexts(tonijn)).toEqual(
      expect.arrayContaining(["Lekkerste Tonijn Uit Blik", "tonijn uit blik"])
    );
    expect(await listAIChanges()).toMatchObject([
      { sure: true, undo: { kind: "plain-name", formerName: "Lekkerste Tonijn Uit Blik" } },
    ]);
  });

  it("settles a name already plain, and asks about it no more", async () => {
    const thyme = await food("tijm");

    readsAs("tijm");
    await expect(giveItsPlainName(thyme)).resolves.toEqual({ outcome: "plain" });
    expect(await row(thyme)).toMatchObject({ nameSettled: true, flagged: true });
    expect(await listAIChanges()).toEqual([]);
    await expect(giveItsPlainName(thyme)).resolves.toEqual({
      outcome: "skipped",
      reason: "settled",
    });
  });

  it("settles a name the plain name differs from only in case, keeping its casing", async () => {
    const chips = await food("Tortilla Chips");

    readsAs("tortilla chips");
    await expect(giveItsPlainName(chips)).resolves.toEqual({ outcome: "plain" });
    expect(await row(chips)).toMatchObject({ name: "Tortilla Chips", nameSettled: true });
    expect(await listAIChanges()).toEqual([]);
  });

  it("lowers a name in capitals only to its plain name", async () => {
    const tuna = await food("TONIJN UIT BLIK");

    readsAs("tonijn uit blik");
    await expect(giveItsPlainName(tuna)).resolves.toEqual({
      outcome: "rename",
      to: "tonijn uit blik",
    });
    expect(await row(tuna)).toMatchObject({ name: "tonijn uit blik", nameSettled: true });
  });

  it("merges into the food that already spells the plain name", async () => {
    const onion = await food("onion");
    const messy = await food("Verse Onion Deluxe");

    readsAs("onion");
    await expect(giveItsPlainName(messy)).resolves.toMatchObject({
      outcome: "merge",
      into: "onion",
    });
    expect(await getSpellingTexts(onion)).toContain("Verse Onion Deluxe");
    expect(await listAIChanges()).toMatchObject([
      {
        sure: true,
        ingredient: { id: onion },
        undo: { kind: "merge", name: "Verse Onion Deluxe" },
      },
    ]);
  });

  /** Give a food one more spelling, in `locale`. */
  async function spell(ingredientId: string, text: string, locale: string | null = null) {
    await getTestDb()
      .insert(ingredientAliases)
      .values({ ingredientId, text, fold: ingredientAliasFold(text), locale, ownerId: null });
  }

  it("merges into a food spelling the plain name only where a recipe line lists it", async () => {
    const [hidden] = await resolveIngredients(["uien"], { userId: actor.userId });

    await spell(hidden!.ingredientId, "onion", "en");
    const messy = await food("Verse Onion Deluxe");

    readsAs("onion");
    await expect(giveItsPlainName(messy)).resolves.toEqual({ outcome: "rename", to: "onion" });
    expect(await getSpellingTexts(hidden!.ingredientId)).not.toContain("Verse Onion Deluxe");
  });

  it("merges into a listed food by the spelling the plain name finds", async () => {
    const onions = await food("uien");

    await spell(onions, "onion", "en");
    const messy = await food("Verse Onion Deluxe");

    readsAs("onion");
    await expect(giveItsPlainName(messy)).resolves.toMatchObject({
      outcome: "merge",
      into: "uien",
    });
  });

  it("never merges into a food spelling the plain name only in a language Norish does not read", async () => {
    const pear = await food("peer");

    // Pear's Volapük "bün" is not the bun AI named.
    await spell(pear, "bün", "vo");
    const messy = await food("Verse Bün Deluxe");

    readsAs("bün");
    await expect(giveItsPlainName(messy)).resolves.toEqual({ outcome: "rename", to: "bün" });
    expect(await getSpellingTexts(pear)).not.toContain("Verse Bün Deluxe");
  });

  it("merges the second of two foods AI reads the same into the first", async () => {
    const lekkerste = await food("Lekkerste Tonijn Uit Blik");
    const voordeel = await food("Voordeel Tonijn Uit Blik");

    readsAs("tonijn uit blik");
    readsAs("tonijn uit blik");
    await giveItsPlainName(lekkerste);
    await expect(giveItsPlainName(voordeel)).resolves.toMatchObject({
      outcome: "merge",
      into: "tonijn uit blik",
    });
    expect(await getSpellingTexts(lekkerste)).toEqual(
      expect.arrayContaining(["Lekkerste Tonijn Uit Blik", "Voordeel Tonijn Uit Blik"])
    );
  });

  it("gives the old name back on Undo, and AI names the food no more", async () => {
    const knaks = await food("Unox Knaks Original");

    readsAs("Unox Knaks");
    await giveItsPlainName(knaks);
    await undoAIChange(actor, (await listAIChanges())[0]!.id);

    expect(await row(knaks)).toMatchObject({ name: "Unox Knaks Original", nameSettled: true });
  });

  it("changes nothing for a name AI finds no food in", async () => {
    const junk = await food("zie stap 3");

    readsAs(null);
    await expect(giveItsPlainName(junk)).resolves.toMatchObject({
      outcome: "unsure",
      reason: "no-food",
    });
    expect(await row(junk)).toMatchObject({ nameSettled: false });
  });

  it("asks about neither a seeded food nor one a person decided about", async () => {
    const seeded = await food("salt");
    const kept = await food("Verse Kipfilet");

    await getTestDb()
      .update(ingredients)
      .set({ offId: "en:salt" })
      .where(eq(ingredients.id, seeded));
    await markDistinct(actor, kept);

    await expect(giveItsPlainName(seeded)).resolves.toEqual({
      outcome: "skipped",
      reason: "decided",
    });
    await expect(giveItsPlainName(kept)).resolves.toEqual({
      outcome: "skipped",
      reason: "decided",
    });
    expect(vi.mocked(generateStructured)).not.toHaveBeenCalled();
  });

  it("gives a new food its plain name at once, keeping its flag", async () => {
    const tonijn = await food("Lekkerste Tonijn Uit Blik");

    readsAs("tonijn uit blik");
    await giveItsPlainName(tonijn);

    expect(await row(tonijn)).toEqual({
      name: "tonijn uit blik",
      flagged: true,
      nameSettled: true,
    });
  });

  it("merges a new food into the food that already spells its plain name", async () => {
    const onion = await food("onion");
    const messy = await food("Verse Onion Deluxe");

    readsAs("onion");
    await giveItsPlainName(messy);

    expect(await getSpellingTexts(onion)).toContain("Verse Onion Deluxe");
  });

  it("never renames a settled name from the words again", async () => {
    const tonijn = await food("Lekkerste Tonijn Uit Blik");

    readsAs("tonijn uit blik");
    await giveItsPlainName(tonijn);
    await adoptPlainName(tonijn, {
      text: "lekkerste tonijn",
      fold: ingredientAliasFold("lekkerste tonijn"),
    });

    expect(await row(tonijn)).toMatchObject({ name: "tonijn uit blik" });
  });

  it("asks no more about a food a person named themselves", async () => {
    const tonijn = await food("Lekkerste Tonijn Uit Blik");

    await renameIngredient(actor, tonijn, "tonijn");

    await expect(giveItsPlainName(tonijn)).resolves.toEqual({
      outcome: "skipped",
      reason: "settled",
    });
    expect(vi.mocked(generateStructured)).not.toHaveBeenCalled();
  });
});
