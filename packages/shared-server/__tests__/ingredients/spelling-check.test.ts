// @vitest-environment node
/**
 * AI checks the spellings added to seeded foods (ticket 46) against a real database, once, at the
 * first start with AI on; the language model is mocked at `generateStructured`.
 */
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { withTransaction } from "@norish/db/drizzle";
import { addIngredientAliases } from "@norish/db/repositories/ingredient-aliases";
import { addToJunkPile, listJunkFolds } from "@norish/db/repositories/ingredient-junk-pile";
import {
  applyIngredientSeed,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
import { writeRecipeLineFoodsTx } from "@norish/db/repositories/ingredients";
import {
  groceries,
  ingredientAliases,
  ingredients,
  recipeIngredientFoods,
  serverConfig,
} from "@norish/db/schema";
import { decide, generateStructured } from "@norish/shared-server/ai/runtime/runtime";
import {
  isAIEnabled,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";
import {
  listAIChangesFor,
  mergeByAI,
  undoAIChange,
} from "@norish/shared-server/ingredients/ai-changes";
import { onIngredientsMinted } from "@norish/shared-server/ingredients/minted";
import { resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import { checkSpellingsOf } from "@norish/shared-server/ingredients/spelling-check";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import {
  createTestRecipe,
  getTestDb,
  insertTestRecipeLine,
  mintTestFood,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { seedEntry } from "../helpers/seed-entries";

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  decide: vi.fn(),
  generateStructured: vi.fn(),
}));
vi.mock("@norish/shared-server/config/server-config-loader", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isAIEnabled: vi.fn(),
  isDecisionUseEnabled: vi.fn(),
}));

type Kind = "this-food" | "not-a-food" | "other-food";

/** The language model's answer about the listed spellings, by text; one left out is not answered. */
function answers(verdicts: Record<string, Kind | [Kind, string]>) {
  vi.mocked(generateStructured).mockImplementationOnce((async ({
    sections,
  }: {
    sections: string[];
  }) => {
    const listed = sections
      .at(-1)!
      .split("\n")
      .filter((entry) => /^\d+\. /.test(entry));

    return {
      spellings: listed.flatMap((entry) => {
        const [number, text] = entry.split(". ");
        const verdict = verdicts[text!];

        if (!verdict) return [];
        const [kind, otherFood = null] = typeof verdict === "string" ? [verdict] : verdict;

        return [{ number: Number(number), kind, otherFood }];
      }),
    };
  }) as never);
}

