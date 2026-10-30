// @vitest-environment node
/**
 * The Ingredients page's procedures under the ingredient permission policy.
 * The catalogue repository and the policy are mocked; what is pinned here is
 * who may do what to whose Ingredient, and that a refused edit writes nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionLevel } from "@norish/config/zod/server-config";
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
  insertCatalogueIngredient: vi.fn(),
  lockIngredientNamed: vi.fn(async () => null),
  lockFoods: vi.fn(async () => true),
  lockIngredients: vi.fn(async (_tx: unknown, ids: readonly string[]) => ids.length),
  lockTree: vi.fn(),
  mergeCatalogueIngredients: vi.fn(),
  moveCatalogueAlias: vi.fn(),
  setCatalogueIngredientParent: vi.fn(),
  writeGroceryParts: vi.fn(),
}));
// What a deleted food named, resolved again: nothing, here.
const cleanup = vi.hoisted(() => ({
  findRowsNamingFood: vi.fn(async () => ({ lines: [], groceries: [], recurring: [] })),
  repointLines: vi.fn(),
}));
const aliases = vi.hoisted(() => ({ findLocaleNames: vi.fn(async () => new Map()) }));
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
  getIngredientPermissionPolicy: vi.fn(),
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

function callerFor(options: { admin?: boolean } = {}) {
  const ctx = createMockAuthedContext(
    createMockUser({ isServerAdmin: options.admin ?? false }),
    createMockHousehold()
  );

  return ingredientsRouter.createCaller(createMockCallerContext(ctx));
}

function withPolicy(edit: PermissionLevel) {
  policy.getIngredientPermissionPolicy.mockResolvedValue({ edit });
}

function ownedBy(ownerId: string | null) {
  catalogue.findCatalogueIngredientOwner.mockResolvedValue({ ownerId });
  catalogue.findCatalogueAliasOwner.mockResolvedValue({
    ownerId,
    ingredientId: ONION,
    text: "ui",
    fold: "ui",
  });
}

beforeEach(() => {
  ingredientsRealtime.reset();
  withPolicy("household");
  relocation.mergeCatalogueIngredients.mockResolvedValue(true);
  relocation.countAliasesOf.mockResolvedValue(2);
  relocation.findIngredientAncestors.mockResolvedValue(new Map());
  relocation.insertCatalogueIngredient.mockResolvedValue(UIEN);
  catalogue.renameCatalogueIngredient.mockResolvedValue({ id: ONION });
  catalogue.keepIngredientDistinct.mockResolvedValue({ id: ONION });
  catalogue.insertCatalogueAlias.mockResolvedValue({ id: ALIAS, text: "Onion", ownerId: ME });
});

describe("the edit policy", () => {
  // [policy, owner, may the member edit?]
  const matrix: Array<[PermissionLevel, string, boolean]> = [
    ["everyone", ME, true],
    ["everyone", HOUSEMATE, true],
    ["everyone", STRANGER, true],
    ["household", ME, true],
    ["household", HOUSEMATE, true],
    ["household", STRANGER, false],
    ["owner", ME, true],
    ["owner", HOUSEMATE, false],
    ["owner", STRANGER, false],
  ];

  it.each(matrix)(
    "under %s, renaming an Ingredient owned by %s is allowed: %s",
    async (level, owner, allowed) => {
      withPolicy(level);
      ownedBy(owner);

      const rename = callerFor().rename({ ingredientId: ONION, name: "Onion" });

      if (allowed) {
        await expect(rename).resolves.toEqual({ success: true });
        expect(catalogue.renameCatalogueIngredient).toHaveBeenCalledWith(TX, ONION, "Onion");
      } else {
        await expect(rename).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(catalogue.renameCatalogueIngredient).not.toHaveBeenCalled();
      }
    }
  );

  it.each(matrix)(
    "under %s, marking distinct an Ingredient owned by %s is allowed: %s",
    async (level, owner, allowed) => {
      withPolicy(level);
      ownedBy(owner);

      const mark = callerFor().markDistinct({ ingredientId: ONION });

      if (allowed) {
        await expect(mark).resolves.toEqual({ success: true });
        expect(ingredientsRealtime.published).toEqual([
          expect.objectContaining({ event: "changed", payload: { ingredientIds: [ONION] } }),
        ]);
      } else {
        await expect(mark).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(ingredientsRealtime.published).toHaveLength(0);
      }
    }
  );

  it.each(matrix)(
    "under %s, deleting an Ingredient owned by %s is allowed: %s",
    async (level, owner, allowed) => {
      withPolicy(level);
      ownedBy(owner);

      const remove = callerFor().remove({ ingredientId: ONION });

      if (allowed) {
        await expect(remove).resolves.toEqual({ success: true });
        expect(catalogue.deleteCatalogueIngredient).toHaveBeenCalledWith(TX, ONION);
        expect(ingredientsRealtime.published).toEqual([
          expect.objectContaining({ event: "changed", payload: { ingredientIds: [ONION] } }),
        ]);
      } else {
        await expect(remove).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(catalogue.deleteCatalogueIngredient).not.toHaveBeenCalled();
      }
    }
  );

  it.each(matrix)(
    "under %s, removing an alias added by %s is allowed: %s",
    async (level, owner, allowed) => {
      withPolicy(level);
      ownedBy(owner);

      const remove = callerFor().removeAlias({ aliasId: ALIAS });

      if (allowed) {
        await expect(remove).resolves.toEqual({ success: true });
        expect(ingredientsRealtime.published).toEqual([
          expect.objectContaining({ event: "changed", payload: { ingredientIds: [ONION] } }),
        ]);
      } else {
        await expect(remove).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(catalogue.deleteCatalogueAlias).not.toHaveBeenCalled();
      }
    }
  );

  it("puts a draft's spelling marked as not a food on the junk pile, and a plain removal nowhere", async () => {
    withPolicy("everyone");
    ownedBy(ME);
    relocation.countAliasesOf.mockResolvedValue(3);

    await expect(
      callerFor().saveDraft({ ingredientId: ONION, add: [], remove: [ALIAS], junk: [ALIAS] })
    ).resolves.toEqual({ success: true });
    expect(junkPile.addToJunkPile).toHaveBeenCalledWith(TX, ["ui"], { reason: "person" });

    junkPile.addToJunkPile.mockClear();
    await callerFor().saveDraft({ ingredientId: ONION, add: [], remove: [ALIAS] });
    expect(junkPile.addToJunkPile).not.toHaveBeenCalled();
  });

  it("leaves a seeded, ownerless Ingredient to administrators, whatever the policy", async () => {
    withPolicy("everyone");
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

  it("lets an administrator past the policy", async () => {
    withPolicy("owner");
    ownedBy(STRANGER);

    await expect(callerFor({ admin: true }).markDistinct({ ingredientId: ONION })).resolves.toEqual(
      { success: true }
    );
    await expect(callerFor({ admin: true }).removeAlias({ aliasId: ALIAS })).resolves.toEqual({
      success: true,
    });
  });

  it.each(matrix)(
    "under %s, setting the parent of an Ingredient owned by %s is allowed: %s",
    async (level, owner, allowed) => {
      withPolicy(level);
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
        await expect(set).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(relocation.setCatalogueIngredientParent).not.toHaveBeenCalled();
      }
    }
  );

  it.each(matrix)(
    "under %s, moving an alias added by %s is allowed: %s",
    async (level, owner, allowed) => {
      withPolicy(level);
      ownedBy(owner);

      const move = callerFor().moveAlias({ aliasId: ALIAS, targetId: UIEN });

      if (allowed) {
        await expect(move).resolves.toEqual({ success: true });
        expect(relocation.moveCatalogueAlias).toHaveBeenCalledWith(TX, ALIAS, UIEN);
      } else {
        await expect(move).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(relocation.moveCatalogueAlias).not.toHaveBeenCalled();
      }
    }
  );

  it("moves an alias out to a new Ingredient the member owns, named for it", async () => {
    ownedBy(ME);

    await callerFor().moveAlias({ aliasId: ALIAS, targetId: null });

    expect(relocation.insertCatalogueIngredient).toHaveBeenCalledWith(TX, {
      name: "ui",
      ownerId: ME,
    });
    expect(relocation.moveCatalogueAlias).toHaveBeenCalledWith(TX, ALIAS, UIEN);
  });

  it.each([
    ["the source", STRANGER, ME],
    ["the target", ME, STRANGER],
  ])(
    "refuses a merge when the member may not edit %s",
    async (_which, sourceOwner, targetOwner) => {
      withPolicy("household");
      catalogue.findCatalogueIngredientOwner.mockImplementation(
        async (_tx: unknown, id: string) => ({
          ownerId: id === UIEN ? sourceOwner : targetOwner,
        })
      );

      await expect(callerFor().merge({ sourceId: UIEN, targetId: ONION })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(relocation.mergeCatalogueIngredients).not.toHaveBeenCalled();
    }
  );

  it("merges where the member may edit both, and tells every client", async () => {
    withPolicy("household");
    catalogue.findCatalogueIngredientOwner.mockImplementation(async (_tx: unknown, id: string) => ({
      ownerId: id === UIEN ? HOUSEMATE : ME,
    }));

    await expect(callerFor().merge({ sourceId: UIEN, targetId: ONION })).resolves.toEqual({
      success: true,
    });
    expect(relocation.mergeCatalogueIngredients).toHaveBeenCalledWith(TX, UIEN, ONION);
    expect(ingredientsRealtime.published).toEqual([
      expect.objectContaining({ event: "changed", payload: { ingredientIds: [UIEN, ONION] } }),
    ]);
  });

  it("leaves a merge of seeded Ingredients to administrators", async () => {
    withPolicy("everyone");
    ownedBy(null);

    await expect(callerFor().merge({ sourceId: UIEN, targetId: ONION })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      callerFor({ admin: true }).merge({ sourceId: UIEN, targetId: ONION })
    ).resolves.toEqual({ success: true });
  });

  it("lets anyone add an alias, to a seeded Ingredient too", async () => {
    withPolicy("owner");
    ownedBy(null);
    catalogue.insertCatalogueAlias.mockResolvedValue({ id: ALIAS, text: "ajuin", ownerId: ME });

    await expect(callerFor().addAlias({ ingredientId: ONION, text: "ajuin" })).resolves.toEqual({
      success: true,
    });
    expect(catalogue.insertCatalogueAlias).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ ingredientId: ONION, text: "ajuin", ownerId: ME })
    );
    expect(ingredientsRealtime.published).toEqual([
      expect.objectContaining({ event: "changed", payload: { ingredientIds: [ONION] } }),
    ]);
  });

  it("makes a new name one of the Ingredient's spellings", async () => {
    ownedBy(ME);

    await callerFor().rename({ ingredientId: ONION, name: "Yellow onion" });

    expect(catalogue.insertCatalogueAlias).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ ingredientId: ONION, text: "Yellow onion", ownerId: ME })
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
      householdUserIds: [ME, HOUSEMATE],
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
    withPolicy("household");
    catalogue.listCatalogueIngredients.mockResolvedValue([]);
  });

  it("lists the foods with neither parent nor kinds on request", async () => {
    await callerFor().list({ standaloneOnly: true });

    expect(catalogue.listCatalogueIngredients).toHaveBeenLastCalledWith(
      expect.objectContaining({ standaloneOnly: true })
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
        ownerId: ME,
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
        ownerId: ME,
        version: 2,
        parent: null,
        kinds: 0,
        aliases: [{ id: ALIAS, text: "onion", ownerId: ME }],
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
    withPolicy("household");
    catalogue.listCatalogueIngredients.mockResolvedValue([
      {
        id: ONION,
        name: "onion",
        flagged: true,
        flagReason: "ai-unsure",
        ownerId: STRANGER,
        version: 1,
        parent: null,
        aliases: [
          { id: ALIAS, text: "onions", ownerId: HOUSEMATE },
          { id: "seeded-alias", text: "ui", ownerId: null, locale: "nl", seeded: true },
        ],
      },
    ]);

    const page = await callerFor().list({ search: "Onion", flaggedOnly: true, locale: "en" });

    expect(catalogue.listCatalogueIngredients).toHaveBeenCalledWith(
      expect.objectContaining({
        search: {
          fold: "onion",
          pattern: "%onion%",
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
    withPolicy("household");
    catalogue.listCatalogueAliasesOf.mockResolvedValue([
      { id: ALIAS, text: "onions", ownerId: HOUSEMATE },
      { id: "seeded-alias", text: "ui", ownerId: null, locale: "nl", seeded: true },
    ]);

    await expect(callerFor().spellings({ ingredientId: ONION })).resolves.toEqual([
      { id: ALIAS, text: "onions", locale: null, seeded: false, canRemove: true },
      { id: "seeded-alias", text: "ui", locale: "nl", seeded: true, canRemove: false },
    ]);
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
        [ONION, { id: ONION, parentId: null, offId: null, icon: FILE, ownerId: ME }],
        [UIEN, { id: UIEN, parentId: ONION, offId: null, icon: null, ownerId: ME }],
      ])
    );

    await expect(callerFor().icons({ ids: [ONION, UIEN, ALIAS] })).resolves.toEqual({
      [ONION]: `/ingredient-icons/${FILE}`,
      [UIEN]: `/ingredient-icons/${FILE}`,
      [ALIAS]: null,
    });
  });

  // [policy, owner, may the member set the icon?]
  const matrix: Array<[PermissionLevel, string | null, boolean]> = [
    ["everyone", STRANGER, true],
    ["household", HOUSEMATE, true],
    ["household", STRANGER, false],
    ["owner", ME, true],
    ["owner", HOUSEMATE, false],
    // A seeded food is an administrator's, whatever the policy.
    ["everyone", null, false],
  ];

  it.each(matrix)(
    "under %s, uploading an icon for a food owned by %s is allowed: %s",
    async (level, owner, allowed) => {
      withPolicy(level);
      ownedBy(owner);

      const upload = callerFor().uploadIcon(picture());

      if (allowed) {
        await expect(upload).resolves.toEqual({ file: FILE, address: `/ingredient-icons/${FILE}` });
        expect(iconFiles.storeIngredientIcon).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
      } else {
        await expect(upload).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(iconFiles.storeIngredientIcon).not.toHaveBeenCalled();
      }
    }
  );

  it.each(matrix)(
    "under %s, saving a draft icon for a food owned by %s is allowed: %s",
    async (level, owner, allowed) => {
      withPolicy(level);
      ownedBy(owner);

      const save = callerFor().saveDraft({ ingredientId: ONION, add: [], remove: [], icon: FILE });

      if (allowed) {
        await expect(save).resolves.toEqual({ success: true });
        expect(iconsRepo.setIngredientIcon).toHaveBeenCalledWith(TX, ONION, FILE);
        expect(ingredientsRealtime.published).toEqual([
          expect.objectContaining({ event: "changed", payload: { ingredientIds: [ONION] } }),
        ]);
      } else {
        await expect(save).rejects.toMatchObject({ code: "FORBIDDEN" });
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
        [UIEN, { id: UIEN, name: "uien", parentId: ONION, offId: null, icon: null, ownerId: ME }],
        [ONION, { id: ONION, name: "onion", parentId: null, offId: null, icon: null, ownerId: ME }],
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
    "under %s, generating an icon for a food owned by %s is allowed: %s",
    async (level, owner, allowed) => {
      withPolicy(level);
      ownedBy(owner);
      iconsRepo.findIconLineage.mockResolvedValue(
        new Map([[ONION, { id: ONION, name: "onion", parentId: null, offId: null, icon: null }]])
      );

      const generate = callerFor().generateIcon({ ingredientId: ONION });

      if (allowed) {
        await expect(generate).resolves.toMatchObject({ file: FILE });
      } else {
        await expect(generate).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(drawer.drawIngredientIcon).not.toHaveBeenCalled();
      }
    }
  );
});
