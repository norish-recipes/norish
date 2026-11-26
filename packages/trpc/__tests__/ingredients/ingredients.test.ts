// @vitest-environment node
/**
 * The Ingredients page's procedures: any member edits their household's Ingredients, an admin the
 * seeded ones (ADR-0042). The catalogue repository is mocked as it answers: another household's row
 * is not found. What is pinned here is who may do what, and that a refused edit writes nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogueEditError } from "@norish/shared-server/ingredients/catalogue";

import { ingredientsRouter } from "../../src/routers/ingredients";
import {
  createMockAuthedContext,
  createMockCallerContext,
  createMockHousehold,
  createMockUser,
} from "../calendar/test-utils";
import { TX } from "../mocks/drizzle";
import { ingredients as ingredientsRealtime } from "../mocks/realtime/ingredients";

const catalogue = vi.hoisted(() => ({
  addSpellingUnlessKnown: vi.fn(),
  keepIngredientDistinct: vi.fn(),
  deleteCatalogueAlias: vi.fn(),
  deleteCatalogueIngredient: vi.fn(),
  findCatalogueAliasOwner: vi.fn(),
  findCatalogueIngredient: vi.fn(),
  findCatalogueIngredientOwner: vi.fn(),
  findIngredientIdByFold: vi.fn(),
  insertCatalogueAlias: vi.fn(),
  listCatalogueAliasesOf: vi.fn(),
  listCatalogueIngredients: vi.fn(),
  renameCatalogueIngredient: vi.fn(),
}));
const relocation = vi.hoisted(() => ({
  closesCycle: vi.fn(async () => false),
  countAliasesOf: vi.fn(),
  findIngredientAncestors: vi.fn(),
  fitsInCatalogueOf: vi.fn(async () => true),
  insertCatalogueIngredient: vi.fn(),
  lockIngredientNamed: vi.fn(async () => null),
  lockFoods: vi.fn(async () => true),
  lockIngredients: vi.fn(async (_tx: unknown, ids: readonly string[]) => ids.length),
  lockTree: vi.fn(),
  mergeCatalogueIngredients: vi.fn(),
  moveCatalogueAlias: vi.fn(),
  setCatalogueIngredientParent: vi.fn(async () => true),
  writeGroceryParts: vi.fn(),
}));
// What a deleted food named, resolved again: nothing, here.
const cleanup = vi.hoisted(() => ({
  findRowsNamingFood: vi.fn(async () => ({ lines: [], groceries: [], recurring: [] })),
  findLineHouseholds: vi.fn(async () => new Map()),
  repointLines: vi.fn(),
}));
const aliases = vi.hoisted(() => ({
  findLocaleNames: vi.fn(async () => new Map()),
  findIngredientDisplayNames: vi.fn(
    async (): Promise<Map<string, { name: string; localeNames: Record<string, string> }>> =>
      new Map()
  ),
}));
const junkPile = vi.hoisted(() => ({
  addToJunkPile: vi.fn(async () => 1),
  takeOffJunkPile: vi.fn(async () => 0),
}));
const iconsRepo = vi.hoisted(() => ({
  findIconLineage: vi.fn(async (): Promise<Map<string, unknown>> => new Map()),
  setIngredientIcon: vi.fn(async () => true),
}));
const iconFiles = vi.hoisted(() => ({
  storeIngredientIcon: vi.fn(async () => "0123456789abcdef0123456789abcdef.webp"),
  claimOwnIcon: vi.fn(async () => true),
}));
const policy = vi.hoisted(() => ({
  canDrawImages: vi.fn(async () => true),
  getUnits: vi.fn(async () => ({})),
}));
const drawer = vi.hoisted(() => ({
  drawIngredientIcon: vi.fn(async () => ({ bytes: Buffer.from([9, 9]), mediaType: "image/png" })),
}));
const aiChangesRepo = vi.hoisted(() => ({ keepOpenAIChangesOf: vi.fn() }));
const aiChanges = vi.hoisted(() => ({
  listAIChangesFor: vi.fn(async (): Promise<unknown[]> => []),
  keepAIChange: vi.fn(),
  undoAIChange: vi.fn(),
}));
vi.mock("@norish/db/drizzle", () => import("../mocks/drizzle"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
// A fixture set stands in for the one Norish ships: onion drawn, vegetable a vague group.
vi.mock("@norish/shared-server/ingredients/icons", async (original) => ({
  ...(await original<typeof import("@norish/shared-server/ingredients/icons")>()),
  shippedIconSet: () => ({
    icons: { "en:onion": "0123456789abcdef0123456789abcdef.webp" },
    none: ["en:vegetable"],
  }),
}));
vi.mock("@norish/queue/valkey/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/db/repositories/ingredient-catalogue", () => catalogue);
vi.mock("@norish/db/repositories/ingredient-relocation", () => relocation);
vi.mock("@norish/db/repositories/ingredient-cleanup", () => cleanup);
vi.mock("@norish/db/repositories/ingredient-aliases", () => aliases);
vi.mock("@norish/db/repositories/ingredient-junk-pile", () => junkPile);
vi.mock("@norish/db/repositories/ingredient-icons", () => iconsRepo);
// Every id asked about is the household's or the seed's here; the boundary is the repository's own test.
vi.mock("@norish/db/repositories/ingredient-nutrition", async (original) => ({
  ...(await original<typeof import("@norish/db/repositories/ingredient-nutrition")>()),
  findIdsInCatalogue: vi.fn(async (_householdId: string, ids: readonly string[]) => new Set(ids)),
}));
vi.mock("@norish/shared-server/media/ingredient-icon", async (original) => ({
  ...(await original<typeof import("@norish/shared-server/media/ingredient-icon")>()),
  ...iconFiles,
}));
vi.mock("@norish/db/repositories/ingredient-ai-changes", () => aiChangesRepo);
vi.mock("@norish/shared-server/ingredients/ai-changes", () => aiChanges);
vi.mock("@norish/shared-server/ai/enrichment/ingredient-icon-drawer", () => drawer);
vi.mock("@norish/shared-server/config/server-config-loader", () => policy);
vi.mock("@norish/shared-server/ingredients/resolver", () => import("../mocks/ingredient-resolver"));
vi.mock(
  "@norish/shared-server/realtime/ingredients",
  () => import("../mocks/realtime/ingredients")
);
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const ONION = "11111111-1111-4111-8111-111111111111";
const ALIAS = "22222222-2222-4222-8222-222222222222";
const UIEN = "33333333-3333-4333-8333-333333333333";
const ME = "test-user-id";
const HOUSEMATE = "household-member-id";
const STRANGER = "someone-elsewhere";
const HOME = "test-household-id";
const ELSEWHERE = "household-elsewhere";

/** The household a member's rows are in; null for the seed. */
const householdOfOwner = (ownerId: string | null) =>
  ownerId === null ? null : ownerId === STRANGER ? ELSEWHERE : HOME;

