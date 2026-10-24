// @vitest-environment node
/**
 * The catalogue as the Ingredients page edits it, against a real database:
 * looking after a Flagged Ingredient clears its flag, a household's own word
 * joins the food it names, a delete leaves the lines and groceries behind a
 * food with their text and no food, and the nightly sweep deletes own foods
 * nothing has named for 90 days. The edit policy's matrix is pinned at the
 * procedures; here the editor is the Ingredient's owner.
 */
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { findIngredientByAliasId } from "@norish/db/repositories/ingredient-aliases";
import { listJunkFolds } from "@norish/db/repositories/ingredient-junk-pile";
import { writeGroceryParts } from "@norish/db/repositories/ingredient-relocation";
import {
  groceries,
  ingredientAliases,
  ingredients,
  pantryIngredients,
  recipeIngredientFoods,
  recipeIngredients,
  recurringGroceries,
} from "@norish/db/schema";
import {
  addAlias,
  CatalogueEditError,
  deleteIngredient,
  listIngredients,
  listSpellings,
  markDistinct,
  mergeIngredients,
  moveAlias,
  removeAlias,
  renameIngredient,
  saveDraft,
  setParent,
  sweepUnusedIngredients,
} from "@norish/shared-server/ingredients/catalogue";
import { publishIngredientChangesTo } from "@norish/shared-server/ingredients/changes";
import { resolveGroceryNames } from "@norish/shared-server/ingredients/groceries";
import { resolveIngredients } from "@norish/shared-server/ingredients/resolver";

