import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipePermissionPolicy } from "@norish/config/zod/server-config";
import type { SessionIdentity } from "@norish/db/repositories/users";
import { verifyApiKeyForRequest } from "@norish/db/repositories/api-keys";
import { listGroceriesByUsers } from "@norish/db/repositories/groceries";
import { getHouseholdForUser } from "@norish/db/repositories/households";
import {
  createPlannedItem,
  getPlannedItemWithRecipeById,
} from "@norish/db/repositories/planned-items";
import {
  dashboardRecipe,
  deleteRecipeById,
  getRecipeFull,
  listRecipes,
} from "@norish/db/repositories/recipes";
import { listRecurringGroceriesByUsers } from "@norish/db/repositories/recurring-groceries";
import { getConfig } from "@norish/db/repositories/server-config";
import { getUserSessionIdentity } from "@norish/db/repositories/users";
import { announceUsableRecipe } from "@norish/queue/enrichment/announce";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import {
  createResolvedRecipe,
  updateResolvedRecipe,
} from "@norish/shared-server/ingredients/recipe-lines";
import { deleteRecipeImagesDir } from "@norish/shared-server/media/storage";
import { calendar } from "@norish/shared-server/realtime/calendar";
import { recipes as recipesRealtime } from "@norish/shared-server/realtime/recipes";

import { handleMcpRequest } from "../src/http";
import { FixedWindowRateLimiter } from "../src/rate-limit";

vi.mock("@norish/db/repositories/api-keys", () => ({
  verifyApiKeyForRequest: vi.fn(),
}));

vi.mock("@norish/db/repositories/users", () => ({
  getUserSessionIdentity: vi.fn(),
}));

vi.mock("@norish/db/repositories/households", () => ({
  getHouseholdForUser: vi.fn(),
}));

vi.mock("@norish/db/repositories/server-config", () => ({
  getConfig: vi.fn(),
}));

vi.mock("@norish/db/repositories/recipes", () => ({
  getRecipeFull: vi.fn(),
  listRecipes: vi.fn(),
  deleteRecipeById: vi.fn(),
  dashboardRecipe: vi.fn(),
}));

vi.mock("@norish/db/repositories/groceries", () => ({
  listGroceriesByUsers: vi.fn(),
}));

vi.mock("@norish/db/repositories/recurring-groceries", () => ({
  listRecurringGroceriesByUsers: vi.fn(),
}));

vi.mock("@norish/db/repositories/planned-items", () => ({
  createPlannedItem: vi.fn(),
  getPlannedItemWithRecipeById: vi.fn(),
}));

vi.mock("@norish/queue/enrichment/announce", () => ({
  announceUsableRecipe: vi.fn(),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn(),
}));

vi.mock("@norish/shared-server/ingredients/recipe-lines", () => ({
  createResolvedRecipe: vi.fn(),
  updateResolvedRecipe: vi.fn(),
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  deleteRecipeImagesDir: vi.fn(),
}));

vi.mock("@norish/shared-server/realtime/recipes", () => ({
  recipes: { publish: vi.fn() },
}));

vi.mock("@norish/shared-server/realtime/calendar", () => ({
  calendar: { publish: vi.fn() },
}));

const API_KEY = "test-api-key";
const USER_ID = "user-1";
const HOUSEHOLD_USER_ID = "user-2";
const STRANGER_ID = "user-3";
const RECIPE_ID = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_RECIPE_ID = "22222222-2222-4222-8222-222222222222";
const STRANGER_RECIPE_ID = "33333333-3333-4333-8333-333333333333";
const PLANNED_ITEM_ID = "44444444-4444-4444-8444-444444444444";

const identity: SessionIdentity = {
  id: USER_ID,
  email: "one@example.test",
  name: "One",
  image: null,
  version: 1,
  isServerAdmin: false,
};