function callerFor(options: { admin?: boolean } = {}) {
  const ctx = createMockAuthedContext(
    createMockUser({ isServerAdmin: options.admin ?? false }),
    createMockHousehold()
  );

  return ingredientsRouter.createCaller(createMockCallerContext(ctx));
}

/** The Ingredient and its alias as the household-scoped reads answer them: another household's is not found. */
function ownedBy(ownerId: string | null) {
  const householdId = householdOfOwner(ownerId);
  const found = householdId === ELSEWHERE ? null : { householdId };

  catalogue.findCatalogueIngredientOwner.mockResolvedValue(found);
  catalogue.findCatalogueAliasOwner.mockResolvedValue(
    found && { ...found, ownerId, ingredientId: ONION, text: "ui", fold: "ui" }
  );
}

beforeEach(() => {
  ingredientsRealtime.reset();
  relocation.mergeCatalogueIngredients.mockResolvedValue(true);
  relocation.countAliasesOf.mockResolvedValue(2);
  relocation.findIngredientAncestors.mockResolvedValue(new Map());
  relocation.insertCatalogueIngredient.mockResolvedValue(UIEN);
  catalogue.renameCatalogueIngredient.mockResolvedValue({ id: ONION });
  catalogue.keepIngredientDistinct.mockResolvedValue({ id: ONION });
  catalogue.insertCatalogueAlias.mockResolvedValue({ id: ALIAS, text: "Onion", householdId: HOME });
});

