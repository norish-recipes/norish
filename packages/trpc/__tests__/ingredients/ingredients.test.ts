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
import { isAIEnabled } from "../mocks/permissions";
import { ingredients as ingredientsRealtime } from "../mocks/realtime/ingredients";

const catalogue = vi.hoisted(() => ({
  keepIngredientDistinct: vi.fn(),
  deleteCatalogueAlias: vi.fn(),
  deleteCatalogueIngredient: vi.fn(),
  findCatalogueAliasOwner: vi.fn(),
  findCatalogueIngredient: vi.fn(),
  findCatalogueIngredientNames: vi.fn(),
  findCatalogueIngredientOwner: vi.fn(),
  findIngredientIdByFold: vi.fn(),
  insertCatalogueAlias: vi.fn(),
  isAliasInUse: vi.fn(),
  isIngredientInUse: vi.fn(),
  listCatalogueAliasesOf: vi.fn(),
  listCatalogueIngredients: vi.fn(),
  renameCatalogueIngredient: vi.fn(),
}));
const relocation = vi.hoisted(() => ({
  countAliasesOf: vi.fn(),
  findIngredientAncestors: vi.fn(),
  insertCatalogueIngredient: vi.fn(),
  lockIngredients: vi.fn(async (_tx: unknown, ids: readonly string[]) => ids.length),
  lockTree: vi.fn(),
  mergeCatalogueIngredients: vi.fn(),
  moveCatalogueAlias: vi.fn(),
  setCatalogueIngredientParent: vi.fn(),
}));
const aliases = vi.hoisted(() => ({ findLocaleNames: vi.fn(async () => new Map()) }));
const iconsRepo = vi.hoisted(() => ({
  findIconLineage: vi.fn(async (): Promise<Map<string, unknown>> => new Map()),
  setIngredientIcon: vi.fn(async () => true),
}));
const iconFiles = vi.hoisted(() => ({
  storeIngredientIcon: vi.fn(async () => "0123456789abcdef0123456789abcdef.webp"),
  ownIconExists: vi.fn(async () => true),
}));
const policy = vi.hoisted(() => ({ getIngredientPermissionPolicy: vi.fn() }));
const suggestionsRepo = vi.hoisted(() => ({
  deleteIngredientSuggestion: vi.fn(),
  deleteSuggestionFor: vi.fn(),
  findIngredientSuggestions: vi.fn(async (): Promise<unknown[]> => []),
  listIngredientSuggestions: vi.fn(async (): Promise<unknown[]> => []),
}));
const reviewer = vi.hoisted(() => ({
  reviewFlaggedWithAI: vi.fn(),
  findParentWithAI: vi.fn(),
  listReviewableIngredients: vi.fn(async (): Promise<unknown[]> => []),
  estimateReviewTokens: vi.fn(async (): Promise<unknown[]> => []),
}));

const reviewQueue = vi.hoisted(() => ({
  add: vi.fn(async () => ({ id: "round-1" })),
  getJobs: vi.fn(async () => []),
  getJob: vi.fn(async (): Promise<unknown> => null),
}));

// Each edit is one transaction; here it is the mocked repositories' to ignore.
const TX = vi.hoisted(() => ({ tx: true }));

vi.mock("@norish/db/drizzle", () => ({
  withTransaction: (run: (tx: unknown) => unknown) => run(TX),
}));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/queue/registry", () => ({ getQueues: () => ({ ingredientReview: reviewQueue }) }));
vi.mock("@norish/queue/redis/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/db/repositories/ingredient-catalogue", () => catalogue);
vi.mock("@norish/db/repositories/ingredient-relocation", () => relocation);
vi.mock("@norish/db/repositories/ingredient-aliases", () => aliases);
vi.mock("@norish/db/repositories/ingredient-icons", () => iconsRepo);
vi.mock("@norish/shared-server/media/ingredient-icon", async (original) => ({
  ...(await original<typeof import("@norish/shared-server/media/ingredient-icon")>()),
  ...iconFiles,
}));
vi.mock("@norish/db/repositories/ingredient-suggestions", () => suggestionsRepo);
vi.mock("@norish/shared-server/ingredients/review", () => reviewer);
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
  catalogue.findCatalogueAliasOwner.mockResolvedValue({ ownerId, ingredientId: ONION, text: "ui" });
}