const household = {
  id: "household-1",
  name: "Home",
  adminUserId: USER_ID,
  version: 1,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  joinCode: null,
  joinCodeExpiresAt: null,
  users: [
    { id: USER_ID, name: "One", isAdmin: true, version: 1 },
    { id: HOUSEHOLD_USER_ID, name: "Two", isAdmin: false, version: 1 },
  ],
};

type RecipeFixture = {
  id: string;
  userId: string;
  name: string;
  version: number;
};

function recipeFor(id: string, userId: string): RecipeFixture {
  return { id, userId, name: `Recipe ${id.slice(0, 4)}`, version: 3 };
}

const ownRecipe = recipeFor(RECIPE_ID, USER_ID);
const householdRecipe = recipeFor(HOUSEHOLD_RECIPE_ID, HOUSEHOLD_USER_ID);
const strangerRecipe = recipeFor(STRANGER_RECIPE_ID, STRANGER_ID);

function setPolicy(policy: RecipePermissionPolicy): void {
  vi.mocked(getConfig).mockResolvedValue(policy);
  vi.mocked(getRecipePermissionPolicy).mockResolvedValue(policy);
}

let requestId = 1;

function call(body: unknown, key: string | null = API_KEY): Promise<Response> {
  const headers = new Headers({
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  });

  if (key) headers.set("x-api-key", key);

  return handleMcpRequest(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
  );
}

function rpc(
  method: string,
  params?: Record<string, unknown>,
  key: string | null = API_KEY
): Promise<Response> {
  return call({ jsonrpc: "2.0", id: requestId++, method, params }, key);
}

function toolCall(name: string, args: Record<string, unknown>): Promise<Response> {
  return rpc("tools/call", { name, arguments: args });
}

async function bodyOf(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function toolResult(name: string, args: Record<string, unknown>) {
  const payload = await bodyOf(await toolCall(name, args));
  const result = payload.result as {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };

  return {
    isError: result.isError === true,
    text: result.content[0]?.text ?? "",
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(verifyApiKeyForRequest).mockResolvedValue({ status: "valid", userId: USER_ID });
  vi.mocked(getUserSessionIdentity).mockResolvedValue(identity);
  vi.mocked(getHouseholdForUser).mockResolvedValue(household);
  setPolicy({ view: "household", edit: "household", delete: "household" });

  vi.mocked(getRecipeFull).mockImplementation(async (id) => {
    const found = [ownRecipe, householdRecipe, strangerRecipe].find((recipe) => recipe.id === id);

    return (found ?? null) as never;
  });
  vi.mocked(listRecipes).mockResolvedValue({ recipes: [], total: 0 });
  vi.mocked(dashboardRecipe).mockResolvedValue(null);
  vi.mocked(deleteRecipeById).mockResolvedValue({ applied: true, stale: false, value: undefined });
  vi.mocked(updateResolvedRecipe).mockResolvedValue({
    applied: true,
    stale: false,
    value: undefined,
  });
  vi.mocked(createResolvedRecipe).mockResolvedValue({
    status: "inserted",
    recipeId: RECIPE_ID,
  });
  vi.mocked(deleteRecipeImagesDir).mockResolvedValue(undefined);
  vi.mocked(announceUsableRecipe).mockResolvedValue(undefined);
  vi.mocked(recipesRealtime.publish).mockResolvedValue(undefined);
  vi.mocked(calendar.publish).mockResolvedValue(undefined);
  vi.mocked(listGroceriesByUsers).mockResolvedValue([]);
  vi.mocked(listRecurringGroceriesByUsers).mockResolvedValue([]);
  vi.mocked(createPlannedItem).mockImplementation(async (input) => {
    return {
      id: PLANNED_ITEM_ID,
      userId: input.userId,
      date: input.date,
      slot: input.slot,
      sortOrder: 0,
      itemType: input.itemType,
      recipeId: input.recipeId ?? null,
      title: input.title ?? null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;
  });
});

describe("MCP authentication", () => {
  it("rejects a request without an API key", async () => {
    const response = await rpc("tools/list", undefined, null);

    expect(response.status).toBe(401);
    await expect(bodyOf(response)).resolves.toEqual({ error: "Unauthorized" });
    expect(verifyApiKeyForRequest).not.toHaveBeenCalled();
  });

  it("rejects an invalid API key", async () => {
    vi.mocked(verifyApiKeyForRequest).mockResolvedValue({ status: "invalid" });

    const response = await rpc("tools/list", undefined, "bad-key");

    expect(response.status).toBe(401);
  });

  it("reports the per-key rate limit as 429, not 401", async () => {
    vi.mocked(verifyApiKeyForRequest).mockResolvedValue({
      status: "rate_limited",
      retryAfterSeconds: 120,
    });

    const response = await rpc("tools/list");

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
  });

  it("rejects a key whose user no longer exists", async () => {
    vi.mocked(getUserSessionIdentity).mockResolvedValue(null);

    const response = await rpc("tools/list");

    expect(response.status).toBe(401);
  });

  it("accepts an Authorization Bearer key", async () => {
    const response = await handleMcpRequest(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      })
    );

    expect(response.status).toBe(200);
    expect(verifyApiKeyForRequest).toHaveBeenCalledWith(API_KEY);
  });

  it("only accepts POST", async () => {
    const response = await handleMcpRequest(
      new Request("http://localhost/api/mcp", { method: "GET" })
    );

    expect(response.status).toBe(405);
  });
});

