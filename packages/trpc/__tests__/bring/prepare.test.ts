// @vitest-environment node
/**
 * The bring router: a handoff is prepared only when Bring! is the instance's list, behind a page
 * that shows nothing but the lines, for a recipe the reader may view, and no more than 30 times
 * in ten minutes; only its owner changes or discards it. Bring!'s own API is never called: its
 * client is mocked.
 */
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { bringRouter } from "../../src/routers/bring/bring";
import { createMockCallerContext } from "../calendar/test-utils";
import {
  createMockAuthedContext,
  createMockHousehold,
  createMockUser,
} from "../recipes/test-utils";

const serverConfig = vi.hoisted(() => ({
  AUTH_URL: "https://norish.example.com",
  BRING_API_URL: "https://api.getbring.com",
}));
const getGroceryListProvider = vi.hoisted(() => vi.fn());
const increment = vi.hoisted(() => vi.fn());
const assertRecipeAccess = vi.hoisted(() => vi.fn());
const getRecipeNameAndImage = vi.hoisted(() => vi.fn());
const requestDeeplink = vi.hoisted(() => vi.fn());
const checkImport = vi.hoisted(() => vi.fn());
const createHandoff = vi.hoisted(() => vi.fn());
const deleteHandoff = vi.hoisted(() => vi.fn());
const updateHandoff = vi.hoisted(() => vi.fn());
const addressesOf = vi.hoisted(() => vi.fn());

vi.mock("@norish/config/env-config-server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@norish/config/env-config-server")>();

  return {
    ...original,
    SERVER_CONFIG: new Proxy(original.SERVER_CONFIG, {
      get: (target, key, receiver) =>
        key in serverConfig
          ? serverConfig[key as keyof typeof serverConfig]
          : Reflect.get(target, key, receiver),
    }),
  };
});
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getGroceryListProvider,
  getRecipePermissionPolicy: vi.fn(),
}));
vi.mock("@norish/auth/secondary-storage", () => ({ valkeySecondaryStorage: { increment } }));
vi.mock("@norish/db/repositories/recipes", () => ({ getRecipeNameAndImage }));
vi.mock("../../src/routers/recipes/helpers", () => ({ assertRecipeAccess }));
vi.mock("@norish/shared-server/bring/bring-client", () => ({ checkImport, requestDeeplink }));
vi.mock("@norish/shared-server/bring/handoff-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/bring/handoff-store")>()),
  createHandoff,
  deleteHandoff,
  updateHandoff,
}));
vi.mock("@norish/shared-server/private-addresses", () => ({
  addressesOf,
  isPrivate: ({ address }: { address: string }) => address.startsWith("10."),
}));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const RECIPE_ID = "123e4567-e89b-42d3-a456-426614174000";
const DEEPLINK = "https://getbring.onelink.me/xyz";
const TOKEN = "T".repeat(32);
const user = createMockUser();
const ctx = createMockAuthedContext(user, createMockHousehold());
const caller = bringRouter.createCaller(createMockCallerContext(ctx));
const items = [
  { name: "Mehl", amount: 200, unit: "g" },
  { name: "  Eier ", amount: 2.5 },
];