describe("the edit policy", () => {
  // [owner, may the member edit?]: another household's row is not found at all.
  const matrix: Array<[string, boolean]> = [
    [ME, true],
    [HOUSEMATE, true],
    [STRANGER, false],
  ];

  it.each(matrix)("renaming an Ingredient owned by %s is allowed: %s", async (owner, allowed) => {
    ownedBy(owner);

    const rename = callerFor().rename({ ingredientId: ONION, name: "Onion" });

    if (allowed) {
      await expect(rename).resolves.toEqual({ success: true });
      expect(catalogue.renameCatalogueIngredient).toHaveBeenCalledWith(TX, ONION, "Onion");
    } else {
      await expect(rename).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(catalogue.renameCatalogueIngredient).not.toHaveBeenCalled();
    }
  });

  it.each(matrix)(
    "marking distinct an Ingredient owned by %s is allowed: %s",
    async (owner, allowed) => {
      ownedBy(owner);

      const mark = callerFor().markDistinct({ ingredientId: ONION });

      if (allowed) {
        await expect(mark).resolves.toEqual({ success: true });
        expect(ingredientsRealtime.published).toEqual([
          expect.objectContaining({ event: "changed", payload: { ingredientIds: [ONION] } }),
        ]);
      } else {
        await expect(mark).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(ingredientsRealtime.published).toHaveLength(0);
      }
    }
  );

  it.each(matrix)("deleting an Ingredient owned by %s is allowed: %s", async (owner, allowed) => {
    ownedBy(owner);

    const remove = callerFor().remove({ ingredientId: ONION });

    if (allowed) {
      await expect(remove).resolves.toEqual({ success: true });
      expect(catalogue.deleteCatalogueIngredient).toHaveBeenCalledWith(TX, ONION);
      expect(ingredientsRealtime.published).toEqual([
        expect.objectContaining({ event: "changed", payload: { ingredientIds: [ONION] } }),
      ]);
    } else {
      await expect(remove).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(catalogue.deleteCatalogueIngredient).not.toHaveBeenCalled();
    }
  });

  it.each(matrix)("removing an alias added by %s is allowed: %s", async (owner, allowed) => {
    ownedBy(owner);

    const remove = callerFor().removeAlias({ aliasId: ALIAS });

    if (allowed) {
      await expect(remove).resolves.toEqual({ success: true });
      expect(ingredientsRealtime.published).toEqual([
        expect.objectContaining({ event: "changed", payload: { ingredientIds: [ONION] } }),
      ]);
    } else {
      await expect(remove).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(catalogue.deleteCatalogueAlias).not.toHaveBeenCalled();
    }
  });

  it("puts a draft's spelling marked as not a food on the junk pile, and a plain removal nowhere", async () => {
    ownedBy(ME);
    relocation.countAliasesOf.mockResolvedValue(3);

    await expect(
      callerFor().saveDraft({ ingredientId: ONION, add: [], remove: [ALIAS], junk: [ALIAS] })
    ).resolves.toEqual({ success: true });
    expect(junkPile.addToJunkPile).toHaveBeenCalledWith(TX, HOME, ["ui"], { reason: "person" });

    junkPile.addToJunkPile.mockClear();
    await callerFor().saveDraft({ ingredientId: ONION, add: [], remove: [ALIAS] });
    expect(junkPile.addToJunkPile).not.toHaveBeenCalled();
  });

  it("leaves a seeded, ownerless Ingredient to administrators, ", async () => {
    ownedBy(null);

    await expect(callerFor().rename({ ingredientId: ONION, name: "Onion" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(callerFor().removeAlias({ aliasId: ALIAS })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      callerFor({ admin: true }).rename({ ingredientId: ONION, name: "Onion" })
    ).resolves.toEqual({ success: true });
  });

  it("gives an administrator no way past another household's Ingredient", async () => {
    ownedBy(STRANGER);

    await expect(
      callerFor({ admin: true }).markDistinct({ ingredientId: ONION })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(callerFor({ admin: true }).removeAlias({ aliasId: ALIAS })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it.each(matrix)(
    "setting the parent of an Ingredient owned by %s is allowed: %s",
    async (owner, allowed) => {
      ownedBy(owner);

      const set = callerFor().setParent({ ingredientId: ONION, parentId: UIEN });

      if (allowed) {
        await expect(set).resolves.toEqual({ success: true });
        expect(relocation.setCatalogueIngredientParent).toHaveBeenCalledWith(TX, ONION, UIEN);
        // The move is announced with the parent it went to, so its tree refreshes.
        expect(ingredientsRealtime.published).toEqual([
          expect.objectContaining({ event: "changed", payload: { ingredientIds: [ONION, UIEN] } }),
        ]);
      } else {
        await expect(set).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(relocation.setCatalogueIngredientParent).not.toHaveBeenCalled();
      }
    }
  );

  it.each(matrix)("moving an alias added by %s is allowed: %s", async (owner, allowed) => {
    ownedBy(owner);

    const move = callerFor().moveAlias({ aliasId: ALIAS, targetId: UIEN });

    if (allowed) {
      await expect(move).resolves.toEqual({ success: true });
      expect(relocation.moveCatalogueAlias).toHaveBeenCalledWith(TX, ALIAS, UIEN);
    } else {
      await expect(move).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(relocation.moveCatalogueAlias).not.toHaveBeenCalled();
    }
  });

  it("moves an alias out to a new Ingredient the member owns, named for it", async () => {
    ownedBy(ME);

    await callerFor().moveAlias({ aliasId: ALIAS, targetId: null });

    expect(relocation.insertCatalogueIngredient).toHaveBeenCalledWith(TX, {
      householdId: HOME,
      name: "ui",
      ownerId: ME,
    });
    expect(relocation.moveCatalogueAlias).toHaveBeenCalledWith(TX, ALIAS, UIEN);
  });

  it.each([
    ["the source", STRANGER, ME],
    ["the target", ME, STRANGER],
  ])(
    "refuses a merge with another household's food as %s, which is not found",
    async (_which, sourceOwner, targetOwner) => {
      catalogue.findCatalogueIngredientOwner.mockImplementation(
        async (_tx: unknown, _household: string, id: string) => {
          const householdId = householdOfOwner(id === UIEN ? sourceOwner : targetOwner);

          return householdId === ELSEWHERE ? null : { householdId };
        }
      );

      await expect(callerFor().merge({ sourceId: UIEN, targetId: ONION })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(relocation.mergeCatalogueIngredients).not.toHaveBeenCalled();
    }
  );

  it("merges two of the household's foods, and tells the household", async () => {
    catalogue.findCatalogueIngredientOwner.mockImplementation(async () => ({ householdId: HOME }));

    await expect(callerFor().merge({ sourceId: UIEN, targetId: ONION })).resolves.toEqual({
      success: true,
    });
    expect(relocation.mergeCatalogueIngredients).toHaveBeenCalledWith(TX, UIEN, ONION);
    expect(ingredientsRealtime.published).toEqual([
      expect.objectContaining({ event: "changed", payload: { ingredientIds: [UIEN, ONION] } }),
    ]);
  });

  it("refuses a merge of a seeded food into a household's, and leaves seeded ones to administrators", async () => {
    catalogue.findCatalogueIngredientOwner.mockImplementation(
      async (_tx: unknown, _household: string, id: string) => ({
        householdId: id === UIEN ? null : HOME,
      })
    );
    relocation.fitsInCatalogueOf.mockResolvedValueOnce(false);
    await expect(
      callerFor({ admin: true }).merge({ sourceId: UIEN, targetId: ONION })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(relocation.mergeCatalogueIngredients).not.toHaveBeenCalled();

    ownedBy(null);

    await expect(callerFor().merge({ sourceId: UIEN, targetId: ONION })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      callerFor({ admin: true }).merge({ sourceId: UIEN, targetId: ONION })
    ).resolves.toEqual({ success: true });
  });

  it("lets anyone add an alias to a seeded Ingredient, as their household's", async () => {
    ownedBy(null);
    catalogue.insertCatalogueAlias.mockResolvedValue({
      id: ALIAS,
      text: "ajuin",
      householdId: HOME,
    });

    await expect(callerFor().addAlias({ ingredientId: ONION, text: "ajuin" })).resolves.toEqual({
      success: true,
    });
    expect(catalogue.insertCatalogueAlias).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({
        householdId: HOME,
        ingredientId: ONION,
        text: "ajuin",
        householdId: HOME,
      })
    );
    expect(ingredientsRealtime.published).toEqual([
      expect.objectContaining({ event: "changed", payload: { ingredientIds: [ONION] } }),
    ]);
  });

  it("makes a new name one of the Ingredient's spellings", async () => {
    ownedBy(ME);

    await callerFor().rename({ ingredientId: ONION, name: "Yellow onion" });

    expect(catalogue.addSpellingUnlessKnown).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ householdId: HOME, ingredientId: ONION, text: "Yellow onion" })
    );
  });
});

describe("AI Changes", () => {
  const CHANGE = "44444444-4444-4444-8444-444444444444";

  it("lists what Changed by AI shows the viewer", async () => {
    aiChanges.listAIChangesFor.mockResolvedValueOnce([{ id: CHANGE, kind: "merge" }]);

    await expect(callerFor().aiChanges()).resolves.toEqual([{ id: CHANGE, kind: "merge" }]);
    expect(aiChanges.listAIChangesFor).toHaveBeenCalledWith({
      userId: ME,
      householdId: "test-household-id",
      isServerAdmin: false,
    });
  });

  it("keeps and undoes a change as the viewer", async () => {
    await expect(callerFor().keepAIChange({ changeId: CHANGE })).resolves.toEqual({
      success: true,
    });
    await expect(callerFor().undoAIChange({ changeId: CHANGE })).resolves.toEqual({
      success: true,
    });
    expect(aiChanges.keepAIChange).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ME }),
      CHANGE
    );
    expect(aiChanges.undoAIChange).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ME }),
      CHANGE
    );
  });

  it("says why a change could not be undone", async () => {
    aiChanges.undoAIChange.mockRejectedValueOnce(new CatalogueEditError("forbidden"));
    aiChanges.keepAIChange.mockRejectedValueOnce(new CatalogueEditError("name-taken"));

    await expect(callerFor().undoAIChange({ changeId: CHANGE })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "forbidden",
    });
    await expect(callerFor().keepAIChange({ changeId: CHANGE })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("the tree of kinds", () => {
  beforeEach(() => {
    catalogue.listCatalogueIngredients.mockResolvedValue([]);
  });

  it("lists the foods with neither parent nor kinds on request", async () => {
    await callerFor().list({ standaloneOnly: true });

    expect(catalogue.listCatalogueIngredients).toHaveBeenLastCalledWith(
      expect.objectContaining({ standaloneOnly: true })
    );
  });

  it("ranks a search by the reader's catalogue languages", async () => {
    await callerFor().list({ search: "tom", locale: "vi" });

    expect(catalogue.listCatalogueIngredients).toHaveBeenLastCalledWith(
      expect.objectContaining({ languages: ["vi"] })
    );
  });

  it("lists the foods filed under none as the roots", async () => {
    await callerFor().list({ rootsOnly: true });

    expect(catalogue.listCatalogueIngredients).toHaveBeenLastCalledWith(
      expect.objectContaining({ parentId: null })
    );

    await callerFor().list({});
    expect(catalogue.listCatalogueIngredients).toHaveBeenLastCalledWith(
      expect.objectContaining({ parentId: undefined })
    );
  });

  it("answers the kinds of a food, with how many kinds each has", async () => {
    catalogue.listCatalogueIngredients.mockResolvedValue([
      {
        id: UIEN,
        name: "red onion",
        flagged: false,
        flagReason: null,
        householdId: HOME,
        version: 1,
        parent: { id: ONION, name: "onion" },
        kinds: 2,
        aliases: [],
      },
    ]);

    await expect(callerFor().kinds({ parentId: ONION })).resolves.toMatchObject([
      { id: UIEN, name: "red onion", kinds: 2, parent: { id: ONION } },
    ]);
    expect(catalogue.listCatalogueIngredients).toHaveBeenLastCalledWith(
      expect.objectContaining({ parentId: ONION })
    );
  });
});

describe("refusals", () => {
  beforeEach(() => ownedBy(ME));

  it("refuses a spelling another Ingredient already holds", async () => {
    catalogue.insertCatalogueAlias.mockResolvedValue(null);
    catalogue.findIngredientIdByFold.mockResolvedValue("some-other-food");

    await expect(callerFor().addAlias({ ingredientId: ONION, text: "ui" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "spelling-taken",
    });
  });

  it("takes a spelling the Ingredient already has as done", async () => {
    catalogue.insertCatalogueAlias.mockResolvedValue(null);
    catalogue.findIngredientIdByFold.mockResolvedValue(ONION);

    await expect(callerFor().addAlias({ ingredientId: ONION, text: "Onion" })).resolves.toEqual({
      success: true,
    });
  });

  it("refuses a name another Ingredient goes by", async () => {
    catalogue.renameCatalogueIngredient.mockRejectedValue(
      Object.assign(new Error("duplicate key"), { code: "23505" })
    );

    await expect(callerFor().rename({ ingredientId: ONION, name: "Garlic" })).rejects.toMatchObject(
      { code: "CONFLICT", message: "name-taken" }
    );
    expect(ingredientsRealtime.published).toHaveLength(0);
  });

  it("refuses a parent that would close a cycle", async () => {
    // The parent sits under the food already.
    relocation.closesCycle.mockResolvedValueOnce(true);

    await expect(
      callerFor().setParent({ ingredientId: ONION, parentId: UIEN })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "cycle" });
    expect(ingredientsRealtime.published).toHaveLength(0);
  });

  it("refuses to merge an Ingredient into itself", async () => {
    await expect(callerFor().merge({ sourceId: ONION, targetId: ONION })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "same-ingredient",
    });
  });

  it("refuses to move an Ingredient's last alias away", async () => {
    relocation.countAliasesOf.mockResolvedValue(1);

    await expect(callerFor().moveAlias({ aliasId: ALIAS, targetId: null })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "last-alias",
    });
  });

  it("refuses to remove an Ingredient's last alias", async () => {
    relocation.countAliasesOf.mockResolvedValueOnce(1);
    await expect(callerFor().removeAlias({ aliasId: ALIAS })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "last-alias",
    });
  });

  it("answers not found for an Ingredient that is gone", async () => {
    catalogue.findCatalogueIngredientOwner.mockResolvedValue(null);

    await expect(callerFor().markDistinct({ ingredientId: ONION })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("the list", () => {
  it("reads one food on its own, whatever filter the page has on, or null once it is gone", async () => {
    catalogue.listCatalogueIngredients.mockResolvedValueOnce([
      {
        id: ONION,
        name: "onion",
        flagged: false,
        flagReason: null,
        householdId: HOME,
        version: 2,
        parent: null,
        kinds: 0,
        aliases: [{ id: ALIAS, text: "onion", householdId: HOME }],
      },
    ]);

    await expect(callerFor().get({ ingredientId: ONION, locale: "en" })).resolves.toMatchObject({
      id: ONION,
      flagged: false,
      canEdit: true,
    });
    expect(catalogue.listCatalogueIngredients).toHaveBeenCalledWith(
      expect.objectContaining({ id: ONION, flaggedOnly: false, search: null })
    );

    catalogue.listCatalogueIngredients.mockResolvedValueOnce([]);
    await expect(callerFor().get({ ingredientId: ONION })).resolves.toBeNull();
  });

  it("says, row by row, what the viewer may do", async () => {
    catalogue.listCatalogueIngredients.mockResolvedValue([
      {
        id: ONION,
        name: "onion",
        flagged: true,
        flagReason: "ai-unsure",
        householdId: ELSEWHERE,
        version: 1,
        parent: null,
        aliases: [
          { id: ALIAS, text: "onions", householdId: HOME },
          { id: "seeded-alias", text: "ui", householdId: null, locale: "nl", seeded: true },
        ],
      },
    ]);

    const page = await callerFor().list({ search: "Onion", flaggedOnly: true, locale: "en" });

    expect(catalogue.listCatalogueIngredients).toHaveBeenCalledWith(
      expect.objectContaining({
        search: {
          fold: "onion",
          words: ["onion"],
          match: "contains",
          fields: ["name", "translations"],
        },
        flaggedOnly: true,
        offset: 0,
      })
    );
    expect(page).toEqual({
      items: [
        {
          id: ONION,
          name: "onion",
          localeNames: { nl: "ui" },
          flagged: true,
          flagReason: "ai-unsure",
          parent: null,
          icon: null,
          ownIcon: false,
          canEdit: false,
          // An English viewer sees the household's own spelling; the Dutch one is counted.
          aliases: [
            {
              id: ALIAS,
              text: "onions",
              locale: null,
              seeded: false,
              canRemove: true,
            },
          ],
          hiddenSpellings: 1,
        },
      ],
      nextCursor: null,
    });
  });

  it("lists every spelling of one Ingredient on request", async () => {
    catalogue.listCatalogueAliasesOf.mockResolvedValue([
      { id: ALIAS, text: "onions", householdId: HOME },
      { id: "seeded-alias", text: "ui", householdId: null, locale: "nl", seeded: true },
    ]);

    await expect(callerFor().spellings({ ingredientId: ONION })).resolves.toEqual([
      { id: ALIAS, text: "onions", locale: null, seeded: false, canRemove: true },
      { id: "seeded-alias", text: "ui", locale: "nl", seeded: true, canRemove: false },
    ]);
  });
});

describe("Ingredient names", () => {
  it("names every food asked in one read, with its spellings, leaving out one that is gone", async () => {
    const onion = { name: "onion", localeNames: { nl: "ui" } };

    aliases.findIngredientDisplayNames.mockResolvedValue(new Map([[ONION, onion]]));

    await expect(callerFor().names({ ids: [ONION, UIEN] })).resolves.toEqual({ [ONION]: onion });
    expect(aliases.findIngredientDisplayNames).toHaveBeenCalledTimes(1);
    expect(aliases.findIngredientDisplayNames).toHaveBeenCalledWith(HOME, [ONION, UIEN]);
  });
});

describe("Ingredient Icons", () => {
  const FILE = "0123456789abcdef0123456789abcdef.webp";

  function picture(type = "image/png") {
    const form = new FormData();

    form.set("ingredientId", ONION);
    form.set("image", new File([new Uint8Array([1, 2, 3])], "onion.png", { type }));

    return form;
  }

  it("answers which icon each food shows, borrowed from its parent where it has none", async () => {
    iconsRepo.findIconLineage.mockResolvedValue(
      new Map([
        [ONION, { id: ONION, parentId: null, offId: null, icon: FILE, householdId: HOME }],
        [UIEN, { id: UIEN, parentId: ONION, offId: null, icon: null, householdId: HOME }],
      ])
    );

    await expect(callerFor().icons({ ids: [ONION, UIEN, ALIAS] })).resolves.toEqual({
      [ONION]: `/ingredient-icons/${FILE}`,
      [UIEN]: `/ingredient-icons/${FILE}`,
      [ALIAS]: null,
    });
  });

  // [owner, may the member set the icon?]; another household's food is not found at all.
  const matrix: Array<[string | null, boolean]> = [
    [ME, true],
    [HOUSEMATE, true],
    [STRANGER, false],
    // A seeded food is an administrator's.
    [null, false],
  ];
  const refusalFor = (owner: string | null) => (owner === null ? "FORBIDDEN" : "NOT_FOUND");

  it.each(matrix)(
    "uploading an icon for a food owned by %s is allowed: %s",
    async (owner, allowed) => {
      ownedBy(owner);

      const upload = callerFor().uploadIcon(picture());

      if (allowed) {
        await expect(upload).resolves.toEqual({ file: FILE, address: `/ingredient-icons/${FILE}` });
        expect(iconFiles.storeIngredientIcon).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
      } else {
        await expect(upload).rejects.toMatchObject({ code: refusalFor(owner) });
        expect(iconFiles.storeIngredientIcon).not.toHaveBeenCalled();
      }
    }
  );

  it.each(matrix)(
    "saving a draft icon for a food owned by %s is allowed: %s",
    async (owner, allowed) => {
      ownedBy(owner);

      const save = callerFor().saveDraft({ ingredientId: ONION, add: [], remove: [], icon: FILE });

      if (allowed) {
        await expect(save).resolves.toEqual({ success: true });
        expect(iconsRepo.setIngredientIcon).toHaveBeenCalledWith(TX, ONION, FILE);
        expect(ingredientsRealtime.published).toEqual([
          expect.objectContaining({ event: "changed", payload: { ingredientIds: [ONION] } }),
        ]);
      } else {
        await expect(save).rejects.toMatchObject({ code: refusalFor(owner) });
        expect(iconsRepo.setIngredientIcon).not.toHaveBeenCalled();
      }
    }
  );

  it("lets an administrator set a seeded food's icon, and remove it", async () => {
    ownedBy(null);

    await expect(callerFor({ admin: true }).uploadIcon(picture())).resolves.toMatchObject({
      file: FILE,
    });
    await callerFor({ admin: true }).saveDraft({
      ingredientId: ONION,
      add: [],
      remove: [],
      icon: null,
    });
    expect(iconsRepo.setIngredientIcon).toHaveBeenCalledWith(TX, ONION, null);
  });

  it("refuses a draft icon no upload stored", async () => {
    ownedBy(ME);
    iconFiles.claimOwnIcon.mockResolvedValueOnce(false);

    await expect(
      callerFor().saveDraft({ ingredientId: ONION, add: [], remove: [], icon: FILE })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(iconsRepo.setIngredientIcon).not.toHaveBeenCalled();
  });

  it("takes only a stored icon's file name, never a path", async () => {
    await expect(
      callerFor().saveDraft({ ingredientId: ONION, add: [], remove: [], icon: "../../etc/passwd" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses something other than a picture", async () => {
    ownedBy(ME);

    await expect(callerFor().uploadIcon(picture("application/pdf"))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(iconFiles.storeIngredientIcon).not.toHaveBeenCalled();
  });

  it("generates a food's icon from its name and what it is a kind of, for the draft", async () => {
    ownedBy(ME);
    iconsRepo.findIconLineage.mockResolvedValue(
      new Map([
        [
          UIEN,
          { id: UIEN, name: "uien", parentId: ONION, offId: null, icon: null, householdId: HOME },
        ],
        [
          ONION,
          { id: ONION, name: "onion", parentId: null, offId: null, icon: null, householdId: HOME },
        ],
      ])
    );
    aliases.findLocaleNames.mockResolvedValueOnce(new Map([[UIEN, { en: "onions" }]]));

    await expect(callerFor().generateIcon({ ingredientId: UIEN })).resolves.toEqual({
      file: FILE,
      address: `/ingredient-icons/${FILE}`,
    });
    expect(drawer.drawIngredientIcon).toHaveBeenCalledWith({ name: "onions", kindOf: ["onion"] });
    expect(iconFiles.storeIngredientIcon).toHaveBeenCalledWith(Buffer.from([9, 9]));
    // Nothing is set until the draft is saved.
    expect(iconsRepo.setIngredientIcon).not.toHaveBeenCalled();
  });

  it("refuses to generate where nothing can draw", async () => {
    ownedBy(ME);
    policy.canDrawImages.mockResolvedValueOnce(false);

    await expect(callerFor().generateIcon({ ingredientId: ONION })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(drawer.drawIngredientIcon).not.toHaveBeenCalled();
  });

  it.each(matrix)(
    "generating an icon for a food owned by %s is allowed: %s",
    async (owner, allowed) => {
      ownedBy(owner);
      iconsRepo.findIconLineage.mockResolvedValue(
        new Map([[ONION, { id: ONION, name: "onion", parentId: null, offId: null, icon: null }]])
      );

      const generate = callerFor().generateIcon({ ingredientId: ONION });

      if (allowed) {
        await expect(generate).resolves.toMatchObject({ file: FILE });
      } else {
        await expect(generate).rejects.toMatchObject({ code: refusalFor(owner) });
        expect(drawer.drawIngredientIcon).not.toHaveBeenCalled();
      }
    }
  );
});