describe("MCP surface", () => {
  it("answers initialize with the Norish server identity", async () => {
    const payload = await bodyOf(
      await rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      })
    );
    const result = payload.result as { serverInfo: { name: string }; capabilities: object };

    expect(result.serverInfo.name).toBe("norish");
    expect(result.capabilities).toBeDefined();
  });

  it("exposes exactly the household tools and no admin surface", async () => {
    const payload = await bodyOf(await rpc("tools/list"));
    const result = payload.result as { tools: Array<{ name: string }> };

    expect(result.tools.map((tool) => tool.name).sort()).toEqual([
      "create_recipe",
      "delete_recipe",
      "get_recipe",
      "list_groceries",
      "plan_meal",
      "search_recipes",
      "update_recipe",
    ]);
  });
});

describe("recipe permissions", () => {
  it("hides a recipe the viewer may not see, without revealing that it exists", async () => {
    setPolicy({ view: "owner", edit: "owner", delete: "owner" });

    const householdResult = await toolResult("get_recipe", { id: HOUSEHOLD_RECIPE_ID });
    const strangerResult = await toolResult("get_recipe", { id: STRANGER_RECIPE_ID });

    expect(householdResult.isError).toBe(true);
    expect(householdResult.text).toBe("Recipe not found.");
    expect(strangerResult.text).toBe("Recipe not found.");
  });

  it("returns the caller's own recipe", async () => {
    setPolicy({ view: "owner", edit: "owner", delete: "owner" });

    const result = await toolResult("get_recipe", { id: RECIPE_ID });

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text)).toMatchObject({ id: RECIPE_ID, userId: USER_ID });
  });

  it("allows a household member to view a household recipe", async () => {
    setPolicy({ view: "household", edit: "owner", delete: "owner" });

    const result = await toolResult("get_recipe", { id: HOUSEHOLD_RECIPE_ID });

    expect(result.isError).toBe(false);
  });

  it("allows everyone to view a recipe when the policy says so", async () => {
    setPolicy({ view: "everyone", edit: "owner", delete: "owner" });

    const result = await toolResult("get_recipe", { id: STRANGER_RECIPE_ID });

    expect(result.isError).toBe(false);
  });

  it("rejects an update when the viewer can see but not edit", async () => {
    setPolicy({ view: "everyone", edit: "owner", delete: "owner" });

    const result = await toolResult("update_recipe", {
      id: HOUSEHOLD_RECIPE_ID,
      version: 3,
      data: { name: "Changed" },
    });

    expect(result.isError).toBe(true);
    expect(result.text).toBe("You do not have permission to change this recipe.");
    expect(updateResolvedRecipe).not.toHaveBeenCalled();
  });

  it("updates a recipe the policy allows the caller to edit", async () => {
    setPolicy({ view: "everyone", edit: "household", delete: "owner" });

    const result = await toolResult("update_recipe", {
      id: HOUSEHOLD_RECIPE_ID,
      version: 3,
      data: { name: "Changed" },
    });

    expect(result.isError).toBe(false);
    expect(updateResolvedRecipe).toHaveBeenCalledWith(
      HOUSEHOLD_RECIPE_ID,
      USER_ID,
      expect.any(Object),
      { userId: USER_ID },
      3
    );
  });

  it("rejects a delete when the viewer can see but not delete", async () => {
    setPolicy({ view: "everyone", edit: "household", delete: "owner" });

    const result = await toolResult("delete_recipe", { id: HOUSEHOLD_RECIPE_ID, version: 3 });

    expect(result.isError).toBe(true);
    expect(deleteRecipeById).not.toHaveBeenCalled();
    expect(deleteRecipeImagesDir).not.toHaveBeenCalled();
  });

  it("deletes a recipe the policy allows the caller to delete", async () => {
    setPolicy({ view: "everyone", edit: "household", delete: "household" });

    const result = await toolResult("delete_recipe", { id: HOUSEHOLD_RECIPE_ID, version: 3 });

    expect(result.isError).toBe(false);
    expect(deleteRecipeById).toHaveBeenCalledWith(HOUSEHOLD_RECIPE_ID, 3);
  });

  it("reports a stale update without writing", async () => {
    setPolicy({ view: "everyone", edit: "household", delete: "household" });
    vi.mocked(updateResolvedRecipe).mockResolvedValue({
      applied: false,
      stale: true,
    });

    const result = await toolResult("update_recipe", {
      id: HOUSEHOLD_RECIPE_ID,
      version: 2,
      data: { name: "Changed" },
    });

    expect(result.isError).toBe(true);
    expect(result.text).toContain("changed");
  });

  it("hides a recipe from an update attempt when the viewer may not see it", async () => {
    setPolicy({ view: "owner", edit: "everyone", delete: "everyone" });

    const result = await toolResult("update_recipe", {
      id: STRANGER_RECIPE_ID,
      version: 3,
      data: { name: "Changed" },
    });

    expect(result.isError).toBe(true);
    expect(result.text).toBe("Recipe not found.");
    expect(updateResolvedRecipe).not.toHaveBeenCalled();
  });

  it("hides a recipe from a delete attempt when the viewer may not see it", async () => {
    setPolicy({ view: "owner", edit: "everyone", delete: "everyone" });

    const result = await toolResult("delete_recipe", { id: STRANGER_RECIPE_ID, version: 3 });

    expect(result.isError).toBe(true);
    expect(result.text).toBe("Recipe not found.");
    expect(deleteRecipeById).not.toHaveBeenCalled();
  });

  it("lets a server admin view a recipe under the owner policy", async () => {
    setPolicy({ view: "owner", edit: "owner", delete: "owner" });
    vi.mocked(getUserSessionIdentity).mockResolvedValue({ ...identity, isServerAdmin: true });

    const result = await toolResult("get_recipe", { id: STRANGER_RECIPE_ID });

    expect(result.isError).toBe(false);
  });

  it("does not let a user without a household view a household recipe", async () => {
    setPolicy({ view: "household", edit: "household", delete: "household" });
    vi.mocked(getHouseholdForUser).mockResolvedValue(null);

    const result = await toolResult("get_recipe", { id: HOUSEHOLD_RECIPE_ID });

    expect(result.isError).toBe(true);
    expect(result.text).toBe("Recipe not found.");
  });

  it("stops seeing a household recipe after the caller leaves the household", async () => {
    setPolicy({ view: "household", edit: "household", delete: "household" });

    expect((await toolResult("get_recipe", { id: HOUSEHOLD_RECIPE_ID })).isError).toBe(false);

    vi.mocked(getHouseholdForUser).mockResolvedValue(null);

    const result = await toolResult("get_recipe", { id: HOUSEHOLD_RECIPE_ID });

    expect(result.isError).toBe(true);
    expect(result.text).toBe("Recipe not found.");
  });

  it("returns not found for a recipe that does not exist", async () => {
    const result = await toolResult("get_recipe", {
      id: "99999999-9999-4999-8999-999999999999",
    });

    expect(result.isError).toBe(true);
    expect(result.text).toBe("Recipe not found.");
  });
});

