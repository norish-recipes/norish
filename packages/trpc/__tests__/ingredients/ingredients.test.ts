// @vitest-environment node
/**
 * The Ingredients page's procedures under the ingredient permission policy.
 * The catalogue repository and the policy are mocked; what is pinned here is
 * who may do what to whose Ingredient, and that a refused edit writes nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionLevel } from "@norish/config/zod/server-config";

import { ingredientsRouter } from "../../src/routers/ingredients";
import {
  createMockAuthedContext,
  createMockCallerContext,
  createMockHousehold,
  createMockUser,
} from "../calendar/test-utils";

const catalogue = vi.hoisted(() => ({
  clearIngredientFlag: vi.fn(),
  deleteCatalogueAlias: vi.fn(),
  findCatalogueAliasOwner: vi.fn(),
  findCatalogueIngredientOwner: vi.fn(),
  findIngredientIdByFold: vi.fn(),
  insertCatalogueAlias: vi.fn(),
  isIngredientNameTaken: vi.fn(),
  listCatalogueIngredients: vi.fn(),
  renameCatalogueIngredient: vi.fn(),
}));
const policy = vi.hoisted(() => ({ getIngredientPermissionPolicy: vi.fn() }));

vi.mock("@norish/db/repositories/ingredient-catalogue", () => catalogue);
vi.mock("@norish/shared-server/config/server-config-loader", () => policy);
vi.mock("@norish/shared-server/ingredients/resolver", () => import("../mocks/ingredient-resolver"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const ONION = "11111111-1111-4111-8111-111111111111";
const ALIAS = "22222222-2222-4222-8222-222222222222";
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
  catalogue.findCatalogueAliasOwner.mockResolvedValue({ ownerId, ingredientId: ONION });
}

beforeEach(() => {
  vi.clearAllMocks();
  withPolicy("household");
  catalogue.isIngredientNameTaken.mockResolvedValue(false);
  catalogue.renameCatalogueIngredient.mockResolvedValue({ id: ONION });
  catalogue.clearIngredientFlag.mockResolvedValue({ id: ONION });
  catalogue.deleteCatalogueAlias.mockResolvedValue("deleted");
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
        expect(catalogue.renameCatalogueIngredient).toHaveBeenCalledWith(ONION, "Onion");
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

      if (allowed) await expect(mark).resolves.toEqual({ success: true });
      else await expect(mark).rejects.toMatchObject({ code: "FORBIDDEN" });
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
      } else {
        await expect(remove).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(catalogue.deleteCatalogueAlias).not.toHaveBeenCalled();
      }
    }
  );

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

  it("lets anyone add an alias, to a seeded Ingredient too", async () => {
    withPolicy("owner");
    ownedBy(null);
    catalogue.insertCatalogueAlias.mockResolvedValue({ id: ALIAS, text: "ajuin", ownerId: ME });

    await expect(callerFor().addAlias({ ingredientId: ONION, text: "ajuin" })).resolves.toEqual({
      success: true,
    });
    expect(catalogue.insertCatalogueAlias).toHaveBeenCalledWith(
      expect.objectContaining({ ingredientId: ONION, text: "ajuin", ownerId: ME })
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
    catalogue.isIngredientNameTaken.mockResolvedValue(true);

    await expect(callerFor().rename({ ingredientId: ONION, name: "Garlic" })).rejects.toMatchObject(
      { code: "CONFLICT", message: "name-taken" }
    );
    expect(catalogue.renameCatalogueIngredient).not.toHaveBeenCalled();
  });

  it("refuses to remove an Ingredient's last alias, or one something points at", async () => {
    catalogue.deleteCatalogueAlias.mockResolvedValueOnce("last");
    await expect(callerFor().removeAlias({ aliasId: ALIAS })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "last-alias",
    });

    catalogue.deleteCatalogueAlias.mockResolvedValueOnce("in-use");
    await expect(callerFor().removeAlias({ aliasId: ALIAS })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "alias-in-use",
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
  it("says, row by row, what the viewer may do", async () => {
    withPolicy("household");
    catalogue.listCatalogueIngredients.mockResolvedValue([
      {
        id: ONION,
        name: "onion",
        flagged: true,
        ownerId: STRANGER,
        version: 1,
        aliases: [
          { id: ALIAS, text: "onions", ownerId: HOUSEMATE },
          { id: "seeded-alias", text: "ui", ownerId: null },
        ],
      },
    ]);

    const page = await callerFor().list({ search: "Onion", flaggedOnly: true });

    expect(catalogue.listCatalogueIngredients).toHaveBeenCalledWith(
      expect.objectContaining({
        search: { lower: "onion", fold: "onion" },
        flaggedOnly: true,
        offset: 0,
      })
    );
    expect(page).toEqual({
      items: [
        {
          id: ONION,
          name: "onion",
          flagged: true,
          version: 1,
          canEdit: false,
          aliases: [
            { id: ALIAS, text: "onions", canRemove: true },
            { id: "seeded-alias", text: "ui", canRemove: false },
          ],
        },
      ],
      nextCursor: null,
    });
  });
});
