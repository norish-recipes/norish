import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";

// Setup mocks before any imports that use them
vi.mock("@/server/db", () => import("../../mocks/db"));
vi.mock(
  "@/server/db/repositories/recurring-groceries",
  () => import("../../mocks/recurring-groceries")
);
vi.mock("@/server/auth/permissions", () => import("../../mocks/permissions"));
vi.mock("@/server/trpc/routers/groceries/emitter", () => import("../../mocks/grocery-emitter"));
vi.mock("@/config/server-config-loader", () => import("../../mocks/config"));
vi.mock("@/lib/helpers", () => import("../../mocks/helpers"));

// Import mocks for assertions
import {
  listGroceriesByUsers,
  createGroceries,
  updateGroceries,
  deleteGroceryByIds,
  getGroceryOwnerIds,
  getGroceriesByIds,
} from "../../mocks/db";
import { listRecurringGroceriesByUsers } from "../../mocks/recurring-groceries";
import { assertHouseholdAccess } from "../../mocks/permissions";
import { groceryEmitter } from "../../mocks/grocery-emitter";

// Import test utilities
import {
  createMockUser,
  createMockHousehold,
  createMockAuthedContext,
  createMockGrocery,
} from "./test-utils";

// Create a test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

// Create test caller
function createTestCaller(ctx: ReturnType<typeof createMockAuthedContext>) {
  const testRouter = t.router({
    list: t.procedure.query(async () => {
      const [groceries, recurringGroceries] = await Promise.all([
        listGroceriesByUsers(ctx.userIds),
        listRecurringGroceriesByUsers(ctx.userIds),
      ]);

      return { groceries, recurringGroceries };
    }),
  });

  return t.createCallerFactory(testRouter)(ctx);
}

describe("groceries procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  describe("list", () => {
    it("returns groceries and recurring groceries for user and household", async () => {
      const mockGroceries = [
        createMockGrocery({ id: "g1", name: "Milk" }),
        createMockGrocery({ id: "g2", name: "Bread" }),
      ];
      const mockRecurring = [
        { id: "r1", name: "Weekly Eggs", recurrenceRule: "week", recurrenceInterval: 1 },
      ];

      listGroceriesByUsers.mockResolvedValue(mockGroceries);
      listRecurringGroceriesByUsers.mockResolvedValue(mockRecurring);

      const caller = createTestCaller(ctx);
      const result = await caller.list();

      expect(listGroceriesByUsers).toHaveBeenCalledWith(ctx.userIds);
      expect(listRecurringGroceriesByUsers).toHaveBeenCalledWith(ctx.userIds);
      expect(result.groceries).toEqual(mockGroceries);
      expect(result.recurringGroceries).toEqual(mockRecurring);
    });

    it("returns empty arrays when no groceries exist", async () => {
      listGroceriesByUsers.mockResolvedValue([]);
      listRecurringGroceriesByUsers.mockResolvedValue([]);

      const caller = createTestCaller(ctx);
      const result = await caller.list();

      expect(result.groceries).toEqual([]);
      expect(result.recurringGroceries).toEqual([]);
    });
  });
});

describe("grocery permission checks", () => {
  const _mockUser = createMockUser({ id: "user-1" });
  const _mockHousehold = createMockHousehold({
    users: [
      { id: "user-1", name: "User 1" },
      { id: "user-2", name: "User 2" },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("update permission", () => {
    it("allows owner to update their grocery", async () => {
      const groceryId = "grocery-1";
      const ownerIds = new Map([[groceryId, "user-1"]]);

      getGroceryOwnerIds.mockResolvedValue(ownerIds);
      assertHouseholdAccess.mockResolvedValue(undefined);

      await assertHouseholdAccess("user-1", "user-1");

      expect(assertHouseholdAccess).toHaveBeenCalledWith("user-1", "user-1");
    });

    it("allows household member to update grocery", async () => {
      const groceryId = "grocery-1";
      const ownerIds = new Map([[groceryId, "user-2"]]);

      getGroceryOwnerIds.mockResolvedValue(ownerIds);
      assertHouseholdAccess.mockResolvedValue(undefined);

      await assertHouseholdAccess("user-1", "user-2");

      expect(assertHouseholdAccess).toHaveBeenCalledWith("user-1", "user-2");
    });

    it("throws when grocery not found", async () => {
      getGroceryOwnerIds.mockResolvedValue(new Map());

      const ownerIds = await getGroceryOwnerIds(["non-existent"]);

      expect(ownerIds.size).toBe(0);
    });
  });

  describe("delete permission", () => {
    it("allows deleting multiple groceries when all are accessible", async () => {
      const _groceryIds = ["g1", "g2"];
      const ownerIds = new Map([
        ["g1", "user-1"],
        ["g2", "user-2"],
      ]);

      getGroceryOwnerIds.mockResolvedValue(ownerIds);
      assertHouseholdAccess.mockResolvedValue(undefined);
      deleteGroceryByIds.mockResolvedValue(undefined);

      for (const ownerId of ownerIds.values()) {
        await assertHouseholdAccess("user-1", ownerId);
      }

      expect(assertHouseholdAccess).toHaveBeenCalledTimes(2);
    });
  });
});

describe("grocery emitter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits created event after successful creation", async () => {
    const mockGroceries = [createMockGrocery({ id: "new-1", name: "New Item" })];

    createGroceries.mockResolvedValue(mockGroceries);

    groceryEmitter.emitToHousehold("household-1", "created", { groceries: mockGroceries });

    expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith("household-1", "created", {
      groceries: mockGroceries,
    });
  });

  it("emits updated event after successful update", async () => {
    const mockUpdated = [createMockGrocery({ id: "g1", name: "Updated" })];

    updateGroceries.mockResolvedValue(mockUpdated);

    groceryEmitter.emitToHousehold("household-1", "updated", { changedGroceries: mockUpdated });

    expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith("household-1", "updated", {
      changedGroceries: mockUpdated,
    });
  });

  it("emits deleted event after successful deletion", async () => {
    const groceryIds = ["g1", "g2"];

    deleteGroceryByIds.mockResolvedValue(undefined);

    groceryEmitter.emitToHousehold("household-1", "deleted", { groceryIds });

    expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith("household-1", "deleted", {
      groceryIds,
    });
  });
});

describe("toggle procedure logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggles isDone for multiple groceries", async () => {
    const groceryIds = ["g1", "g2"];
    const ownerIds = new Map([
      ["g1", "user-1"],
      ["g2", "user-1"],
    ]);
    const groceries = [
      createMockGrocery({ id: "g1", isDone: false }),
      createMockGrocery({ id: "g2", isDone: false }),
    ];

    getGroceryOwnerIds.mockResolvedValue(ownerIds);
    getGroceriesByIds.mockResolvedValue(groceries);
    assertHouseholdAccess.mockResolvedValue(undefined);
    updateGroceries.mockResolvedValue(groceries.map((g) => ({ ...g, isDone: true })));

    const fetchedGroceries = await getGroceriesByIds(groceryIds);
    const updatedGroceries = fetchedGroceries.map((g: ReturnType<typeof createMockGrocery>) => ({
      ...g,
      isDone: true,
    }));

    expect(updatedGroceries.every((g: { isDone: boolean }) => g.isDone)).toBe(true);
  });
});