beforeEach(() => {
  serverConfig.AUTH_URL = "https://norish.example.com";
  serverConfig.BRING_API_URL = "https://api.getbring.com";
  getGroceryListProvider.mockReset().mockResolvedValue("bring");
  increment.mockReset().mockResolvedValue(1);
  assertRecipeAccess.mockReset().mockResolvedValue(undefined);
  getRecipeNameAndImage.mockReset().mockResolvedValue({ name: "Lasagne", image: null });
  createHandoff.mockReset().mockResolvedValue(TOKEN);
  deleteHandoff.mockReset().mockResolvedValue(undefined);
  updateHandoff.mockReset().mockResolvedValue(true);
  requestDeeplink.mockReset().mockResolvedValue({ ok: true, deeplink: DEEPLINK });
  checkImport.mockReset().mockResolvedValue({ ok: true });
  addressesOf.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

describe("bring.prepare", () => {
  it("stores the formatted lines for the reader and returns the token and Bring!'s deeplink", async () => {
    const result = await caller.prepare({ recipeId: RECIPE_ID, servings: 4, items });

    expect(result).toEqual({ ok: true, token: TOKEN, deeplink: DEEPLINK });
    expect(assertRecipeAccess).toHaveBeenCalledWith(expect.anything(), RECIPE_ID, "view");
    expect(createHandoff).toHaveBeenCalledWith(
      {
        title: "Lasagne",
        servings: 4,
        lines: ["200 g Mehl", "2.5 Eier"],
        image: null,
      },
      user.id
    );
    expect(requestDeeplink).toHaveBeenCalledWith({
      url: `https://norish.example.com/share/bring/${TOKEN}`,
      servings: 4,
    });
  });

  it("hands over the recipe's stored picture by its file, and an imported one by its address", async () => {
    getRecipeNameAndImage.mockResolvedValueOnce({
      name: "Lasagne",
      image: `/recipes/${RECIPE_ID}/gallery-1.jpg`,
    });
    await caller.prepare({ recipeId: RECIPE_ID, items });

    getRecipeNameAndImage.mockResolvedValueOnce({
      name: "Lasagne",
      image: "https://cdn.example/lasagne.jpg",
    });
    await caller.prepare({ recipeId: RECIPE_ID, items });

    expect(createHandoff.mock.calls.map(([handoff]) => handoff.image)).toEqual([
      { recipeId: RECIPE_ID, file: "gallery-1.jpg" },
      { url: "https://cdn.example/lasagne.jpg" },
    ]);
  });

  it("uses the given title without a recipe, and Norish without either", async () => {
    await caller.prepare({ title: "Weekend", items });
    await caller.prepare({ items });

    expect(createHandoff.mock.calls.map(([handoff]) => handoff.title)).toEqual([
      "Weekend",
      "Norish",
    ]);
    expect(assertRecipeAccess).not.toHaveBeenCalled();
    expect(createHandoff.mock.calls[1]?.[0].servings).toBe(1);
  });

  it("passes on what Bring! said when it failed", async () => {
    requestDeeplink.mockResolvedValue({ ok: false, reason: "bring-unreachable" });

    await expect(caller.prepare({ items })).resolves.toEqual({
      ok: false,
      reason: "bring-unreachable",
    });
  });

  it("makes no Bring call, and stores nothing, when the list is the built-in one", async () => {
    getGroceryListProvider.mockResolvedValue("builtin");

    await expect(caller.prepare({ items })).resolves.toEqual({ ok: false, reason: "not-bring" });
    expect(requestDeeplink).not.toHaveBeenCalled();
    expect(createHandoff).not.toHaveBeenCalled();
    expect(increment).not.toHaveBeenCalled();
  });

  it("passes on what Bring! said when it failed, and takes its page down", async () => {
    requestDeeplink.mockResolvedValue({ ok: false, reason: "bring-rejected" });

    await expect(caller.prepare({ items })).resolves.toEqual({
      ok: false,
      reason: "bring-rejected",
    });
    expect(deleteHandoff).toHaveBeenCalledWith(TOKEN, user.id);
  });

  it("has Bring! read the page before it asks for the link", async () => {
    await caller.prepare({ servings: 2, items });

    expect(checkImport).toHaveBeenCalledWith({
      url: `https://norish.example.com/share/bring/${TOKEN}`,
      servings: 2,
    });
    expect(checkImport.mock.invocationCallOrder[0]).toBeLessThan(
      requestDeeplink.mock.invocationCallOrder[0]!
    );
  });

  it("answers with the status Bring! got when it could not fetch the page, and takes it down", async () => {
    checkImport.mockResolvedValue({ ok: false, reason: "page-unreachable", status: 403 });

    await expect(caller.prepare({ items })).resolves.toEqual({
      ok: false,
      reason: "page-unreachable",
      status: 403,
    });
    expect(requestDeeplink).not.toHaveBeenCalled();
    expect(deleteHandoff).toHaveBeenCalledWith(TOKEN, user.id);
  });

  it("keeps the page up when Bring! took it", async () => {
    await caller.prepare({ items });

    expect(deleteHandoff).not.toHaveBeenCalled();
  });

  it("refuses a recipe the reader may not view, before anything is stored or counted", async () => {
    assertRecipeAccess.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));

    await expect(caller.prepare({ recipeId: RECIPE_ID, items })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(increment).not.toHaveBeenCalled();
    expect(getRecipeNameAndImage).not.toHaveBeenCalled();
    expect(createHandoff).not.toHaveBeenCalled();
    expect(requestDeeplink).not.toHaveBeenCalled();
  });

  describe("when Bring!'s servers could not reach the instance", () => {
    it("answers not-public for a plain http AUTH_URL", async () => {
      serverConfig.AUTH_URL = "http://norish.example.com";

      await expect(caller.prepare({ items })).resolves.toEqual({ ok: false, reason: "not-public" });
      expect(createHandoff).not.toHaveBeenCalled();
      expect(requestDeeplink).not.toHaveBeenCalled();
    });

    it("answers not-public for an https AUTH_URL that resolves to a private address", async () => {
      addressesOf.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);

      await expect(caller.prepare({ items })).resolves.toEqual({ ok: false, reason: "not-public" });
      expect(requestDeeplink).not.toHaveBeenCalled();
    });

    it("does not use up the quota when it refuses", async () => {
      serverConfig.AUTH_URL = "http://norish.example.com";

      await caller.prepare({ items });

      expect(increment).not.toHaveBeenCalled();
    });

    it("ignores ALLOW_PRIVATE_ADDRESSES: only a stand-in for Bring! skips the check", async () => {
      serverConfig.AUTH_URL = "http://localhost:3000";
      Object.assign(serverConfig, { ALLOW_PRIVATE_ADDRESSES: true });

      try {
        await expect(caller.prepare({ items })).resolves.toEqual({
          ok: false,
          reason: "not-public",
        });
      } finally {
        Reflect.deleteProperty(serverConfig, "ALLOW_PRIVATE_ADDRESSES");
      }
    });

    it("skips the check when BRING_API_URL points at a stand-in for Bring!", async () => {
      serverConfig.AUTH_URL = "http://localhost:3000";
      serverConfig.BRING_API_URL = "http://localhost:4010";

      await expect(caller.prepare({ items })).resolves.toEqual({
        ok: true,
        token: TOKEN,
        deeplink: DEEPLINK,
      });
      expect(requestDeeplink).toHaveBeenCalledWith(
        expect.objectContaining({ url: `http://localhost:3000/share/bring/${TOKEN}` })
      );
    });
  });

  describe("the rate limit", () => {
    it("counts per user in a ten-minute window and lets the 30th through", async () => {
      increment.mockResolvedValue(30);

      await expect(caller.prepare({ items })).resolves.toMatchObject({ ok: true });
      expect(increment).toHaveBeenCalledWith(`bring-send-rate:${user.id}`, 600);
    });

    it("refuses the 31st with rate-limited and prepares nothing", async () => {
      increment.mockResolvedValue(31);

      await expect(caller.prepare({ items })).resolves.toEqual({
        ok: false,
        reason: "rate-limited",
      });
      expect(createHandoff).not.toHaveBeenCalled();
      expect(requestDeeplink).not.toHaveBeenCalled();
    });
  });

  describe("an odd line never fails the handoff", () => {
    it("sends an amount of 0, a negative amount and an odd one without the amount", async () => {
      await caller.prepare({
        items: [
          { name: "Null", amount: 0, unit: "g" },
          { name: "Minus", amount: -2 },
          { name: "Tiny", amount: 0.001 },
          { name: "Many", amount: 12345.678 },
        ],
      });

      expect(createHandoff.mock.calls[0]?.[0].lines).toEqual([
        "g Null",
        "Minus",
        "Tiny",
        "12345.68 Many",
      ]);
    });

    it("cuts an over-long unit and name instead of refusing them", async () => {
      await caller.prepare({
        items: [{ name: "n".repeat(500), amount: 1, unit: "u".repeat(100) }],
      });

      const [line] = createHandoff.mock.calls[0]?.[0].lines as string[];

      expect(line.startsWith(`1 ${"u".repeat(40)} n`)).toBe(true);
      expect(line.length).toBeLessThanOrEqual(200);
    });

    it("ignores an item whose name is empty after trimming", async () => {
      await caller.prepare({ items: [{ name: "   " }, { name: " Salz " }] });

      expect(createHandoff.mock.calls[0]?.[0].lines).toEqual(["Salz"]);
    });

    it("refuses a list with no usable item, before anything is stored or counted", async () => {
      await expect(caller.prepare({ items: [{ name: " " }] })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(createHandoff).not.toHaveBeenCalled();
      expect(increment).not.toHaveBeenCalled();
    });
  });

  it("refuses an empty list and more than 150 lines", async () => {
    await expect(caller.prepare({ items: [] })).rejects.toThrow();
    await expect(
      caller.prepare({ items: Array.from({ length: 151 }, () => ({ name: "x" })) })
    ).rejects.toThrow();
  });
});

describe("bring.update", () => {
  it("replaces the reader's handoff with the newly formatted lines, without calling Bring!", async () => {
    await expect(
      caller.update({ token: TOKEN, recipeId: RECIPE_ID, servings: 2, items })
    ).resolves.toBe(true);

    expect(updateHandoff).toHaveBeenCalledWith(TOKEN, user.id, {
      title: "Lasagne",
      servings: 2,
      lines: ["200 g Mehl", "2.5 Eier"],
      image: null,
    });
    expect(checkImport).not.toHaveBeenCalled();
    expect(requestDeeplink).not.toHaveBeenCalled();
    expect(createHandoff).not.toHaveBeenCalled();
  });

  it("is not counted against the rate limit", async () => {
    increment.mockResolvedValue(31);

    await expect(caller.update({ token: TOKEN, items })).resolves.toBe(true);
    expect(increment).not.toHaveBeenCalled();
  });

  it("answers false when the handoff is gone or is someone else's", async () => {
    updateHandoff.mockResolvedValue(false);

    await expect(caller.update({ token: TOKEN, items })).resolves.toBe(false);
  });

  it("answers false, and changes nothing, when the list is no longer Bring!", async () => {
    getGroceryListProvider.mockResolvedValue("builtin");

    await expect(caller.update({ token: TOKEN, items })).resolves.toBe(false);
    expect(updateHandoff).not.toHaveBeenCalled();
  });

  it("refuses a recipe the reader may not view, before anything is changed", async () => {
    assertRecipeAccess.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));

    await expect(caller.update({ token: TOKEN, recipeId: RECIPE_ID, items })).rejects.toMatchObject(
      { code: "FORBIDDEN" }
    );
    expect(assertRecipeAccess).toHaveBeenCalledWith(expect.anything(), RECIPE_ID, "view");
    expect(getRecipeNameAndImage).not.toHaveBeenCalled();
    expect(updateHandoff).not.toHaveBeenCalled();
  });

  it("refuses a token that prepare could not have returned", async () => {
    await expect(caller.update({ token: "short", items })).rejects.toThrow();
    expect(updateHandoff).not.toHaveBeenCalled();
  });
});

describe("bring.discard", () => {
  it("takes down the reader's handoff, and only for the reader", async () => {
    await caller.discard({ token: TOKEN });

    expect(deleteHandoff).toHaveBeenCalledWith(TOKEN, user.id);
    expect(requestDeeplink).not.toHaveBeenCalled();
  });

  it("refuses a token that prepare could not have returned", async () => {
    await expect(caller.discard({ token: "../other" })).rejects.toThrow();
    expect(deleteHandoff).not.toHaveBeenCalled();
  });
});