beforeEach(() => {
  vi.clearAllMocks();
  ingredientsRealtime.reset();
  withPolicy("household");
  relocation.mergeCatalogueIngredients.mockResolvedValue(true);
  relocation.countAliasesOf.mockResolvedValue(2);
  relocation.findIngredientAncestors.mockResolvedValue(new Map());
  relocation.insertCatalogueIngredient.mockResolvedValue(UIEN);
  catalogue.renameCatalogueIngredient.mockResolvedValue({ id: ONION });
  catalogue.keepIngredientDistinct.mockResolvedValue({ id: ONION });
  catalogue.isAliasInUse.mockResolvedValue(false);
  catalogue.isIngredientInUse.mockResolvedValue(false);
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

describe("asking AI about a flagged Ingredient", () => {
  it("answers what came of it, and announces the change", async () => {
    reviewer.reviewFlaggedWithAI.mockResolvedValue({ outcome: "merge", into: "onion" });

    await expect(callerFor().reviewWithAI({ ingredientId: UIEN })).resolves.toEqual({
      outcome: "merge",
      into: "onion",
    });
    expect(ingredientsRealtime.published).toEqual([
      expect.objectContaining({ event: "changed", payload: { ingredientIds: [UIEN] } }),
    ]);
  });

  it("announces nothing where nothing was flagged", async () => {
    reviewer.reviewFlaggedWithAI.mockResolvedValue({ outcome: "not-flagged" });

    await callerFor().reviewWithAI({ ingredientId: UIEN });

    expect(ingredientsRealtime.published).toHaveLength(0);
  });
});

describe("a round of Ask AI over flagged Ingredients", () => {
  beforeEach(() => {
    reviewQueue.add.mockClear();
    reviewQueue.getJobs.mockReset();
    reviewQueue.getJobs.mockResolvedValue([]);
    reviewer.listReviewableIngredients.mockReset().mockResolvedValue([]);
    reviewer.estimateReviewTokens.mockReset().mockResolvedValue([]);
  });

  it("queues one job over the flagged foods the server picks for the scope, and answers the job to watch", async () => {
    reviewer.listReviewableIngredients.mockResolvedValue([
      { id: UIEN, name: "uien", ownerId: ME, suggested: false },
      { id: ONION, name: "onion", ownerId: HOUSEMATE, suggested: false },
    ]);

    await expect(
      callerFor().reviewAllWithAI({ mode: "review", scope: "unsuggested" })
    ).resolves.toEqual({ jobId: "round-1", total: 2, pending: [UIEN, ONION] });

    // The foods are the whole catalogue's the asker may edit, not a page's.
    expect(reviewer.listReviewableIngredients).toHaveBeenCalledExactlyOnceWith(
      { userId: ME, householdUserIds: [ME, HOUSEMATE], isServerAdmin: false },
      "unsuggested"
    );
    expect(reviewQueue.add).toHaveBeenCalledExactlyOnceWith("review", {
      ingredients: [
        { id: UIEN, name: "uien" },
        { id: ONION, name: "onion" },
      ],
      mode: "review",
      actor: { userId: ME, householdUserIds: [ME, HOUSEMATE], isServerAdmin: false },
    });
    // Nothing is asked here: the round asks, and announces, from the worker.
    expect(reviewer.reviewFlaggedWithAI).not.toHaveBeenCalled();
    expect(ingredientsRealtime.published).toHaveLength(0);
  });

  it("asks what each food on the page is a kind of instead, when told to", async () => {
    catalogue.findCatalogueIngredientNames.mockResolvedValue(new Map([[UIEN, "uien"]]));

    await expect(
      callerFor().reviewAllWithAI({ mode: "parent", ingredientIds: [UIEN, ONION] })
    ).resolves.toEqual({ jobId: "round-1", total: 2, pending: [UIEN, ONION] });

    // A food the catalogue no longer names keeps its id as its name.
    expect(reviewQueue.add).toHaveBeenCalledExactlyOnceWith(
      "review",
      expect.objectContaining({
        mode: "parent",
        ingredients: [
          { id: UIEN, name: "uien" },
          { id: ONION, name: ONION },
        ],
      })
    );
    expect(reviewer.listReviewableIngredients).not.toHaveBeenCalled();
  });

  it("says how many foods each scope holds, and the tokens a food took in the last round", async () => {
    reviewer.listReviewableIngredients.mockResolvedValue([
      { id: UIEN, name: "uien", ownerId: ME, suggested: false },
      { id: ONION, name: "onion", ownerId: ME, suggested: true },
    ]);
    reviewQueue.getJobs.mockImplementation((async (types: string[]) =>
      types.includes("completed")
        ? [
            {
              id: "round-0",
              data: { ingredients: [{ id: UIEN, name: "uien" }] },
              progress: {
                step: "asking-ai:1/1",
                updatedAt: 1,
                attempts: [
                  {
                    attempt: 1,
                    timeline: [
                      {
                        id: "asking-ai:1/1",
                        startedAt: 1,
                        endedAt: 2,
                        detail: { ingredientId: UIEN, outcome: "distinct" },
                      },
                    ],
                    models: [
                      { provider: "openai", model: "gpt", outcome: "completed", tokens: 1864 },
                      { provider: "typesafe", model: "jev", outcome: "completed", tokens: 1689 },
                    ],
                  },
                ],
              },
            },
          ]
        : []) as never);

    await expect(callerFor().reviewScope()).resolves.toEqual({
      flagged: 2,
      unsuggested: 1,
      tokens: {
        basis: "measured",
        foods: 1,
        models: [
          { provider: "openai", model: "gpt", perFood: 1864 },
          { provider: "typesafe", model: "jev", perFood: 1689 },
        ],
      },
    });
    expect(reviewer.estimateReviewTokens).not.toHaveBeenCalled();
  });

  it("counts a food's tokens from the prompt before any round was measured", async () => {
    reviewer.listReviewableIngredients.mockResolvedValue([
      { id: UIEN, name: "uien", ownerId: ME, suggested: false },
    ]);
    const models = [{ provider: "openai", model: "gpt-5.6-luna", perFood: 2600 }];

    reviewer.estimateReviewTokens.mockResolvedValue(models);

    await expect(callerFor().reviewScope()).resolves.toEqual({
      flagged: 1,
      unsuggested: 1,
      tokens: { basis: "prompt", models },
    });
    expect(reviewer.estimateReviewTokens).toHaveBeenCalledWith(["uien"]);
  });

  it("refuses every AI question while AI is off for the instance", async () => {
    isAIEnabled.mockResolvedValue(false);

    await expect(callerFor().reviewWithAI({ ingredientId: UIEN })).rejects.toThrow(
      "AI features are disabled"
    );
    await expect(callerFor().findParentWithAI({ ingredientId: UIEN })).rejects.toThrow(
      "AI features are disabled"
    );
    await expect(callerFor().reviewAllWithAI({ mode: "review", scope: "flagged" })).rejects.toThrow(
      "AI features are disabled"
    );
    await expect(callerFor().reviewScope()).rejects.toThrow("AI features are disabled");
    expect(reviewer.reviewFlaggedWithAI).not.toHaveBeenCalled();
    expect(reviewer.listReviewableIngredients).not.toHaveBeenCalled();
    expect(reviewQueue.add).not.toHaveBeenCalled();
    isAIEnabled.mockResolvedValue(true);
  });

  it("asks what one food is a kind of, and announces the suggestion", async () => {
    reviewer.findParentWithAI.mockResolvedValueOnce({
      outcome: "parent",
      of: "onion",
      considered: ["onion"],
      englishName: null,
    });

    await expect(callerFor().findParentWithAI({ ingredientId: UIEN })).resolves.toMatchObject({
      outcome: "parent",
      of: "onion",
    });
    expect(reviewer.findParentWithAI).toHaveBeenCalledWith(expect.anything(), UIEN);
    expect(ingredientsRealtime.published).toHaveLength(1);
  });

  it("asks about nothing without a food", async () => {
    await expect(
      callerFor().reviewAllWithAI({ mode: "parent", ingredientIds: [] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // Nothing left in the scope by the time the round would start.
    await expect(
      callerFor().reviewAllWithAI({ mode: "review", scope: "unsuggested" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(reviewQueue.add).not.toHaveBeenCalled();
  });

  it("tells a page that opens mid-round how far the round is", async () => {
    reviewQueue.getJobs.mockResolvedValue([
      {
        id: "round-1",
        data: {
          ingredients: [
            { id: UIEN, name: "uien" },
            { id: ONION, name: "onion" },
          ],
        },
        progress: {},
      },
    ]);

    await expect(callerFor().reviewRound()).resolves.toEqual({
      jobId: "round-1",
      done: 0,
      total: 2,
      counts: { merge: 0, parent: 0, distinct: 0, unsure: 0, skipped: 0, failed: 0 },
      pending: [UIEN, ONION],
      finished: false,
    });
    await expect(callerFor().reviewRound()).resolves.not.toBeNull();

    reviewQueue.getJobs.mockResolvedValue([]);
    await expect(callerFor().reviewRound()).resolves.toBeNull();
  });

  it("reads a round back, food by food, for the summary the page offers", async () => {
    reviewQueue.getJob.mockResolvedValue({
      id: "round-1",
      data: { ingredients: [{ id: UIEN, name: "uien" }] },
      progress: {
        step: "asking-ai:1/1",
        updatedAt: 1,
        attempts: [
          {
            attempt: 1,
            timeline: [
              {
                id: "asking-ai:1/1",
                startedAt: 1,
                endedAt: 2,
                detail: {
                  ingredientId: UIEN,
                  name: "uien",
                  outcome: "merge",
                  into: "onion",
                  considered: ["onion"],
                  englishName: "onions",
                },
              },
            ],
          },
        ],
      },
      getState: async () => "completed",
    });

    await expect(callerFor().reviewReport({ jobId: "round-1" })).resolves.toEqual({
      jobId: "round-1",
      finished: true,
      entries: [
        {
          ingredientId: UIEN,
          name: "uien",
          outcome: "merge",
          into: "onion",
          considered: ["onion"],
          englishName: "onions",
        },
      ],
      waiting: [],
    });
    expect(reviewQueue.getJob).toHaveBeenCalledWith("round-1");

    reviewQueue.getJob.mockResolvedValue(null);
    await expect(callerFor().reviewReport({ jobId: "gone" })).resolves.toBeNull();
  });
});

describe("AI's suggestions", () => {
  const SUGGESTION = "44444444-4444-4444-8444-444444444444";
  const OTHER = "55555555-5555-4555-8555-555555555555";

  function suggested(kind: "merge" | "parent" | "distinct", ownerId: string | null = ME) {
    return {
      id: SUGGESTION,
      ingredientId: UIEN,
      ingredientName: "uien",
      ingredientOwnerId: ownerId,
      kind,
      target: kind === "distinct" ? null : { id: ONION, name: "onion" },
      englishName: "onions",
      considered: ["onion"],
      source: "ai" as const,
    };
  }

  it("lists only what the viewer may answer", async () => {
    suggestionsRepo.listIngredientSuggestions.mockResolvedValueOnce([
      suggested("parent"),
      { ...suggested("distinct", STRANGER), id: OTHER },
    ]);

    const listed = await callerFor().suggestions();

    expect(listed.map((it) => [it.kind, it.target?.name ?? null])).toEqual([["parent", "onion"]]);
  });

  /** The suggestions the repository holds, found by id whatever order they are asked for in. */
  function holding(...stored: ReturnType<typeof suggested>[]) {
    suggestionsRepo.findIngredientSuggestions.mockImplementation(async (ids: readonly string[]) =>
      stored.filter((it) => ids.includes(it.id))
    );
  }

  it("confirms a parent as the viewer's own edit, which settles it", async () => {
    ownedBy(ME);
    holding(suggested("parent"));

    await expect(callerFor().confirmSuggestions({ suggestionIds: [SUGGESTION] })).resolves.toEqual({
      done: 1,
      failed: 0,
      refusal: null,
    });
    expect(relocation.setCatalogueIngredientParent).toHaveBeenCalledWith(TX, UIEN, ONION);
    expect(suggestionsRepo.deleteSuggestionFor).toHaveBeenCalledWith(UIEN, TX);
    expect(ingredientsRealtime.published).toHaveLength(1);
  });

  it("confirms a merge and a food of its own the way the page's own edits do", async () => {
    ownedBy(ME);
    holding(suggested("merge"), { ...suggested("distinct"), id: OTHER });

    await expect(
      callerFor().confirmSuggestions({ suggestionIds: [SUGGESTION, OTHER] })
    ).resolves.toMatchObject({ done: 2, failed: 0 });
    expect(relocation.mergeCatalogueIngredients).toHaveBeenCalledWith(TX, UIEN, ONION);
    expect(catalogue.keepIngredientDistinct).toHaveBeenCalledWith(TX, UIEN);
    // What both changed is announced once, together.
    expect(ingredientsRealtime.published).toHaveLength(1);
  });

  it("confirms well over five hundred at once, and announces them together", async () => {
    ownedBy(ME);
    const many = Array.from({ length: 1300 }, (_, index) => ({
      ...suggested("parent"),
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    }));

    holding(...many);

    await expect(
      callerFor().confirmSuggestions({ suggestionIds: many.map((it) => it.id) })
    ).resolves.toEqual({ done: 1300, failed: 0, refusal: null });
    expect(relocation.setCatalogueIngredientParent).toHaveBeenCalledTimes(1300);
    expect(ingredientsRealtime.published).toHaveLength(1);
  });

  it("counts a suggestion gone by its turn as settled, not refused", async () => {
    holding();

    await expect(callerFor().confirmSuggestions({ suggestionIds: [SUGGESTION] })).resolves.toEqual({
      done: 0,
      failed: 0,
      refusal: null,
    });
  });

  it("goes on past a refused one and says why", async () => {
    ownedBy(STRANGER);
    holding(suggested("parent", STRANGER), { ...suggested("parent", STRANGER), id: OTHER });

    await expect(
      callerFor().confirmSuggestions({ suggestionIds: [SUGGESTION, OTHER] })
    ).resolves.toEqual({ done: 0, failed: 2, refusal: "forbidden" });
    expect(relocation.setCatalogueIngredientParent).not.toHaveBeenCalled();
    expect(ingredientsRealtime.published).toHaveLength(0);
  });

  it("dismisses a suggestion without touching the food, under the edit policy", async () => {
    holding(suggested("merge"));

    await expect(
      callerFor().dismissSuggestions({ suggestionIds: [SUGGESTION] })
    ).resolves.toMatchObject({ done: 1 });
    expect(suggestionsRepo.deleteIngredientSuggestion).toHaveBeenCalledWith(SUGGESTION);
    expect(relocation.mergeCatalogueIngredients).not.toHaveBeenCalled();

    holding(suggested("merge", STRANGER));
    await expect(
      callerFor().dismissSuggestions({ suggestionIds: [SUGGESTION] })
    ).resolves.toMatchObject({ done: 0, refusal: "forbidden" });
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
    relocation.findIngredientAncestors.mockResolvedValue(new Map([[UIEN, [ONION]]]));

    await expect(
      callerFor().setParent({ ingredientId: ONION, parentId: UIEN })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "cycle" });
    expect(ingredientsRealtime.published).toHaveLength(0);
  });

  it("refuses to delete an Ingredient something still uses", async () => {
    catalogue.isIngredientInUse.mockResolvedValue(true);

    await expect(callerFor().remove({ ingredientId: ONION })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "ingredient-in-use",
    });
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

  it("refuses to remove an Ingredient's last alias, or one something points at", async () => {
    relocation.countAliasesOf.mockResolvedValueOnce(1);
    await expect(callerFor().removeAlias({ aliasId: ALIAS })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "last-alias",
    });

    catalogue.isAliasInUse.mockResolvedValueOnce(true);
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
          aliases: [{ id: ALIAS, text: "onions", locale: null, seeded: false, canRemove: true }],
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
    iconFiles.ownIconExists.mockResolvedValueOnce(false);

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
});
