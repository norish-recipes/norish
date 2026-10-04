// @vitest-environment node
/**
 * Rung 4's parent from words, against a real database: a Flagged Ingredient
 * minted for a text that contains a seeded spelling is filed under it,
 * longest first, and stays flagged for a person to look at (ADR-0037 as
 * amended). A spelling the text ends with is filed quietly; one found
 * elsewhere in the words comes with a suggestion to confirm or dismiss.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SeedEntry } from "@norish/db/repositories/ingredient-seed";
import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import {
  applyIngredientSeed,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
import { listIngredientSuggestions } from "@norish/db/repositories/ingredient-suggestions";
import { ingredientAliases } from "@norish/db/schema";
import { listIngredients, setParent } from "@norish/shared-server/ingredients/catalogue";
import { resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import {
  confirmSuggestion,
  dismissSuggestion,
  listSuggestions,
} from "@norish/shared-server/ingredients/suggestions";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import { getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

function entry(offId: string, ...names: string[]): SeedEntry {
  return {
    offId,
    name: names[0]!,
    nameFold: ingredientAliasFold(names[0]!),
    parentOffId: null,
    nutrition: null,
    aliases: names.map((text) => ({ text, fold: ingredientAliasFold(text), locale: null })),
  };
}

describe("a mint's parent from the words of its text", () => {
  const testBase = new RepositoryTestBase("test_parent_from_words");

  let actor: CatalogueActor;
  let seeded: Map<string, string>;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    actor = { userId: user.id, householdUserIds: null, isServerAdmin: true };
    await applyIngredientSeed([
      entry("en:cumin", "cumin", "komijn"),
      entry("en:parsley", "parsley", "peterselie"),
      entry("en:paprika", "paprika"),
      entry("en:sweet-paprika", "sweet paprika"),
      entry("en:noodle", "noodles"),
      entry("en:garlic", "garlic", "knoflook"),
      entry("en:kale", "kale"),
      entry("en:olive-oil", "olive oil", "olijfolie"),
      entry("en:sardine", "sardines"),
      entry("en:chicken", "chicken", "kip"),
      entry("en:rice", "rice", "rijst"),
      entry("en:tomato", "tomato"),
      entry("en:cherry", "cherry"),
      entry("en:onion", "onion", "ui"),
      entry("en:avocado", "avocado"),
      entry("en:red-bell-pepper", "red bell pepper"),
      entry("en:pepper", "pepper"),
      entry("en:guajillo-chili", "guajillo"),
      entry("en:chicken-thigh", "chicken thigh"),
    ]);
    seeded = await listSeededIngredientIds();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function mintOne(text: string) {
    const [resolved] = await resolveIngredients([text], { userId: actor.userId }, { ai: false });
    const page = await listIngredients(actor, { id: resolved!.ingredientId });

    return page.items[0]!;
  }

  it("files a mint under the seeded food its text ends with, and keeps it flagged", async () => {
    const ground = await mintOne("Ground cumin");

    expect(ground).toMatchObject({ flagged: true, parent: { id: seeded.get("en:cumin") } });
    expect(await mintOne("verse peterselie")).toMatchObject({
      flagged: true,
      parent: { id: seeded.get("en:parsley") },
    });
    expect(await mintOne("egg noodles, cooked")).toMatchObject({
      parent: { id: seeded.get("en:noodle") },
    });
  });

  it("takes the longest seeded spelling the text ends with", async () => {
    expect(await mintOne("smoked sweet paprika")).toMatchObject({
      parent: { id: seeded.get("en:sweet-paprika") },
    });
  });

  it("reads the text as rung 2 does, without the units map's phrases", async () => {
    expect(await mintOne("ground cumin to taste")).toMatchObject({
      parent: { id: seeded.get("en:cumin") },
    });
  });

  it("files nothing where the text ends in no seeded spelling, or in one a person minted", async () => {
    await resolveIngredients(["saffron"], { userId: actor.userId }, { ai: false });

    expect(await mintOne("dragon fruit")).toMatchObject({ flagged: true, parent: null });
    expect(await mintOne("ground saffron")).toMatchObject({ flagged: true, parent: null });
  });

  it("reads only the words before in, met or with, which may name the parent whole", async () => {
    expect(await mintOne("tonijnstukken in olijfolie")).toMatchObject({ parent: null });
    expect(await mintOne("sardines in water")).toMatchObject({
      parent: { id: seeded.get("en:sardine") },
    });
    expect(await mintOne("kip met rijst")).toMatchObject({
      parent: { id: seeded.get("en:chicken") },
    });
    // Each was the whole of the words read, so none is a guess to confirm.
    expect(await listIngredientSuggestions()).toHaveLength(0);
  });

  it("never files under a word of recipe language another language spells a food with", async () => {
    await applyIngredientSeed([entry("en:duck", "duck", "and"), entry("en:carrot", "carrots")]);
    seeded = await listSeededIngredientIds();

    expect(await mintOne("frozen peas and carrots")).toMatchObject({
      parent: { id: seeded.get("en:carrot") },
    });
    expect(await mintOne("this and that")).toMatchObject({ parent: null });
  });

  it("files a name under the singular of the plural its words end with", async () => {
    expect(await mintOne("dried tomatoes")).toMatchObject({
      flagged: true,
      parent: { id: seeded.get("en:tomato") },
    });
    expect(await mintOne("rode uien")).toMatchObject({ parent: { id: seeded.get("en:onion") } });
    expect(await mintOne("boneless chicken thighs")).toMatchObject({
      parent: { id: seeded.get("en:chicken-thigh") },
    });
    // The singular is the food its words end with: nothing to confirm.
    expect(await listIngredientSuggestions()).toHaveLength(0);
  });

  it("reads a word as written before a plural read as its singular", async () => {
    expect(await mintOne("dried guajillo peppers")).toMatchObject({
      parent: { id: seeded.get("en:guajillo-chili") },
    });
  });

  it("takes a plural alone as the food itself, and reads one only where the food is named", async () => {
    expect((await mintOne("tomatoes")).id).toBe(seeded.get("en:tomato"));
    expect((await mintOne("cherries")).id).toBe(seeded.get("en:cherry"));
    expect((await mintOne("avocado's")).id).toBe(seeded.get("en:avocado"));
    expect(await mintOne("tomatoes soup")).toMatchObject({ parent: null });
  });

  it("reads a spelling a seeded food gained after the seed as the food's", async () => {
    await getTestDb()
      .insert(ingredientAliases)
      .values({ text: "look", fold: "look", ingredientId: seeded.get("en:garlic")! });

    expect(await mintOne("verse look")).toMatchObject({
      parent: { id: seeded.get("en:garlic") },
    });
  });

  it("files a mint under a seeded food found inside its words, with a suggestion to confirm", async () => {
    const cloves = await mintOne("garlic cloves crushed");

    expect(cloves).toMatchObject({
      name: "garlic cloves",
      flagged: true,
      parent: { id: seeded.get("en:garlic") },
    });
    expect(await listIngredientSuggestions()).toMatchObject([
      {
        ingredientId: cloves.id,
        kind: "parent",
        target: { id: seeded.get("en:garlic") },
        source: "words",
        considered: [],
      },
    ]);
    // The one the text ends with is filed without a question.
    await mintOne("ground cumin");
    expect(await listIngredientSuggestions()).toHaveLength(1);
  });

  it("prefers the longest spelling, and of two as long the one the text ends with", async () => {
    expect(await mintOne("kale large stalks removed")).toMatchObject({
      parent: { id: seeded.get("en:kale") },
    });
    expect((await listSuggestions(actor)).map((it) => it.source)).toEqual(["words"]);
  });

  it("confirming keeps the parent as the person's choice, and clears the flag", async () => {
    const cloves = await mintOne("garlic cloves crushed");
    const [suggestion] = await listSuggestions(actor);

    await confirmSuggestion(actor, suggestion!.id);

    expect((await listIngredients(actor, { id: cloves.id })).items[0]).toMatchObject({
      flagged: false,
      parent: { id: seeded.get("en:garlic") },
    });
    expect(await listIngredientSuggestions()).toHaveLength(0);
  });

  it("dismissing takes the parent off again, since it was a guess", async () => {
    const cloves = await mintOne("garlic cloves crushed");
    const [suggestion] = await listSuggestions(actor);

    await dismissSuggestion(actor, suggestion!.id);

    expect((await listIngredients(actor, { id: cloves.id })).items[0]).toMatchObject({
      flagged: true,
      parent: null,
    });
    expect(await listIngredientSuggestions()).toHaveLength(0);
  });

  it("dismissing leaves a parent a person chose meanwhile", async () => {
    const cloves = await mintOne("garlic cloves crushed");
    const [suggestion] = await listSuggestions(actor);

    await setParent(actor, cloves.id, seeded.get("en:kale")!);
    // Choosing a parent settles the suggestion; dismissing a stale id changes nothing.
    await expect(dismissSuggestion(actor, suggestion!.id)).rejects.toMatchObject({
      refusal: "not-found",
    });
    expect((await listIngredients(actor, { id: cloves.id })).items[0]).toMatchObject({
      parent: { id: seeded.get("en:kale") },
    });
  });

  it("is a guess a person overrides: another parent clears the flag", async () => {
    const ground = await mintOne("ground cumin");

    await setParent(actor, ground.id, seeded.get("en:paprika")!);

    expect((await listIngredients(actor, { id: ground.id })).items[0]).toMatchObject({
      flagged: false,
      parent: { id: seeded.get("en:paprika") },
    });
  });
});