import {
  createTestRecipe,
  createTestUser,
  getRecipeIngredients,
  getSpellingTexts,
  getTestDb,
  insertTestRecipeLine,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

describe("the ingredient catalogue", () => {
  const testBase = new RepositoryTestBase("test_ingredient_catalogue");

  let actor: CatalogueActor;
  /** What the edits announced, one list of Ingredient ids per announcement. */
  let announced: string[][];
  let restorePublisher: () => void;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    actor = { userId: user.id, householdUserIds: null, isServerAdmin: false };
    announced = [];
    restorePublisher = publishIngredientChangesTo({
      changed: async (ids) => {
        announced.push([...ids]);
      },
    });
  });

  afterEach(() => restorePublisher());

  afterAll(async () => {
    await testBase.teardown();
  });

  async function mint(text: string) {
    const [resolved] = await resolveIngredients([text], { userId: actor.userId });

    return resolved!;
  }

  /** Flag a food as AI unsure of it: a mint is unflagged. */
  async function flag(ingredientId: string) {
    await getTestDb()
      .update(ingredients)
      .set({ flagged: true, flagReason: "ai-unsure" })
      .where(eq(ingredients.id, ingredientId));
  }

  /** A recipe line, a Grocery, a recurring grocery and a Pantry Ingredient, each naming `food` as `text`. */
  async function nameEverywhere(food: { aliasId: string; ingredientId: string }, text: string) {
    const db = getTestDb();
    const recipe = await createTestRecipe(actor.userId);
    const pointers = { ingredientAliasId: food.aliasId, ingredientId: food.ingredientId };
    const line = await insertTestRecipeLine({ recipeId: recipe.id, name: text }, [food.aliasId]);
    const [grocery] = await db
      .insert(groceries)
      .values({ userId: actor.userId, name: text, ...pointers })
      .returning({ id: groceries.id });
    const [recurring] = await db
      .insert(recurringGroceries)
      .values({
        userId: actor.userId,
        name: text,
        ...pointers,
        recurrenceRule: "week",
        nextPlannedFor: "2027-01-01",
      })
      .returning({ id: recurringGroceries.id });

    await db.insert(pantryIngredients).values({ userId: actor.userId, ...pointers });

    return { recipe: recipe.id, line: line.id, grocery: grocery!.id, recurring: recurring!.id };
  }

  /** What the rows `nameEverywhere` wrote point at now. */
  async function namedBy(rows: { line: string; grocery: string; recurring: string }) {
    const db = getTestDb();
    const [line] = await db
      .select({ name: recipeIngredients.name, aliasId: recipeIngredientFoods.ingredientAliasId })
      .from(recipeIngredients)
      .leftJoin(
        recipeIngredientFoods,
        eq(recipeIngredientFoods.recipeIngredientId, recipeIngredients.id)
      )
      .where(eq(recipeIngredients.id, rows.line));
    const pointersOf = async (table: typeof groceries | typeof recurringGroceries, id: string) =>
      (
        await db
          .select({
            name: table.name,
            aliasId: table.ingredientAliasId,
            ingredientId: table.ingredientId,
          })
          .from(table)
          .where(eq(table.id, id))
      )[0];
    const grocery = await pointersOf(groceries, rows.grocery);
    const recurring = await pointersOf(recurringGroceries, rows.recurring);
    const pantry = await db
      .select({ aliasId: pantryIngredients.ingredientAliasId })
      .from(pantryIngredients)
      .where(eq(pantryIngredients.userId, actor.userId));

    return { line, grocery, recurring, pantry: pantry.map((row) => row.aliasId) };
  }

  function refusal(promise: Promise<unknown>) {
    return promise.then(
      () => null,
      (error: unknown) => (error instanceof CatalogueEditError ? error.refusal : error)
    );
  }

  it("announces what a merge, an alias move and a new parent changed, and nothing refused", async () => {
    const onion = await mint("onion");
    const ui = await mint("ui");
    const allium = await mint("allium");
    const red = await mint("red onion");

    await mergeIngredients(actor, ui.ingredientId, onion.ingredientId);
    await addAlias(actor, onion.ingredientId, "ajuin");
    const [ajuin] = await resolveIngredients(["ajuin"], { userId: actor.userId });
    const moved = await moveAlias(actor, ajuin!.aliasId, null);

    await setParent(actor, red.ingredientId, allium.ingredientId);
    await refusal(setParent(actor, allium.ingredientId, allium.ingredientId));

    expect(announced).toEqual([
      [ui.ingredientId, onion.ingredientId],
      [onion.ingredientId],
      [onion.ingredientId, moved.ingredientId],
      [red.ingredientId, allium.ingredientId],
    ]);
  });

  it("saves a draft as one edit: the name, the parent and the spellings", async () => {
    const onion = await mint("onion");
    const allium = await mint("allium");

    await addAlias(actor, onion.ingredientId, "ajuin");
    const [ajuin] = await resolveIngredients(["ajuin"], { userId: actor.userId });

    announced = [];
    await saveDraft(actor, onion.ingredientId, {
      name: "Yellow onion",
      parentId: allium.ingredientId,
      add: ["ui"],
      remove: [ajuin!.aliasId],
    });

    const [saved] = (await listIngredients(actor, { id: onion.ingredientId })).items;

    expect(saved).toMatchObject({ name: "Yellow onion", parent: { id: allium.ingredientId } });
    expect(saved!.aliases.map((alias) => alias.text).sort()).toEqual([
      "Yellow onion",
      "onion",
      "ui",
    ]);
    expect(announced).toEqual([[onion.ingredientId, allium.ingredientId]]);
  });

  it("changes nothing when any part of a draft is refused", async () => {
    const onion = await mint("onion");
    const allium = await mint("allium");
    const garlic = await mint("garlic");

    // The last spelling added is one garlic already holds.
    announced = [];
    await expect(
      refusal(
        saveDraft(actor, onion.ingredientId, {
          name: "Yellow onion",
          parentId: allium.ingredientId,
          add: ["ui", "garlic"],
          remove: [],
        })
      )
    ).resolves.toBe("spelling-taken");

    const [kept] = (await listIngredients(actor, { id: onion.ingredientId })).items;

    expect(kept).toMatchObject({ name: "onion", parent: null });
    expect(kept!.aliases.map((alias) => alias.text)).toEqual(["onion"]);
    await expect(findIngredientByAliasId(garlic.aliasId)).resolves.toMatchObject({
      name: "garlic",
    });
    expect(announced).toEqual([]);
  });

  it("refuses a draft that removes another food's spelling", async () => {
    const onion = await mint("onion");
    const garlic = await mint("garlic");

    await addAlias(actor, garlic.ingredientId, "knoflook");
    const [knoflook] = await resolveIngredients(["knoflook"], { userId: actor.userId });

    await expect(
      refusal(saveDraft(actor, onion.ingredientId, { add: [], remove: [knoflook!.aliasId] }))
    ).resolves.toBe("not-found");
  });

  it("puts a spelling removed as not a food on the junk pile, and the spelling added by hand takes it off", async () => {
    const chicken = await mint("chicken breast");

    await addAlias(actor, chicken.ingredientId, "boneless");
    await addAlias(actor, chicken.ingredientId, "kipfilet");
    const [boneless, kipfilet] = await resolveIngredients(["boneless", "kipfilet"], {
      userId: actor.userId,
    });

    await saveDraft(actor, chicken.ingredientId, {
      add: [],
      remove: [boneless!.aliasId, kipfilet!.aliasId],
      junk: [boneless!.aliasId],
    });
    await expect(listJunkFolds()).resolves.toEqual(["boneless"]);
    await expect(resolveIngredients(["boneless"], { userId: actor.userId })).resolves.toEqual([
      null,
    ]);

    // Another food may say it: "boneless" names that food from now on.
    const other = await mint("chicken thigh");

    await saveDraft(actor, other.ingredientId, { add: ["boneless"], remove: [], junk: [] });
    await expect(listJunkFolds()).resolves.toEqual([]);
    await expect(resolveIngredients(["boneless"], { userId: actor.userId })).resolves.toEqual([
      expect.objectContaining({ ingredientId: other.ingredientId }),
    ]);
  });

  it("clears the flag of an Ingredient a person renames", async () => {
    const onion = await mint("onion");

    await renameIngredient(actor, onion.ingredientId, "Onion");

    await expect(findIngredientByAliasId(onion.aliasId)).resolves.toMatchObject({
      name: "Onion",
      flagged: false,
    });
  });

  it("clears the flag of an Ingredient marked distinct, and leaves its name", async () => {
    const powder = await mint("onion powder");

    await markDistinct(actor, powder.ingredientId);

    await expect(findIngredientByAliasId(powder.aliasId)).resolves.toMatchObject({
      name: "onion powder",
      flagged: false,
    });
  });

  it("makes a new name one of the Ingredient's spellings", async () => {
    const onion = await mint("onion");

    await renameIngredient(actor, onion.ingredientId, "Yellow onion");

    const [again] = await resolveIngredients(["yellow onion"], { userId: actor.userId });

    expect(again!.ingredientId).toBe(onion.ingredientId);
  });

  it("deletes an Ingredient nothing uses, its spellings with it", async () => {
    const saffron = await mint("saffron");

    await addAlias(actor, saffron.ingredientId, "zafraan");
    await deleteIngredient(actor, saffron.ingredientId);

    await expect(findIngredientByAliasId(saffron.aliasId)).resolves.toBeNull();

    const [again] = await resolveIngredients(["zafraan"], { userId: actor.userId });

    // Minted afresh: the spelling went with the food.
    expect(again!.ingredientId).not.toBe(saffron.ingredientId);
    await expect(refusal(deleteIngredient(actor, saffron.ingredientId))).resolves.toBe("not-found");
  });

  it("deletes an Ingredient something uses: its lines and groceries keep their text and name no food, and it leaves the Pantry", async () => {
    const roller = await mint("deegroller");
    const rows = await nameEverywhere(roller, "1 deegroller");

    await deleteIngredient(actor, roller.ingredientId);

    await expect(findIngredientByAliasId(roller.aliasId)).resolves.toBeNull();
    await expect(namedBy(rows)).resolves.toEqual({
      line: { name: "1 deegroller", aliasId: null },
      grocery: { name: "1 deegroller", aliasId: null, ingredientId: null },
      recurring: { name: "1 deegroller", aliasId: null, ingredientId: null },
      pantry: [],
    });
  });

  it("deletes a mix: each row it named is resolved again from its own text, minting nothing", async () => {
    const db = getTestDb();
    const zout = await mint("zout");
    const peper = await mint("peper");

    await addAlias(actor, zout.ingredientId, "salt");
    await addAlias(actor, peper.ingredientId, "pepper");
    const mix = await mint("kruidenmix");

    await addAlias(actor, mix.ingredientId, "zout en peper");
    await addAlias(actor, mix.ingredientId, "salt and pepper");
    const [dutch, english] = await resolveIngredients(["zout en peper", "salt and pepper"], {
      userId: actor.userId,
    });
    const rows = await nameEverywhere(dutch!, "zout en peper");
    const lineOf = async (name: string, aliasId: string) =>
      (await insertTestRecipeLine({ recipeId: rows.recipe, name }, [aliasId])).id;
    const lines = {
      english: await lineOf("salt and pepper", english!.aliasId),
      mix: await lineOf("1 tl kruidenmix", mix.aliasId),
      // A line a person pointed at the mix, whose text another food knows whole.
      zout: await lineOf("zout", mix.aliasId),
    };
    const foodsOf = async (lineId: string) =>
      (
        await db
          .select({ ingredientId: ingredientAliases.ingredientId })
          .from(recipeIngredientFoods)
          .innerJoin(
            ingredientAliases,
            eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId)
          )
          .where(eq(recipeIngredientFoods.recipeIngredientId, lineId))
          .orderBy(recipeIngredientFoods.position)
      ).map((row) => row.ingredientId);
    const listed = async (table: typeof groceries | typeof recurringGroceries) =>
      await db
        .select({ name: table.name, ingredientId: table.ingredientId })
        .from(table)
        .where(eq(table.userId, actor.userId))
        .orderBy(table.name);
    const foods = await db.select({ id: ingredients.id }).from(ingredients);

    await deleteIngredient(actor, mix.ingredientId);

    const both = [zout.ingredientId, peper.ingredientId];

    await expect(foodsOf(rows.line)).resolves.toEqual(both);
    await expect(foodsOf(lines.english)).resolves.toEqual(both);
    await expect(foodsOf(lines.zout)).resolves.toEqual([zout.ingredientId]);
    await expect(foodsOf(lines.mix)).resolves.toEqual([]);
    // A Grocery names one food, so "zout en peper" is one per food, as typed.
    for (const table of [groceries, recurringGroceries]) {
      await expect(listed(table)).resolves.toEqual([
        { name: "peper", ingredientId: peper.ingredientId },
        { name: "zout", ingredientId: zout.ingredientId },
      ]);
    }
    await expect(namedBy(rows)).resolves.toMatchObject({ pantry: [] });
    await expect(db.select({ id: ingredients.id }).from(ingredients)).resolves.toHaveLength(
      foods.length - 1
    );
  });

  it("joins no slip when it resolves a deleted food's rows again", async () => {
    const parmezaan = await mint("parmezaan");
    const typo = await mint("parmezan kaas");
    const rows = await nameEverywhere(typo, "parmezan");

    await deleteIngredient(actor, typo.ingredientId);

    await expect(namedBy(rows)).resolves.toMatchObject({
      line: { aliasId: null },
      grocery: { aliasId: null, ingredientId: null },
    });
    await expect(getSpellingTexts(parmezaan.ingredientId)).resolves.toEqual(["parmezaan"]);
    // An import would take it as the slip it is.
    await expect(mint("parmezan")).resolves.toMatchObject({
      ingredientId: parmezaan.ingredientId,
    });
  });

  it("leaves a grocery renamed after its text was read for a delete", async () => {
    const db = getTestDb();
    const zout = await mint("zout");
    const [grocery] = await db
      .insert(groceries)
      .values({ userId: actor.userId, name: "zout en peper" })
      .returning({ id: groceries.id });
    const parts = [{ name: "zout", aliasId: zout.aliasId, ingredientId: zout.ingredientId }];

    await db.update(groceries).set({ name: "suiker" }).where(eq(groceries.id, grocery!.id));
    await db.transaction((tx) =>
      writeGroceryParts(tx, "groceries", [{ id: grocery!.id, name: "zout en peper", parts }])
    );

    await expect(
      db.select({ name: groceries.name, ingredientId: groceries.ingredientId }).from(groceries)
    ).resolves.toEqual([{ name: "suiker", ingredientId: null }]);
  });

  it("refuses a name another Ingredient goes by, in any case", async () => {
    await mint("garlic");
    const leek = await mint("leek");

    await expect(refusal(renameIngredient(actor, leek.ingredientId, "Garlic"))).resolves.toBe(
      "name-taken"
    );
  });

  it("undoes a rename whose new spelling cannot be written, the old name kept", async () => {
    const leek = await mint("leek");
    const db = getTestDb();

    await flag(leek.ingredientId);
    // Stands in for any failure after the rename's first write.
    await db.execute(sql`
      create or replace function refuse_alias() returns trigger language plpgsql as
        $$ begin raise exception 'alias refused'; end $$`);
    await db.execute(sql`
      create trigger refuse_alias before insert on ingredient_aliases
        for each row execute function refuse_alias()`);
    try {
      await expect(renameIngredient(actor, leek.ingredientId, "Winter leek")).rejects.toThrow();
    } finally {
      await db.execute(sql`drop trigger refuse_alias on ingredient_aliases`);
      await db.execute(sql`drop function refuse_alias()`);
    }

    await expect(findIngredientByAliasId(leek.aliasId)).resolves.toMatchObject({
      name: "leek",
      flagged: true,
    });
  });

  it("files a household's own word under the food it names", async () => {
    const onion = await mint("onion");

    await addAlias(actor, onion.ingredientId, "Ajuin");

    const [typed] = await resolveGroceryNames([{ name: "ajuin" }], { userId: actor.userId });

    expect(typed?.ingredientId).toBe(onion.ingredientId);
  });

  it("stores a spelling a person types clean, as a recipe text is read, single brackets kept", async () => {
    const gyoza = await mint("gyoza");

    await addAlias(actor, gyoza.ingredientId, "Gyoza vellen ((diepvries))");
    await addAlias(actor, gyoza.ingredientId, "gyoza (vers) )");
    await renameIngredient(actor, gyoza.ingredientId, "Japanse gyoza ((vers))");

    await expect(getSpellingTexts(gyoza.ingredientId)).resolves.toEqual([
      "Gyoza vellen",
      "Japanse gyoza",
      "gyoza",
      "gyoza (vers)",
    ]);
    await expect(refusal(addAlias(actor, gyoza.ingredientId, "(($0.02))"))).resolves.toBe("empty");
    expect((await mint("gyoza vellen ((diepvries))")).ingredientId).toBe(gyoza.ingredientId);
  });

  it("refuses a spelling another food already holds", async () => {
    const onion = await mint("onion");
    await mint("garlic");

    await expect(refusal(addAlias(actor, onion.ingredientId, "Garlic!"))).resolves.toBe(
      "spelling-taken"
    );
  });

  /** Spellings added to a food one after another, so each is younger than the last. */
  async function spell(ingredientId: string, texts: string[]) {
    for (const text of texts) await addAlias(actor, ingredientId, text);

    return await resolveIngredients(texts, { userId: actor.userId });
  }

  it("removes a spelling something uses: what wrote it keeps its text and its food, under the spelling that is the food's name", async () => {
    const dough = await mint("dough");
    const [, roller] = await spell(dough.ingredientId, ["deeg", "deegroller"]);
    const rows = await nameEverywhere(roller!, "deegroller");

    await removeAlias(actor, roller!.aliasId);

    const named = { aliasId: dough.aliasId, ingredientId: dough.ingredientId };

    await expect(namedBy(rows)).resolves.toEqual({
      line: { name: "deegroller", aliasId: dough.aliasId },
      grocery: { name: "deegroller", ...named },
      recurring: { name: "deegroller", ...named },
      pantry: [dough.aliasId],
    });
    await expect(getSpellingTexts(dough.ingredientId)).resolves.toEqual(["deeg", "dough"]);
  });

  it("moves what wrote a spelling with it: a line, a Grocery, a recurring grocery and a Pantry Ingredient name the food it moves to", async () => {
    const onion = await mint("onion");
    const [ajuin] = await spell(onion.ingredientId, ["ajuin"]);
    const rows = await nameEverywhere(ajuin!, "ajuin");
    const moved = await moveAlias(actor, ajuin!.aliasId, null);
    const named = { aliasId: ajuin!.aliasId, ingredientId: moved.ingredientId };

    await expect(namedBy(rows)).resolves.toEqual({
      line: { name: "ajuin", aliasId: ajuin!.aliasId },
      grocery: { name: "ajuin", ...named },
      recurring: { name: "ajuin", ...named },
      pantry: [ajuin!.aliasId],
    });
    await expect(getRecipeIngredients(rows.recipe)).resolves.toMatchObject([
      { name: "ajuin", ingredientId: moved.ingredientId },
    ]);
  });

  it("moves what wrote a removed spelling to the food's oldest one, where the name's own is the one removed", async () => {
    const dough = await mint("dough");
    const [deeg] = await spell(dough.ingredientId, ["deeg", "pâte"]);
    const rows = await nameEverywhere(dough, "dough");

    await removeAlias(actor, dough.aliasId);

    const named = { aliasId: deeg!.aliasId, ingredientId: dough.ingredientId };

    await expect(namedBy(rows)).resolves.toEqual({
      line: { name: "dough", aliasId: deeg!.aliasId },
      grocery: { name: "dough", ...named },
      recurring: { name: "dough", ...named },
      pantry: [deeg!.aliasId],
    });
  });

  it("says why a food is flagged, and sends the viewer's spellings with the rest on request", async () => {
    const cream = await mint("cream");

    await flag(cream.ingredientId);
    await addAlias(actor, cream.ingredientId, "room");

    const page = await listIngredients(actor, { search: "cream", locale: "nl" });

    expect(page.items[0]).toMatchObject({
      flagged: true,
      flagReason: "ai-unsure",
      hiddenSpellings: 0,
    });
    expect(page.items[0]!.aliases.map((alias) => alias.text)).toEqual(["cream", "room"]);
    expect((await listSpellings(actor, cream.ingredientId)).map((alias) => alias.text)).toEqual([
      "cream",
      "room",
    ]);

    await markDistinct(actor, cream.ingredientId);
    expect((await listIngredients(actor, { search: "cream" })).items[0]).toMatchObject({
      flagged: false,
      flagReason: null,
    });
  });

  it("never removes an Ingredient's last spelling", async () => {
    const saffron = await mint("saffron");

    await expect(refusal(removeAlias(actor, saffron.aliasId))).resolves.toBe("last-alias");
  });

  it("finds an Ingredient by any of its spellings, folded, and lists the flagged ones apart", async () => {
    const creme = await mint("crème fraîche");

    await markDistinct(actor, creme.ingredientId);
    await flag((await mint("cream")).ingredientId);

    const search = await listIngredients(actor, { search: "CREME" });

    expect(search.items.map((item) => item.name)).toEqual(["crème fraîche"]);
    expect(search.items[0]).toMatchObject({ canEdit: true, flagged: false });

    const flagged = await listIngredients(actor, { flaggedOnly: true });

    expect(flagged.items.map((item) => item.name)).toEqual(["cream"]);
  });

  it("finds the text anywhere by default, exactly on request, in the fields asked for, the flagged first", async () => {
    const cola = await mint("cola");
    const chocolate = await mint("chocolate");
    const nut = await mint("cola nut");

    await markDistinct(actor, cola.ingredientId);
    await markDistinct(actor, chocolate.ingredientId);
    await flag(nut.ingredientId);
    await addAlias(actor, chocolate.ingredientId, "chocola");

    const names = async (
      search: string,
      options: {
        match?: "contains" | "exact";
        fields?: Array<"name" | "translations" | "parent">;
      } = {}
    ) => (await listIngredients(actor, { search, ...options })).items.map((item) => item.name);

    // Anywhere in a name or a translation: the exact name first, then the flagged one.
    await expect(names("cola")).resolves.toEqual(["cola", "cola nut", "chocolate"]);
    // Exactly this.
    await expect(names("Cola", { match: "exact" })).resolves.toEqual(["cola"]);
    // Without a search, the flagged lead.
    expect((await listIngredients(actor, {})).items[0]!.id).toBe(nut.ingredientId);
    // Only where asked: by parent alone, the kinds of cola. (Filing it clears its flag.)
    await setParent(actor, nut.ingredientId, cola.ingredientId);
    await expect(names("cola", { fields: ["parent"] })).resolves.toEqual(["cola nut"]);
  });

  it("lists only seeded foods and the own foods a recipe line names, counting only listed kinds", async () => {
    const [milk] = await getTestDb()
      .insert(ingredients)
      .values({ name: "milk", offId: "en:milk" })
      .returning({ id: ingredients.id });
    const reserve = await mint("Nora reserve melk");
    await mint("melkpoeder");
    await flag(reserve.ingredientId);

    await getTestDb().insert(groceries).values({
      userId: actor.userId,
      name: "Nora reserve melk",
      ingredientAliasId: reserve.aliasId,
      ingredientId: reserve.ingredientId,
    });
    await getTestDb()
      .update(ingredients)
      .set({ parentId: milk!.id })
      .where(eq(ingredients.id, reserve.ingredientId));

    const listed = async (search?: string) =>
      (await listIngredients(actor, { search, listedOnly: true })).items.map((item) => ({
        name: item.name,
        kinds: item.kinds,
      }));

    // The grocery food and the own food nothing names are hidden, search included.
    await expect(listed()).resolves.toEqual([{ name: "milk", kinds: 0 }]);
    await expect(listed("melk")).resolves.toEqual([]);
    // A panel reads one food by its id whatever the page lists.
    expect((await listIngredients(actor, { id: reserve.ingredientId })).items).toHaveLength(1);

    const recipe = await createTestRecipe(actor.userId);

    await insertTestRecipeLine({ recipeId: recipe.id, name: "Nora reserve melk" }, [
      reserve.aliasId,
    ]);
    await expect(listed("melk")).resolves.toEqual([{ name: "Nora reserve melk", kinds: 0 }]);
    // Flagged first.
    await expect(listed()).resolves.toEqual([
      { name: "Nora reserve melk", kinds: 0 },
      { name: "milk", kinds: 1 },
    ]);
  });

  it("leaves another member's Ingredient alone under the default household policy", async () => {
    const onion = await mint("onion");
    const stranger = await createTestUser();

    await expect(
      refusal(
        renameIngredient(
          { userId: stranger.id, householdUserIds: null, isServerAdmin: false },
          onion.ingredientId,
          "Onions"
        )
      )
    ).resolves.toBe("forbidden");
  });

  describe("the nightly sweep of unused foods", () => {
    /** Backdate the sweep's mark, as though it had found the food unused `days` (and `hours` less) ago. */
    async function unusedFor(ingredientId: string, days: number, hours = 0) {
      await getTestDb()
        .update(ingredients)
        .set({ unusedSince: sql`now() - make_interval(days => ${days}, hours => ${-hours})` })
        .where(eq(ingredients.id, ingredientId));
    }

    async function unusedSince(ingredientId: string) {
      const [row] = await getTestDb()
        .select({ unusedSince: ingredients.unusedSince })
        .from(ingredients)
        .where(eq(ingredients.id, ingredientId));

      return row?.unusedSince ?? null;
    }

    it("deletes an own food nothing has named for 90 days, and keeps one unused for 89", async () => {
      const box = await mint("action grote doos");
      const lights = await mint("kerstverlichting");

      await sweepUnusedIngredients();
      await unusedFor(box.ingredientId, 90);
      await unusedFor(lights.ingredientId, 89);
      announced = [];
      await sweepUnusedIngredients();

      await expect(findIngredientByAliasId(box.aliasId)).resolves.toBeNull();
      await expect(findIngredientByAliasId(lights.aliasId)).resolves.toMatchObject({
        name: "kerstverlichting",
      });
      expect(announced).toEqual([[box.ingredientId]]);
    });

    it("deletes on the 90th night a food the first night marked, though this run started earlier in the day", async () => {
      const tin = await mint("taartvorm 26 cm");

      await sweepUnusedIngredients();
      await unusedFor(tin.ingredientId, 90, 1);
      await sweepUnusedIngredients();

      await expect(findIngredientByAliasId(tin.aliasId)).resolves.toBeNull();
    });

    it("keeps a parent while it has a child, and deletes it the night after its last child goes", async () => {
      const fries = await mint("zoete aardappel friet");
      const oven = await mint("ovenfriet zoete aardappel");
      const nora = await mint("nora brokken");
      const treats = await mint("smul rondjes nora");

      await setParent(actor, oven.ingredientId, fries.ingredientId);
      await setParent(actor, treats.ingredientId, nora.ingredientId);
      await getTestDb().insert(groceries).values({
        userId: actor.userId,
        name: "ovenfriet zoete aardappel",
        ingredientAliasId: oven.aliasId,
        ingredientId: oven.ingredientId,
      });
      await sweepUnusedIngredients();
      for (const food of [fries, nora, treats]) await unusedFor(food.ingredientId, 100);

      // The child something uses keeps its parent; an unused child goes before its parent.
      await sweepUnusedIngredients();
      await expect(findIngredientByAliasId(fries.aliasId)).resolves.not.toBeNull();
      await expect(findIngredientByAliasId(treats.aliasId)).resolves.toBeNull();
      await expect(findIngredientByAliasId(nora.aliasId)).resolves.not.toBeNull();

      await sweepUnusedIngredients();
      await expect(findIngredientByAliasId(nora.aliasId)).resolves.toBeNull();
      await expect(findIngredientByAliasId(fries.aliasId)).resolves.not.toBeNull();
    });

    it.each([
      ["a recipe line", "line"],
      ["a Grocery through its spelling", "grocery-spelling"],
      ["a Grocery through the food alone", "grocery-food"],
      ["a recurring grocery through its spelling", "recurring-spelling"],
      ["a recurring grocery through the food alone", "recurring-food"],
      ["a Pantry Ingredient", "pantry"],
    ] as const)("keeps a food %s names", async (_, by) => {
      const food = await mint("ijsblokjesvorm");
      const db = getTestDb();
      const spelling = { ingredientAliasId: food.aliasId };
      const itself = { ingredientId: food.ingredientId };
      const repeat = { recurrenceRule: "week", nextPlannedFor: "2027-01-01" };

      if (by === "line") {
        const recipe = await createTestRecipe(actor.userId);

        await insertTestRecipeLine({ recipeId: recipe.id, name: "ijsblokjesvorm" }, [food.aliasId]);
      }
      if (by === "grocery-spelling" || by === "grocery-food") {
        await db.insert(groceries).values({
          userId: actor.userId,
          name: "ijsblokjesvorm",
          ...(by === "grocery-spelling" ? spelling : itself),
        });
      }
      if (by === "recurring-spelling" || by === "recurring-food") {
        await db.insert(recurringGroceries).values({
          userId: actor.userId,
          name: "ijsblokjesvorm",
          ...repeat,
          ...(by === "recurring-spelling" ? spelling : itself),
        });
      }
      if (by === "pantry")
        await db.insert(pantryIngredients).values({ userId: actor.userId, ...itself });

      await unusedFor(food.ingredientId, 100);
      await sweepUnusedIngredients();

      await expect(unusedSince(food.ingredientId)).resolves.toBeNull();
      await expect(findIngredientByAliasId(food.aliasId)).resolves.not.toBeNull();
    });

    it("clears the flag of a food its last recipe line no longer names", async () => {
      const tin = await mint("bakvorm");
      const recipe = await createTestRecipe(actor.userId);
      const line = await insertTestRecipeLine({ recipeId: recipe.id, name: "bakvorm" }, [
        tin.aliasId,
      ]);
      const flagOf = async () =>
        (
          await getTestDb()
            .select({ flagged: ingredients.flagged, reason: ingredients.flagReason })
            .from(ingredients)
            .where(eq(ingredients.id, tin.ingredientId))
        )[0];

      await getTestDb()
        .update(ingredients)
        .set({ flagged: true, flagReason: "ai-unsure" })
        .where(eq(ingredients.id, tin.ingredientId));
      await sweepUnusedIngredients();
      await expect(flagOf()).resolves.toEqual({ flagged: true, reason: "ai-unsure" });

      await getTestDb().delete(recipeIngredients).where(eq(recipeIngredients.id, line.id));
      await sweepUnusedIngredients();

      await expect(flagOf()).resolves.toEqual({ flagged: false, reason: null });
    });

    it("clears the mark once something names the food again", async () => {
      const salt = await mint("vaatwaszout");

      await sweepUnusedIngredients();
      await expect(unusedSince(salt.ingredientId)).resolves.not.toBeNull();

      await getTestDb().insert(groceries).values({
        userId: actor.userId,
        name: "vaatwaszout",
        ingredientAliasId: salt.aliasId,
        ingredientId: salt.ingredientId,
      });
      await unusedFor(salt.ingredientId, 100);
      await sweepUnusedIngredients();

      await expect(unusedSince(salt.ingredientId)).resolves.toBeNull();
      await expect(findIngredientByAliasId(salt.aliasId)).resolves.toMatchObject({
        name: "vaatwaszout",
      });
    });

    it("keeps a food only a recurring grocery names, and never deletes a seeded one", async () => {
      const filter = await mint("waterfilter");
      const [seeded] = await getTestDb()
        .insert(ingredients)
        .values({ name: "amaranth", offId: "en:amaranth" })
        .returning({ id: ingredients.id });
      const [seededAlias] = await getTestDb()
        .insert(ingredientAliases)
        .values({ text: "amaranth", fold: "amaranth", ingredientId: seeded!.id, seeded: true })
        .returning({ id: ingredientAliases.id });

      await getTestDb().insert(recurringGroceries).values({
        userId: actor.userId,
        name: "waterfilter",
        ingredientAliasId: filter.aliasId,
        ingredientId: filter.ingredientId,
        recurrenceRule: "year",
        nextPlannedFor: "2027-06-01",
      });
      await sweepUnusedIngredients();
      await expect(unusedSince(filter.ingredientId)).resolves.toBeNull();
      await expect(unusedSince(seeded!.id)).resolves.toBeNull();

      await unusedFor(filter.ingredientId, 100);
      await unusedFor(seeded!.id, 100);
      await sweepUnusedIngredients();

      const left = await getTestDb()
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(inArray(ingredients.id, [filter.ingredientId, seeded!.id]));

      expect(left).toHaveLength(2);
      await expect(findIngredientByAliasId(seededAlias!.id)).resolves.toMatchObject({
        name: "amaranth",
      });
    });
  });
});