describe("planning", () => {
  it("plans a visible recipe without edit rights on it", async () => {
    setPolicy({ view: "everyone", edit: "owner", delete: "owner" });
    vi.mocked(getPlannedItemWithRecipeById).mockResolvedValue({
      recipeName: "Household recipe",
      recipeImage: null,
      servings: 2,
      calories: 400,
    } as never);

    const result = await toolResult("plan_meal", {
      recipeId: HOUSEHOLD_RECIPE_ID,
      date: "2026-10-20",
      slot: "Dinner",
    });

    expect(result.isError).toBe(false);
    expect(createPlannedItem).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        recipeId: HOUSEHOLD_RECIPE_ID,
        date: "2026-10-20",
        slot: "Dinner",
        itemType: "recipe",
      })
    );
    expect(JSON.parse(result.text)).toMatchObject({
      id: PLANNED_ITEM_ID,
      recipeId: HOUSEHOLD_RECIPE_ID,
    });
    expect(calendar.publish).toHaveBeenCalledWith(
      "itemCreated",
      { item: expect.objectContaining({ id: PLANNED_ITEM_ID, recipeId: HOUSEHOLD_RECIPE_ID }) },
      { householdKey: "household-1" }
    );
    expect(calendar.publish).toHaveBeenCalledWith(
      "itemCreatedInternal",
      { item: expect.objectContaining({ id: PLANNED_ITEM_ID }) },
      undefined
    );
  });

  it("returns success with null media when the planned-item publish fails", async () => {
    setPolicy({ view: "everyone", edit: "owner", delete: "owner" });
    vi.mocked(getPlannedItemWithRecipeById).mockResolvedValue({
      recipeName: "Household recipe",
      recipeImage: "/recipes/recipe.jpg",
      servings: 2,
      calories: 400,
    } as never);
    vi.mocked(calendar.publish).mockRejectedValue(new Error("redis down"));

    const result = await toolResult("plan_meal", {
      recipeId: HOUSEHOLD_RECIPE_ID,
      date: "2026-10-20",
      slot: "Dinner",
    });

    expect(result.isError).toBe(false);
    expect(createPlannedItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.text)).toMatchObject({
      id: PLANNED_ITEM_ID,
      recipeId: HOUSEHOLD_RECIPE_ID,
      recipeName: null,
      recipeImage: null,
    });
  });

  it("refuses to plan a recipe the caller may not see", async () => {
    setPolicy({ view: "owner", edit: "owner", delete: "owner" });

    const result = await toolResult("plan_meal", {
      recipeId: STRANGER_RECIPE_ID,
      date: "2026-10-20",
      slot: "Dinner",
    });

    expect(result.isError).toBe(true);
    expect(result.text).toBe("Recipe not found.");
    expect(createPlannedItem).not.toHaveBeenCalled();
  });
});