describe("AI checks the spellings added to a seeded food", () => {
  const testBase = new RepositoryTestBase("test_spelling_check");

  let userId: string;
  let actor: CatalogueActor;
  let seeded: Map<string, string>;
  const minted: string[] = [];

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
    actor = { userId, householdUserIds: null, isServerAdmin: true };
    minted.length = 0;
    onIngredientsMinted(async (ids) => void minted.push(...ids));
    vi.mocked(generateStructured).mockReset();
    vi.mocked(decide).mockReset();
    vi.mocked(isAIEnabled).mockReset().mockResolvedValue(true);
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
    await getTestDb()
      .delete(serverConfig)
      .where(eq(serverConfig.key, ServerConfigKeys.INGREDIENT_SEED_STATE));
    await applyIngredientSeed([
      seedEntry("en:chicken-breast", "chicken breast", "chicken breasts"),
      seedEntry("en:chicken-thigh", "chicken thigh"),
      seedEntry("en:salt", "salt"),
      seedEntry("en:noodle", "noodle"),
    ]);
    seeded = await listSeededIngredientIds();
  });

  afterAll(async () => {
    onIngredientsMinted(undefined);
    await testBase.teardown();
  });

  /** Spellings added to a seeded food, as people and imports add them; by text. */
  async function added(offId: string, ...texts: string[]) {
    const rows = await addIngredientAliases({
      ingredientId: seeded.get(offId)!,
      aliases: texts.map((text) => ({ text, fold: ingredientAliasFold(text) })),
      ownerId: userId,
      locale: null,
    });

    return new Map(rows!.map((row) => [row.text, row.aliasId]));
  }

  async function line(name: string, aliasId: string) {
    const recipe = await createTestRecipe(userId);

    return await insertTestRecipeLine({ recipeId: recipe.id, name }, [aliasId]);
  }

  /** The foods a line names, by name, in order. */
  async function lineFoods(lineId: string) {
    const rows = await getTestDb()
      .select({ food: ingredients.name, spelling: ingredientAliases.text })
      .from(recipeIngredientFoods)
      .innerJoin(
        ingredientAliases,
        eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId)
      )
      .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
      .where(eq(recipeIngredientFoods.recipeIngredientId, lineId))
      .orderBy(asc(recipeIngredientFoods.position));

    return rows;
  }

  async function spellingsOf(ingredientId: string) {
    const rows = await getTestDb()
      .select({ text: ingredientAliases.text })
      .from(ingredientAliases)
      .where(eq(ingredientAliases.ingredientId, ingredientId));

    return rows.map((row) => row.text).sort();
  }

  /** The sections the last spelling check sent. */
  function askedSections() {
    const call = vi.mocked(generateStructured).mock.calls.at(-1)![0];

    expect(call.prompt).toBe("ingredient-spelling-check");

    return call.sections;
  }

  it("removes the spellings AI says are not a food, piles them, and reads their lines again", async () => {
    const chicken = seeded.get("en:chicken-breast")!;
    const spelled = await added("en:chicken-breast", "boneless", "lbs boneless", "kipfilet");
    const commaLine = await line("boneless, skinless chicken breasts", spelled.get("boneless")!);
    const bareLine = await line("boneless", spelled.get("boneless")!);
    const lbsLine = await line(
      "lbs boneless, skinless chicken breast (about 1 lb.)",
      spelled.get("lbs boneless")!
    );
    const kipLine = await line("kipfilet", spelled.get("kipfilet")!);

    answers({ boneless: "not-a-food", "lbs boneless": "not-a-food", kipfilet: "this-food" });

    const outcome = await checkSpellingsOf(chicken);

    expect(outcome).toMatchObject({ outcome: "checked", kept: ["kipfilet"], moved: [] });
    expect(outcome.outcome === "checked" && outcome.removed.sort()).toEqual([
      "boneless",
      "lbs boneless",
    ]);
    // Only the spellings the seed did not give, never the seed's own.
    const [name, listed] = askedSections();

    expect(name).toBe("Name: chicken breast");
    expect(
      listed!
        .split("\n")
        .filter((entry) => /^\d+\. /.test(entry))
        .map((entry) => entry.replace(/^\d+\. /, ""))
        .sort()
    ).toEqual(["boneless", "kipfilet", "lbs boneless"]);
    expect(await spellingsOf(chicken)).toEqual(["chicken breast", "chicken breasts", "kipfilet"]);
    expect(await listJunkFolds()).toEqual(expect.arrayContaining(["boneless", "lbs boneless"]));
    // The rest of the line names a food; a line that is all junk names none.
    const [commaFood] = await lineFoods(commaLine.id);

    // One mint for both lines, its name from whichever spelling went first; AI's pass follows it.
    expect(commaFood?.food).toMatch(/^skinless chicken breasts?$/);
    expect(await lineFoods(lbsLine.id)).toEqual([commaFood]);
    expect(minted).toContain(
      (
        await getTestDb()
          .select({ id: ingredients.id })
          .from(ingredients)
          .where(eq(ingredients.name, commaFood!.food))
      )[0]!.id
    );
    expect(await lineFoods(bareLine.id)).toEqual([]);
    expect(await lineFoods(kipLine.id)).toEqual([{ food: "chicken breast", spelling: "kipfilet" }]);

    const changes = await listAIChangesFor(actor);

    expect(changes.map((change) => [change.kind, change.ingredient?.name, change.from])).toEqual(
      expect.arrayContaining([
        ["spelling", "chicken breast", "boneless"],
        ["spelling", "chicken breast", "lbs boneless"],
      ])
    );

    // Undo puts the spelling and its lines back, and takes it off the pile.
    await undoAIChange(actor, changes.find((change) => change.from === "boneless")!.id);

    expect(await spellingsOf(chicken)).toContain("boneless");
    expect(await lineFoods(commaLine.id)).toEqual([
      { food: "chicken breast", spelling: "boneless" },
    ]);
    expect(await lineFoods(bareLine.id)).toEqual([
      { food: "chicken breast", spelling: "boneless" },
    ]);
    expect(await listJunkFolds()).not.toContain("boneless");
    expect(await listJunkFolds()).toContain("lbs boneless");

    // An undone removal is never made again, and the check says so.
    answers({ boneless: "not-a-food" });
    await expect(checkSpellingsOf(chicken)).resolves.toMatchObject({
      removed: [],
      unchanged: [{ spelling: "boneless", because: "undone" }],
    });
    expect(await spellingsOf(chicken)).toContain("boneless");
  });

  it("takes a fold the seed piled off the pile on Undo, so the next line finds the spelling", async () => {
    const chicken = seeded.get("en:chicken-breast")!;
    const spelled = await added("en:chicken-breast", "boneless");

    await withTransaction((tx) => addToJunkPile(tx, ["boneless"], { reason: "seed" }));
    answers({ boneless: "not-a-food" });
    await checkSpellingsOf(chicken);
    const [change] = await listAIChangesFor(actor);

    await undoAIChange(actor, change!.id);

    expect(await spellingsOf(chicken)).toContain("boneless");
    expect(await listJunkFolds()).not.toContain("boneless");
    const [found] = await resolveIngredients(["boneless"], { userId });

    expect(found?.aliasId).toBe(spelled.get("boneless"));
  });

  it("keeps a typed grocery whose text is all junk, pointing at no food", async () => {
    const chicken = seeded.get("en:chicken-breast")!;
    const spelled = await added("en:chicken-breast", "boneless");

    await getTestDb()
      .insert(groceries)
      .values({
        userId,
        name: "boneless",
        ingredientAliasId: spelled.get("boneless")!,
        ingredientId: chicken,
      });
    answers({ boneless: "not-a-food" });
    await checkSpellingsOf(chicken);

    expect(
      await getTestDb()
        .select({
          name: groceries.name,
          aliasId: groceries.ingredientAliasId,
          ingredientId: groceries.ingredientId,
        })
        .from(groceries)
    ).toEqual([{ name: "boneless", aliasId: null, ingredientId: null }]);
  });

  it("moves a spelling AI says names another food there, with its rows", async () => {
    const breast = seeded.get("en:chicken-breast")!;
    const thigh = seeded.get("en:chicken-thigh")!;
    const spelled = await added("en:chicken-breast", "kippendijen");
    const dijLine = await line("500 g kippendijen", spelled.get("kippendijen")!);

    await getTestDb()
      .insert(groceries)
      .values({
        userId,
        name: "kippendijen",
        ingredientAliasId: spelled.get("kippendijen")!,
        ingredientId: breast,
      });
    answers({ kippendijen: ["other-food", "chicken thigh"] });

    await expect(checkSpellingsOf(breast)).resolves.toMatchObject({
      outcome: "checked",
      moved: [{ spelling: "kippendijen", to: "chicken thigh" }],
    });
    expect(await spellingsOf(thigh)).toEqual(["chicken thigh", "kippendijen"]);
    expect(await lineFoods(dijLine.id)).toEqual([
      { food: "chicken thigh", spelling: "kippendijen" },
    ]);
    const [grocery] = await getTestDb()
      .select({ ingredientId: groceries.ingredientId })
      .from(groceries);

    expect(grocery?.ingredientId).toBe(thigh);
    expect(await listJunkFolds()).not.toContain("kippendijen");

    const [change] = await listAIChangesFor(actor);

    expect(change).toMatchObject({ kind: "spelling", from: "kippendijen" });
    expect(change?.target?.name).toBe("chicken thigh");
    await undoAIChange(actor, change!.id);
    expect(await spellingsOf(breast)).toContain("kippendijen");
    expect(await lineFoods(dijLine.id)).toEqual([
      { food: "chicken breast", spelling: "kippendijen" },
    ]);
  });

  it("removes a spelling of another food nothing finds, minting where nothing knows its lines", async () => {
    const salt = seeded.get("en:salt")!;
    const spelled = await added("en:salt", "zeezoutvlokken");
    const flakesLine = await line("zeezoutvlokken", spelled.get("zeezoutvlokken")!);

    answers({ zeezoutvlokken: ["other-food", "sea salt flakes"] });

    await expect(checkSpellingsOf(salt)).resolves.toMatchObject({
      removed: ["zeezoutvlokken"],
    });
    expect(await spellingsOf(salt)).toEqual(["salt"]);
    expect(await listJunkFolds()).not.toContain("zeezoutvlokken");
    expect(await lineFoods(flakesLine.id)).toEqual([
      { food: "zeezoutvlokken", spelling: "zeezoutvlokken" },
    ]);
  });

  it("on Undo, points back only the rows still naming what the removal left them", async () => {
    const chicken = seeded.get("en:chicken-breast")!;
    const thigh = seeded.get("en:chicken-thigh")!;
    const [thighSpelling] = await getTestDb()
      .select({ id: ingredientAliases.id })
      .from(ingredientAliases)
      .where(eq(ingredientAliases.ingredientId, thigh));
    const boneless = (await added("en:chicken-breast", "boneless")).get("boneless")!;
    const untouched = await line("boneless, skinless chicken breasts", boneless);
    const edited = await line("boneless", boneless);
    const [kept, repointed] = await getTestDb()
      .insert(groceries)
      .values(
        ["kept", "repointed"].map(() => ({
          userId,
          name: "boneless",
          ingredientAliasId: boneless,
          ingredientId: chicken,
        }))
      )
      .returning({ id: groceries.id });

    answers({ boneless: "not-a-food" });
    await checkSpellingsOf(chicken);
    // Edits made after the removal: a person's choice, which Undo leaves alone.
    await getTestDb().transaction((tx) =>
      writeRecipeLineFoodsTx(tx, [{ id: edited.id, aliasIds: [thighSpelling!.id] }])
    );
    await getTestDb()
      .update(groceries)
      .set({ ingredientAliasId: thighSpelling!.id, ingredientId: thigh })
      .where(eq(groceries.id, repointed!.id));
    const [change] = await listAIChangesFor(actor);

    await undoAIChange(actor, change!.id);

    expect(await lineFoods(untouched.id)).toEqual([
      { food: "chicken breast", spelling: "boneless" },
    ]);
    expect(await lineFoods(edited.id)).toEqual([
      { food: "chicken thigh", spelling: "chicken thigh" },
    ]);
    const pointed = new Map(
      (
        await getTestDb()
          .select({ id: groceries.id, ingredientId: groceries.ingredientId })
          .from(groceries)
      ).map((row) => [row.id, row.ingredientId])
    );

    expect(pointed.get(kept!.id)).toBe(chicken);
    expect(pointed.get(repointed!.id)).toBe(thigh);
  });

  it("on Undo, merges back the food its lines minted from the text", async () => {
    const salt = seeded.get("en:salt")!;
    const spelled = await added("en:salt", "zeezoutvlokken");
    const flakesLine = await line("zeezoutvlokken", spelled.get("zeezoutvlokken")!);
    const flakes = () =>
      getTestDb()
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.name, "zeezoutvlokken"));

    answers({ zeezoutvlokken: ["other-food", "sea salt flakes"] });
    await checkSpellingsOf(salt);
    await expect(flakes()).resolves.toHaveLength(1);
    const [change] = await listAIChangesFor(actor);

    await undoAIChange(actor, change!.id);

    await expect(flakes()).resolves.toEqual([]);
    expect(await spellingsOf(salt)).toEqual(["salt", "zeezoutvlokken"]);
    expect(await lineFoods(flakesLine.id)).toEqual([{ food: "salt", spelling: "zeezoutvlokken" }]);
  });

  it("refuses the Undo where a person chose the food its lines minted from the text", async () => {
    const salt = seeded.get("en:salt")!;
    const spelled = await added("en:salt", "zeezoutvlokken");

    await line("zeezoutvlokken", spelled.get("zeezoutvlokken")!);
    answers({ zeezoutvlokken: ["other-food", "sea salt flakes"] });
    await checkSpellingsOf(salt);
    await getTestDb()
      .update(ingredients)
      .set({ nameChosen: true })
      .where(eq(ingredients.name, "zeezoutvlokken"));
    const [change] = await listAIChangesFor(actor);

    await expect(undoAIChange(actor, change!.id)).rejects.toThrow(/spelling-taken/);
  });

  it("shows AI a recipe line written with each spelling, so a fragment is read in its line", async () => {
    const chicken = seeded.get("en:chicken-breast")!;
    const spelled = await added("en:chicken-breast", "skinless");

    await added("en:chicken-breast", "kipfilet");
    await line("chicken breasts, skinless", spelled.get("skinless")!);
    answers({});
    await checkSpellingsOf(chicken);

    expect(askedSections().at(-1)).toBe(
      ["Spellings:", "1. skinless", "   Line: chicken breasts, skinless", "2. kipfilet"].join("\n")
    );
  });

  it("leaves the spellings a merge by AI moved onto the food, which AI already judged", async () => {
    const chicken = seeded.get("en:chicken-breast")!;
    const kip = await mintTestFood("kipfilet");

    await line("kipfilet", kip.aliasId);
    await expect(mergeByAI(kip.ingredientId, chicken, false)).resolves.toBe("applied");

    await expect(checkSpellingsOf(chicken)).resolves.toEqual({
      outcome: "skipped",
      reason: "none",
    });
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("checks the other spellings a merge by AI carried along, which AI never read", async () => {
    const noodle = seeded.get("en:noodle")!;
    const verstegen = await mintTestFood("Verstegen noedels");
    const text = "Verstegen World Spice Meals Noedels";
    const [mix] = (await addIngredientAliases({
      ingredientId: verstegen.ingredientId,
      aliases: [{ text, fold: ingredientAliasFold(text) }],
      ownerId: userId,
      locale: null,
    }))!;

    await line(text, mix!.aliasId);
    await expect(mergeByAI(verstegen.ingredientId, noodle, false)).resolves.toBe("applied");
    answers({ [text]: ["other-food", "mixed spices"] });

    await expect(checkSpellingsOf(noodle)).resolves.toMatchObject({
      outcome: "checked",
      removed: [text],
    });
    expect(askedSections().at(-1)).toBe(
      ["Spellings:", `1. ${text}`, `   Line: ${text}`].join("\n")
    );
    expect(await spellingsOf(noodle)).toEqual(["Verstegen noedels", "noodle"]);
  });
});
