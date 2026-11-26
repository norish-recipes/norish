// @vitest-environment node
/**
 * Keeping and undoing AI Changes, against a real database: Undo puts back what
 * each kind of change took (a merge's spellings and their lines, a parent, a
 * name) as far as the food is still as AI left it; Keep is the person's own
 * decision about the food. Both follow `edit` on the food the change was
 * about, and a person looking after a food keeps what AI was unsure of.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { withTransaction } from "@norish/db/drizzle";
import {
  listAIChanges,
  recordAIChange,
  sweepAIChanges,
  takeOpenParentChanges,
} from "@norish/db/repositories/ingredient-ai-changes";
import { findIngredientByAliasId } from "@norish/db/repositories/ingredient-aliases";
import { setIngredientIcon } from "@norish/db/repositories/ingredient-icons";
import { listJunkFolds } from "@norish/db/repositories/ingredient-junk-pile";
import { findIngredientAncestors, lockTree } from "@norish/db/repositories/ingredient-relocation";
import { insertSeededIngredient } from "@norish/db/repositories/ingredient-seed";
import { markAIChangesCleared } from "@norish/db/repositories/users";
import { isAIEnabled } from "@norish/shared-server/config/server-config-loader";
import {
  deleteByAI,
  flagByAnswer,
  keepAIChange,
  listAIChangesFor,
  mergeByAI,
  parentByAI,
  renameByAI,
  settleAIChanges,
  undoAIChange,
} from "@norish/shared-server/ingredients/ai-changes";
import {
  deleteIngredient,
  markDistinct,
  mergeIngredients,
} from "@norish/shared-server/ingredients/catalogue";
import { resolveIngredients } from "@norish/shared-server/ingredients/resolver";

import {
  backdateTestAIChanges,
  createTestRecipe,
  createTestUser,
  getRecipeIngredients,
  insertTestRecipeLine,
  joinTestHousehold,
  listTestAIChanges,
  nameInATestRecipe,
  readTestIngredient,
  readTestSeedSpelling,
  setTestIngredients,
  testHouseholdOf,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

vi.mock("@norish/shared-server/config/server-config-loader", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isAIEnabled: vi.fn(),
}));

describe("keeping and undoing AI Changes", () => {
  const testBase = new RepositoryTestBase("test_ingredient_ai_changes");

  let actor: CatalogueActor;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    actor = {
      userId: user.id,
      householdId: testHouseholdOf(user.id),
      isServerAdmin: false,
    };
    // Every mint here is the words' alone: AI is off, so each is flagged.
    vi.mocked(isAIEnabled).mockResolvedValue(false);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** A food a recipe line names, so AI may change it. */
  async function mint(text: string, userId = actor.userId) {
    const [resolved] = await resolveIngredients([text], {
      userId,
      householdId: testHouseholdOf(userId),
    });

    await nameInATestRecipe(userId, resolved!.aliasId, text);

    return resolved!;
  }

  async function onlyChange() {
    const [change, ...rest] = await listAIChanges(actor);

    expect(rest).toEqual([]);

    return change!;
  }

  function parentOf(ingredientId: string) {
    return findIngredientAncestors([ingredientId]).then(
      (all) => all.get(ingredientId)?.[0] ?? null
    );
  }

  it("undoes a merge: the spellings and their lines are back on a food of their own", async () => {
    const onion = await mint("onion");
    const uien = await mint("uien");
    const recipe = await createTestRecipe(actor.userId);

    await markDistinct(actor, onion.ingredientId);
    await insertTestRecipeLine({ recipeId: recipe.id, name: "uien" }, [uien.aliasId]);

    await expect(mergeByAI(uien.ingredientId, onion.ingredientId, false)).resolves.toBe("applied");
    await expect(findIngredientByAliasId(onion.aliasId)).resolves.toMatchObject({ flagged: true });

    await undoAIChange(actor, (await onlyChange()).id);

    const restored = (await findIngredientByAliasId(uien.aliasId))!;

    expect(restored).toMatchObject({ name: "uien", flagged: false });
    expect(restored.id).not.toBe(onion.ingredientId);
    await expect(getRecipeIngredients(recipe.id)).resolves.toMatchObject([
      { name: "uien", ingredientId: restored.id },
    ]);
    await expect(findIngredientByAliasId(onion.aliasId)).resolves.toMatchObject({
      id: onion.ingredientId,
      flagged: false,
    });
    // Undone, it is no longer listed: it stays only as AI's memory.
    expect(await listAIChanges(actor)).toEqual([]);
  });

  it("undoes a parent: the parent the food had before AI comes back", async () => {
    const vegetable = await mint("vegetable");
    const onion = await mint("onion");
    const red = await mint("red onion");

    // The words filed it under vegetable, as the seed's recheck would; AI moved it.
    await setTestIngredients(red.ingredientId, { parentId: vegetable.ingredientId });
    await parentByAI(red.ingredientId, onion.ingredientId, false);
    await expect(parentOf(red.ingredientId)).resolves.toBe(onion.ingredientId);

    await undoAIChange(actor, (await onlyChange()).id);

    await expect(parentOf(red.ingredientId)).resolves.toBe(vegetable.ingredientId);
    await expect(findIngredientByAliasId(red.aliasId)).resolves.toMatchObject({ flagged: false });
  });

  it("goes back past every parent AI replaced, to where the food was before AI", async () => {
    const red = await mint("red onion");
    const onion = await mint("onion");
    const allium = await mint("allium");

    await parentByAI(red.ingredientId, allium.ingredientId, false);
    await parentByAI(red.ingredientId, onion.ingredientId, true);
    await undoAIChange(actor, (await onlyChange()).id);

    await expect(parentOf(red.ingredientId)).resolves.toBeNull();
  });

  it("refuses a parent that would close a cycle, as a cycle", async () => {
    const onion = await mint("onion");
    const red = await mint("red onion");

    await parentByAI(red.ingredientId, onion.ingredientId, true);
    await expect(parentByAI(onion.ingredientId, red.ingredientId, true)).resolves.toMatchObject({
      outcome: "cycle",
    });
    await expect(parentOf(onion.ingredientId)).resolves.toBeNull();
  });

  it("undoes a Plain Name: the former name is back, and stays settled", async () => {
    const tonijn = await mint("GR TONIJN UIT BLIK");

    await expect(
      renameByAI(tonijn.ingredientId, "GR TONIJN UIT BLIK", "tonijn uit blik")
    ).resolves.toBe("applied");
    await undoAIChange(actor, (await onlyChange()).id);

    expect(await readTestIngredient(tonijn.ingredientId)).toMatchObject({
      name: "GR TONIJN UIT BLIK",
      nameSettled: true,
    });
  });

  it("leaves a parent a person set since: Undo only remembers", async () => {
    const red = await mint("red onion");
    const onion = await mint("onion");
    const allium = await mint("allium");

    await parentByAI(red.ingredientId, onion.ingredientId, false);
    const change = await onlyChange();

    await setTestIngredients(red.ingredientId, { parentId: allium.ingredientId });
    await undoAIChange(actor, change.id);

    await expect(parentOf(red.ingredientId)).resolves.toBe(allium.ingredientId);
    await expect(parentByAI(red.ingredientId, onion.ingredientId, true)).resolves.toMatchObject({
      outcome: "undone",
    });
  });

  it("keeps an unsure change: the flag goes once nothing else waits on the food", async () => {
    const onion = await mint("onion");
    const allium = await mint("allium");
    const red = await mint("red onion");
    const uien = await mint("uien");

    await parentByAI(red.ingredientId, allium.ingredientId, false);
    await mergeByAI(uien.ingredientId, onion.ingredientId, false);
    await mergeByAI(red.ingredientId, onion.ingredientId, false);
    const [first, second] = await listAIChanges(actor);

    await keepAIChange(actor, first!.id);
    await expect(findIngredientByAliasId(onion.aliasId)).resolves.toMatchObject({ flagged: true });
    await keepAIChange(actor, second!.id);
    await expect(findIngredientByAliasId(onion.aliasId)).resolves.toMatchObject({ flagged: false });
    expect((await listAIChanges(actor)).map((change) => change.kept)).toEqual([true, true]);
  });

  it("keeps what AI was unsure of when a person looks after the food themselves", async () => {
    const red = await mint("red onion");
    const onion = await mint("onion");

    await parentByAI(red.ingredientId, onion.ingredientId, false);
    await markDistinct(actor, red.ingredientId);

    expect(await listAIChanges(actor)).toMatchObject([{ kept: true }]);
  });

  it("lists a change only to the household whose catalogue AI changed, a merge into the seed's included", async () => {
    // Merged into a seeded food, which only an administrator may edit.
    const seeded = {
      id: await insertSeededIngredient({ name: "leek", offId: "en:leek" }, [
        { text: "leek", fold: "leek", locale: "en" },
      ]),
    };
    const prei = await mint("prei");
    const stranger = await createTestUser();
    const strangers = {
      userId: stranger.id,
      householdId: testHouseholdOf(stranger.id),
      isServerAdmin: false,
    };

    await mergeByAI(prei.ingredientId, seeded.id, false);
    const change = await onlyChange();

    // Another household neither sees it nor reaches it by its id.
    expect(await listAIChangesFor(strangers)).toEqual([]);
    expect(await listAIChangesFor({ ...strangers, isServerAdmin: true })).toEqual([]);
    await expect(undoAIChange(strangers, change.id)).rejects.toMatchObject({
      refusal: "not-found",
    });
    await expect(keepAIChange(strangers, change.id)).rejects.toMatchObject({
      refusal: "not-found",
    });
    expect(await listAIChangesFor(actor)).toMatchObject([
      { kind: "merge", from: "prei", ingredient: { name: "leek" }, canAct: true },
    ]);
    await undoAIChange(actor, change.id);
    await expect(findIngredientByAliasId(prei.aliasId)).resolves.toMatchObject({ name: "prei" });
  });

  it("changes nothing on a seeded food a household's food is merged into, by AI or an admin", async () => {
    const seeded = await insertSeededIngredient({ name: "leek", offId: "en:leek" }, [
      { text: "leek", fold: "leek", locale: "en" },
    ]);
    const before = await readTestIngredient(seeded);
    const prei = await mint("prei");
    const stokprei = await mint("stokprei");

    await withTransaction((tx) => setIngredientIcon(tx, prei.ingredientId, "prei.webp"));
    await withTransaction((tx) => setIngredientIcon(tx, stokprei.ingredientId, "stokprei.webp"));
    await expect(mergeByAI(prei.ingredientId, seeded, false)).resolves.toBe("applied");
    await keepAIChange(actor, (await onlyChange()).id);
    await mergeIngredients({ ...actor, isServerAdmin: true }, stokprei.ingredientId, seeded);

    await expect(readTestIngredient(seeded)).resolves.toEqual(before);
    // The household's spellings and lines now name the seeded food, as the household's spellings.
    await expect(findIngredientByAliasId(prei.aliasId)).resolves.toMatchObject({ id: seeded });
    await expect(findIngredientByAliasId(stokprei.aliasId)).resolves.toMatchObject({ id: seeded });
  });

  it("lets only the food's household bring back a food AI deleted as not a food, with its lines", async () => {
    const melted = await mint("melted");
    const recipe = await createTestRecipe(actor.userId, { name: "snickers ice cream bars" });

    await insertTestRecipeLine({ recipeId: recipe.id, name: "melted" }, [melted.aliasId]);
    await expect(deleteByAI(melted.ingredientId)).resolves.toBe("applied");
    const change = await onlyChange();
    const stranger = await createTestUser();
    const strangers = {
      userId: stranger.id,
      householdId: testHouseholdOf(stranger.id),
      isServerAdmin: false,
    };

    expect(await listAIChangesFor(strangers)).toEqual([]);
    expect(await listAIChangesFor(actor)).toMatchObject([
      { kind: "not-a-food", ingredient: null, from: "melted", canAct: true },
    ]);
    await expect(undoAIChange(strangers, change.id)).rejects.toMatchObject({
      refusal: "not-found",
    });
    await undoAIChange(actor, change.id);
    expect(await getRecipeIngredients(recipe.id)).toMatchObject([
      { name: "melted", ingredientId: melted.ingredientId },
    ]);
  });

  it("refuses an Undo that would point another household's line at the food, changing nothing", async () => {
    const stranger = await createTestUser();
    const theirs = await createTestRecipe(stranger.id, { name: "fudge" });
    const theirLine = await insertTestRecipeLine({ recipeId: theirs.id, name: "melted" });
    const food = { ingredientId: randomUUID(), aliasId: randomUUID() };
    const changeId = await withTransaction((tx) =>
      recordAIChange(tx, {
        householdId: actor.householdId,
        sure: true,
        undo: {
          kind: "not-a-food",
          food: {
            ingredientId: food.ingredientId,
            name: "melted",
            ownerId: actor.userId,
            parentId: null,
            aliases: [
              { id: food.aliasId, text: "melted", fold: "melted", locale: null, ownerId: null },
            ],
            lineFoods: [{ lineId: theirLine.id, position: 0, aliasId: food.aliasId }],
            groceries: [],
            recurring: [],
          },
        },
      })
    );

    await expect(undoAIChange(actor, changeId)).rejects.toMatchObject({ refusal: "forbidden" });
    await expect(readTestIngredient(food.ingredientId)).resolves.toBeNull();
    expect(await getRecipeIngredients(theirs.id)).toMatchObject([
      { name: "melted", ingredientId: null },
    ]);
  });

  it("leaves a change on a food since taken into the seed to an administrator", async () => {
    const tonijn = await mint("GR TONIJN UIT BLIK");
    const red = await mint("red onion");
    const onion = await mint("onion");

    await renameByAI(tonijn.ingredientId, "GR TONIJN UIT BLIK", "tonijn uit blik");
    await parentByAI(red.ingredientId, onion.ingredientId, false);
    await setTestIngredients(tonijn.ingredientId, { householdId: null, offId: "en:tuna" });
    await setTestIngredients(red.ingredientId, { householdId: null, offId: "en:red-onion" });
    const before = [
      await readTestIngredient(tonijn.ingredientId),
      await readTestIngredient(red.ingredientId),
    ];
    const changes = await listAIChanges(actor);

    expect((await listAIChangesFor(actor)).map((change) => change.canAct)).toEqual([false, false]);
    for (const change of changes) {
      await expect(undoAIChange(actor, change.id)).rejects.toMatchObject({ refusal: "forbidden" });
      await expect(keepAIChange(actor, change.id)).rejects.toMatchObject({ refusal: "forbidden" });
    }
    await expect(
      Promise.all([readTestIngredient(tonijn.ingredientId), readTestIngredient(red.ingredientId)])
    ).resolves.toEqual(before);

    const admin = { ...actor, isServerAdmin: true };

    expect((await listAIChangesFor(admin)).map((change) => change.canAct)).toEqual([true, true]);
    for (const change of changes) await undoAIChange(admin, change.id);
    await expect(readTestIngredient(tonijn.ingredientId)).resolves.toMatchObject({
      name: "GR TONIJN UIT BLIK",
    });
  });

  it("refuses a member's Undo that would move a seeded spelling back", async () => {
    const leek = await insertSeededIngredient({ name: "leek", offId: "en:leek" }, [
      { text: "leek", fold: "leek", locale: "en" },
      { text: "poireau", fold: "poireau", locale: "fr" },
    ]);
    const prei = await mint("prei");
    const poireau = (await readTestSeedSpelling("poireau"))!;
    const changeId = await withTransaction((tx) =>
      recordAIChange(tx, {
        householdId: actor.householdId,
        ingredientId: prei.ingredientId,
        targetId: leek,
        sure: true,
        undo: {
          kind: "spelling",
          spelling: {
            id: poireau.id,
            text: "poireau",
            fold: "poireau",
            locale: "fr",
            ownerId: null,
          },
          lines: [],
          groceries: [],
          recurring: [],
        },
      })
    );

    await expect(undoAIChange(actor, changeId)).rejects.toMatchObject({ refusal: "forbidden" });
    await expect(findIngredientByAliasId(poireau.id)).resolves.toMatchObject({ id: leek });
  });

  it("refuses a change already undone", async () => {
    const red = await mint("red onion");
    const onion = await mint("onion");

    await parentByAI(red.ingredientId, onion.ingredientId, false);
    const change = await onlyChange();

    await undoAIChange(actor, change.id);
    await expect(undoAIChange(actor, change.id)).rejects.toMatchObject({ refusal: "not-found" });
  });

  it("settles many at once: one gone or another household's is skipped, the rest settle", async () => {
    const stranger = await createTestUser();
    const strangers = {
      userId: stranger.id,
      householdId: testHouseholdOf(stranger.id),
      isServerAdmin: false,
    };
    const onion = await mint("onion");
    const uien = await mint("uien");
    const leek = await mint("leek", stranger.id);
    const prei = await mint("prei", stranger.id);

    await mergeByAI(uien.ingredientId, onion.ingredientId, false);
    await mergeByAI(prei.ingredientId, leek.ingredientId, false);
    const [mine] = await listAIChanges(actor);
    const [theirs] = await listAIChanges(strangers);

    // Theirs is undone; mine, out of their reach, and theirs again, gone by then, were skipped.
    await settleAIChanges(strangers, [mine!.id, theirs!.id, theirs!.id], "undo");
    expect(await listAIChanges(strangers)).toEqual([]);
    expect((await listAIChanges(actor)).map((change) => change.id)).toEqual([mine!.id]);
    await settleAIChanges(actor, [mine!.id], "keep");
    expect(await listAIChanges(actor)).toMatchObject([{ id: mine!.id, kept: true }]);
  });

  it("stops listing to who cleared Changed by AI what was settled by then, never an open one", async () => {
    const member = await createTestUser();
    const members = {
      userId: member.id,
      householdId: await joinTestHousehold(member.id, actor.userId),
      isServerAdmin: false,
    };
    const onion = await mint("onion");
    const uien = await mint("uien");
    const allium = await mint("allium");
    const red = await mint("red onion");
    const prei = await mint("prei");

    await mergeByAI(uien.ingredientId, onion.ingredientId, true);
    await parentByAI(red.ingredientId, allium.ingredientId, false);
    await markAIChangesCleared(actor.userId);
    await mergeByAI(prei.ingredientId, onion.ingredientId, true);

    expect(await listAIChangesFor(actor)).toMatchObject([
      { kind: "parent", sure: false },
      { kind: "merge", from: "prei" },
    ]);
    // Cleared for the person who cleared it alone.
    expect(await listAIChangesFor(members)).toHaveLength(3);
  });

  it("leaves a flag a sure change never raised when that change is undone", async () => {
    const tonijn = await mint("GR TONIJN UIT BLIK");

    // AI was unsure the food is one of its own, then gave it its Plain Name.
    await setTestIngredients(tonijn.ingredientId, { flagged: true, flagReason: "ai-unsure" });
    await renameByAI(tonijn.ingredientId, "GR TONIJN UIT BLIK", "tonijn uit blik");
    await undoAIChange(actor, (await onlyChange()).id);

    await expect(findIngredientByAliasId(tonijn.aliasId)).resolves.toMatchObject({
      flagged: true,
      flagReason: "ai-unsure",
    });
  });

  it("keeps a merge without deciding anything about the food it joined", async () => {
    const onion = await mint("onion");
    const uien = await mint("uien");

    await mergeByAI(uien.ingredientId, onion.ingredientId, false);
    await keepAIChange(actor, (await onlyChange()).id);

    expect(await readTestIngredient(onion.ingredientId)).toMatchObject({
      flagged: false,
      keptDistinct: false,
    });
  });

  it("follows a parent merged away to the food it joined, and goes with a parent deleted", async () => {
    const red = await mint("red onion");
    const onion = await mint("onion");
    const allium = await mint("allium");
    const admin = { ...actor, isServerAdmin: true };

    await parentByAI(red.ingredientId, onion.ingredientId, false);
    await mergeIngredients(admin, onion.ingredientId, allium.ingredientId);
    expect(await listAIChangesFor(actor)).toMatchObject([{ target: { name: "allium" } }]);

    await deleteIngredient(admin, allium.ingredientId);
    expect(await listAIChanges(actor)).toEqual([]);
  });

  it("lets a Keep or an Undo wait for an answer about the same food rather than deadlock", async () => {
    const red = await mint("red onion");
    const onion = await mint("onion");

    await parentByAI(red.ingredientId, onion.ingredientId, false);
    const change = await onlyChange();
    // Two idle connections, so the two transactions below really run at once.
    const warm = () => withTransaction((tx) => listJunkFolds(actor.householdId, tx));

    await Promise.all([warm(), warm()]);

    let undoing: Promise<unknown> = Promise.resolve();
    // A newer answer about the food holds the tree, then replaces its open parent change.
    const answer = withTransaction(async (tx) => {
      await lockTree(tx);
      undoing = undoAIChange(actor, change.id).catch((error: unknown) => error);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await takeOpenParentChanges(tx, red.ingredientId);
    });

    await expect(answer).resolves.toBeUndefined();
    await expect(undoing).resolves.toMatchObject({ refusal: "not-found" });
  });

  it("changes nothing about a food a person decided about while AI was asking", async () => {
    const onion = await mint("onion");
    const uien = await mint("uien");

    // The person marks it distinct after the question went out, before the answer lands.
    await markDistinct(actor, uien.ingredientId);

    await expect(mergeByAI(uien.ingredientId, onion.ingredientId, true)).resolves.toBe("decided");
    await expect(parentByAI(uien.ingredientId, onion.ingredientId, false)).resolves.toMatchObject({
      outcome: "decided",
    });
    await expect(renameByAI(uien.ingredientId, "uien", "ui")).resolves.toBe("decided");
    await flagByAnswer(uien.ingredientId, false);

    await expect(findIngredientByAliasId(uien.aliasId)).resolves.toMatchObject({
      id: uien.ingredientId,
      name: "uien",
      flagged: false,
    });
    await expect(parentOf(uien.ingredientId)).resolves.toBeNull();
    expect(await listAIChanges(actor)).toEqual([]);
  });

  it("sweeps the handled changes older than a month, keeping the undone and the open ones", async () => {
    const red = await mint("red onion");
    const onion = await mint("onion");
    const uien = await mint("uien");
    const leek = await mint("leek");
    const tonijn = await mint("Lekkerste Tonijn");
    const shallot = await mint("shallot");

    await mergeByAI(uien.ingredientId, onion.ingredientId, true);
    await parentByAI(red.ingredientId, onion.ingredientId, false);
    await parentByAI(leek.ingredientId, onion.ingredientId, false);
    await keepAIChange(
      actor,
      (await listAIChangesFor(actor)).find((it) => it.ingredient.id === leek.ingredientId)!.id
    );
    await renameByAI(tonijn.ingredientId, "Lekkerste Tonijn", "tonijn");
    await undoAIChange(
      actor,
      (await listAIChangesFor(actor)).find((it) => it.kind === "plain-name")!.id
    );
    // A month and a day ago, all but the newest.
    await backdateTestAIChanges(31);
    await renameByAI(shallot.ingredientId, "shallot", "sjalot");

    await expect(sweepAIChanges()).resolves.toBe(2);

    const left = (await listTestAIChanges()).map(({ ingredientId, kind }) => ({
      ingredientId,
      kind,
    }));

    // The open parent, the undone name AI remembers, and this month's name.
    expect(left).toEqual(
      expect.arrayContaining([
        { ingredientId: red.ingredientId, kind: "parent" },
        { ingredientId: tonijn.ingredientId, kind: "plain-name" },
        { ingredientId: shallot.ingredientId, kind: "plain-name" },
      ])
    );
    expect(left).toHaveLength(3);
  });
});