describe("household scoping", () => {
  it("lists groceries for the caller and every household member", async () => {
    vi.mocked(listGroceriesByUsers).mockResolvedValue([
      { id: "55555555-5555-4555-8555-555555555555", name: "Milk" },
    ] as never);

    const result = await toolResult("list_groceries", {});

    expect(listGroceriesByUsers).toHaveBeenCalledWith([USER_ID, HOUSEHOLD_USER_ID], {
      includeDone: true,
    });
    expect(listRecurringGroceriesByUsers).toHaveBeenCalledWith([USER_ID, HOUSEHOLD_USER_ID]);
    expect(JSON.parse(result.text).groceries).toHaveLength(1);
  });

  it("lists only the caller's groceries when they have no household", async () => {
    vi.mocked(getHouseholdForUser).mockResolvedValue(null);

    await toolResult("list_groceries", {});

    expect(listGroceriesByUsers).toHaveBeenCalledWith([USER_ID], { includeDone: true });
  });

  it("scopes recipe search to the caller's view policy", async () => {
    await toolResult("search_recipes", { limit: 10 });

    expect(listRecipes).toHaveBeenCalledWith(
      {
        userId: USER_ID,
        householdUserIds: [USER_ID, HOUSEHOLD_USER_ID],
        isServerAdmin: false,
      },
      10,
      0,
      undefined,
      ["title", "ingredients"],
      undefined,
      "OR",
      "dateDesc",
      undefined,
      undefined,
      undefined
    );
  });
});

