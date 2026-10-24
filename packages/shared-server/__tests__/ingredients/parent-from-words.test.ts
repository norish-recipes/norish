// @vitest-environment node
/**
 * Rung 4's parent from words, against a real database: a mint stays flagged under a seeded spelling
 * its text ends with, or starts with before cuts and forms alone; one elsewhere gives none.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { listAIChanges } from "@norish/db/repositories/ingredient-ai-changes";
import {
  applyIngredientSeed,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
import { ingredientAliases } from "@norish/db/schema";
import { listIngredients, setParent } from "@norish/shared-server/ingredients/catalogue";
import { resolveIngredients } from "@norish/shared-server/ingredients/resolver";

import { getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { seedEntry, seedEntryIn } from "../helpers/seed-entries";

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
      seedEntry("en:cumin", "cumin", "komijn"),
      seedEntry("en:parsley", "parsley", "peterselie"),
      seedEntry("en:paprika", "paprika"),
      seedEntry("en:sweet-paprika", "sweet paprika"),
      seedEntry("en:noodle", "noodles"),
      seedEntry("en:garlic", "garlic", "knoflook"),
      seedEntry("en:kale", "kale"),
      seedEntry("en:olive-oil", "olive oil", "olijfolie"),
      seedEntry("en:sardine", "sardines"),
      seedEntry("en:chicken", "chicken", "kip"),
      seedEntry("en:rice", "rice", "rijst"),
      seedEntry("en:tomato", "tomato"),
      seedEntry("en:cherry", "cherry"),
      seedEntry("en:onion", "onion", "ui"),
      seedEntry("en:avocado", "avocado"),
      seedEntry("en:red-bell-pepper", "red bell pepper"),
      seedEntry("en:pepper", "pepper"),
      seedEntry("en:guajillo-chili", "guajillo"),
      seedEntry("en:chicken-thigh", "chicken thigh"),
    ]);
    seeded = await listSeededIngredientIds();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function mintOne(text: string) {
    const [resolved] = await resolveIngredients([text], { userId: actor.userId }, "upgrade");
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
    await resolveIngredients(["saffron"], { userId: actor.userId }, "upgrade");

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
    expect(await listAIChanges()).toHaveLength(0);
  });

  it("reads a name up to a note, so the parent before it is sure", async () => {
    await applyIngredientSeed([
      seedEntry("en:greek-yogurt", "greek yogurt"),
      seedEntry("en:tuna", "tuna", "tonijn"),
      seedEntry("en:olive", "olive", "olijven"),
    ]);
    seeded = await listSeededIngredientIds();

    for (const [text, offId] of [
      ["greek yogurt for topping", "en:greek-yogurt"],
      ["olijven naar keuze", "en:olive"],
      ["tonijn uit blik", "en:tuna"],
    ] as const) {
      expect(await mintOne(text)).toMatchObject({ parent: { id: seeded.get(offId) } });
    }
    expect(await listAIChanges()).toHaveLength(0);
  });

  it("files a parent the name starts with quietly where only cuts, forms and sizes follow", async () => {
    await applyIngredientSeed([
      seedEntry("en:mango", "mango"),
      seedEntry("en:chicken", "chicken", "kip"),
      seedEntry("en:onion", "onion"),
      seedEntry("en:chicken-fillet", "chicken fillet", "kipfilet"),
      seedEntry("en:chili-pepper", "chili pepper", "chili"),
      seedEntry("en:curry", "curry"),
      seedEntry("en:salami", "salami", "salam"),
    ]);
    seeded = await listSeededIngredientIds();

    for (const [text, offId] of [
      ["mango blokjes", "en:mango"],
      ["chicken strips", "en:chicken"],
      ["kipfilet blokjes", "en:chicken-fillet"],
      ["kip grote reepjes", "en:chicken"],
    ] as const) {
      expect(await mintOne(text)).toMatchObject({ parent: { id: seeded.get(offId) } });
    }
    expect(await listAIChanges()).toHaveLength(0);

    // A product named after a food is no form of it: no parent, for AI to file.
    for (const text of ["onion powder", "chili flakes", "curry leaves", "salam blaadjes"]) {
      expect(await mintOne(text)).toMatchObject({ flagged: true, parent: null });
    }
    expect(await listAIChanges()).toHaveLength(0);
  });

  it("never files under a word of recipe language another language spells a food with", async () => {
    await applyIngredientSeed([
      seedEntry("en:duck", "duck", "and"),
      seedEntry("en:carrot", "carrots"),
    ]);
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
    expect(await listAIChanges()).toHaveLength(0);
  });

  it("takes a plural alone as the food itself, and reads one only where the food is named", async () => {
    expect((await mintOne("tomatoes")).id).toBe(seeded.get("en:tomato"));
    expect((await mintOne("cherries")).id).toBe(seeded.get("en:cherry"));
    expect((await mintOne("avocado's")).id).toBe(seeded.get("en:avocado"));
    expect(await mintOne("tomatoes soup")).toMatchObject({ parent: null });
  });

  it("files under a seeded spelling only in a language Norish reads", async () => {
    await applyIngredientSeed([
      seedEntryIn("en:pear", ["pear", "en"], ["bün", "vo"]),
      seedEntryIn("en:cheese", ["cheese", "en"], ["kaas", "nl"]),
    ]);
    seeded = await listSeededIngredientIds();

    expect(await mintOne("burger buns")).toMatchObject({ parent: null });
    expect(await mintOne("belegen kaas")).toMatchObject({
      parent: { id: seeded.get("en:cheese") },
    });
  });

  it("reads a spelling a seeded food gained after the seed as the food's", async () => {
    await getTestDb()
      .insert(ingredientAliases)
      .values({ text: "look", fold: "look", ingredientId: seeded.get("en:garlic")! });

    expect(await mintOne("verse look")).toMatchObject({
      parent: { id: seeded.get("en:garlic") },
    });
  });

  it("files a mint under no seeded food found anywhere but the end or the start before forms", async () => {
    await applyIngredientSeed([
      seedEntry("en:nora-pepper", "nora"),
      seedEntry("en:tea", "tea", "te"),
      seedEntry("en:apple", "apple", "raw"),
      seedEntry("en:oil", "oil", "olie"),
      seedEntry("en:onion", "onion", "ui"),
    ]);
    seeded = await listSeededIngredientIds();

    for (const text of [
      "Nora reserve eten",
      "garlic cloves crushed",
      "kale large stalks removed",
      "raw king prawns",
    ]) {
      expect(await mintOne(text)).toMatchObject({ flagged: true, parent: null });
    }
    // The words read up to a note are the whole name, so its parent ends it, at any length.
    expect(await mintOne("olie om te bakken")).toMatchObject({
      parent: { id: seeded.get("en:oil") },
    });
    expect(await mintOne("rode ui")).toMatchObject({ parent: { id: seeded.get("en:onion") } });
    expect(await listAIChanges()).toHaveLength(0);
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