describe("input validation", () => {
  it("rejects a caller-supplied recipe id", async () => {
    const payload = await bodyOf(await toolCall("create_recipe", { id: RECIPE_ID, name: "Soup" }));
    const result = payload.result as { content: Array<{ text: string }>; isError?: boolean };

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Input validation error");
    expect(createResolvedRecipe).not.toHaveBeenCalled();
  });

  it("rejects a caller-supplied owner", async () => {
    const payload = await bodyOf(
      await toolCall("create_recipe", { userId: STRANGER_ID, name: "Soup" })
    );
    const result = payload.result as { isError?: boolean };

    expect(result.isError).toBe(true);
    expect(createResolvedRecipe).not.toHaveBeenCalled();
  });

  it("rejects a caller-supplied recipe image path", async () => {
    const payload = await bodyOf(
      await toolCall("create_recipe", {
        name: "Soup",
        images: [{ image: "/recipes/33333333-3333-4333-8333-333333333333/private.jpg" }],
      })
    );
    const result = payload.result as { isError?: boolean };

    expect(result.isError).toBe(true);
    expect(createResolvedRecipe).not.toHaveBeenCalled();
  });

  it.each([
    ["userId", STRANGER_ID],
    ["version", 9],
    ["dishColor", "#000000"],
    ["images", [{ image: "/recipes/33333333-3333-4333-8333-333333333333/private.jpg" }]],
  ])("rejects update data that carries %s", async (field, value) => {
    const result = await toolResult("update_recipe", {
      id: HOUSEHOLD_RECIPE_ID,
      version: 3,
      data: { name: "Changed", [field]: value },
    });

    expect(result.isError).toBe(true);
    expect(result.text).toContain("Input validation error");
    expect(updateResolvedRecipe).not.toHaveBeenCalled();
  });

  it("rejects a malformed recipe id before any lookup", async () => {
    const payload = await bodyOf(await toolCall("get_recipe", { id: "not-a-uuid" }));
    const result = payload.result as { content: Array<{ text: string }>; isError?: boolean };

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Input validation error");
    expect(getRecipeFull).not.toHaveBeenCalled();
  });

  it("rejects a create without a name", async () => {
    const payload = await bodyOf(await toolCall("create_recipe", {}));
    const result = payload.result as { isError?: boolean };

    expect(result.isError).toBe(true);
    expect(createResolvedRecipe).not.toHaveBeenCalled();
  });

  it("rejects a plan with an invalid date", async () => {
    const payload = await bodyOf(
      await toolCall("plan_meal", {
        recipeId: RECIPE_ID,
        date: "20-10-2026",
        slot: "Dinner",
      })
    );

    const result = payload.result as { isError?: boolean };

    expect(result.isError).toBe(true);
    expect(createPlannedItem).not.toHaveBeenCalled();
  });

  it("rejects a page size above the maximum", async () => {
    const payload = await bodyOf(await toolCall("search_recipes", { limit: 1000 }));
    const result = payload.result as { isError?: boolean };

    expect(result.isError).toBe(true);
    expect(listRecipes).not.toHaveBeenCalled();
  });
});

describe("request hardening", () => {
  it("rate limits per user", async () => {
    const limiter = new FixedWindowRateLimiter(2, 60_000, () => 1_000);
    const send = () =>
      handleMcpRequest(
        new Request("http://localhost/api/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "x-api-key": API_KEY,
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        }),
        { rateLimiter: limiter }
      );

    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);

    const limited = await send();

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });

  it("rejects a body larger than the configured limit", async () => {
    const huge = "x".repeat(300 * 1024);
    const response = await handleMcpRequest(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "search_recipes", arguments: { search: huge } },
        }),
      })
    );

    expect(response.status).toBe(413);
    expect(listRecipes).not.toHaveBeenCalled();
  });
});

describe("post-write failures", () => {
  it("returns success when the create publish and announce fail", async () => {
    vi.mocked(dashboardRecipe).mockResolvedValue({ id: RECIPE_ID } as never);
    vi.mocked(recipesRealtime.publish).mockRejectedValue(new Error("redis down"));
    vi.mocked(announceUsableRecipe).mockRejectedValue(new Error("redis down"));

    const result = await toolResult("create_recipe", { name: "Soup" });

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text)).toEqual({ id: RECIPE_ID, status: "inserted" });
    expect(createResolvedRecipe).toHaveBeenCalledTimes(1);
  });

  it("returns success when the update publish fails", async () => {
    vi.mocked(recipesRealtime.publish).mockRejectedValue(new Error("redis down"));

    const result = await toolResult("update_recipe", {
      id: HOUSEHOLD_RECIPE_ID,
      version: 3,
      data: { name: "Changed" },
    });

    expect(result.isError).toBe(false);
  });

  it("returns success when the delete publish fails", async () => {
    vi.mocked(recipesRealtime.publish).mockRejectedValue(new Error("redis down"));

    const result = await toolResult("delete_recipe", {
      id: HOUSEHOLD_RECIPE_ID,
      version: 3,
    });

    expect(result.isError).toBe(false);
  });

  it("returns success when the image cleanup fails after the row delete", async () => {
    vi.mocked(deleteRecipeImagesDir).mockRejectedValue(new Error("disk full"));

    const result = await toolResult("delete_recipe", {
      id: HOUSEHOLD_RECIPE_ID,
      version: 3,
    });

    expect(result.isError).toBe(false);
    expect(deleteRecipeById).toHaveBeenCalledWith(HOUSEHOLD_RECIPE_ID, 3);
    expect(deleteRecipeImagesDir).toHaveBeenCalledWith(HOUSEHOLD_RECIPE_ID);
    expect(deleteRecipeImagesDir).toHaveBeenCalledTimes(1);
    expect(deleteRecipeById).toHaveBeenCalledTimes(1);
  });
});

describe("recipe writes", () => {
  it("creates a recipe owned by the caller", async () => {
    vi.mocked(getRecipePermissionPolicy).mockResolvedValue({
      view: "household",
      edit: "household",
      delete: "household",
    });

    const result = await toolResult("create_recipe", { name: "Soup", servings: 2 });

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text)).toEqual({ id: RECIPE_ID, status: "inserted" });
    expect(createResolvedRecipe).toHaveBeenCalledWith(
      expect.any(String),
      USER_ID,
      expect.objectContaining({ name: "Soup" }),
      { userId: USER_ID }
    );
    expect(announceUsableRecipe).toHaveBeenCalledWith(
      { status: "inserted", recipeId: RECIPE_ID },
      expect.objectContaining({ userId: USER_ID })
    );
  });
});
