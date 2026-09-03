// @vitest-environment node
/**
 * The cookbook router's permission contract.
 *
 * Cookbooks reuse the recipe permission policy (ADR-0027), so what is worth
 * pinning here is that rename and delete ask it for `edit` and `delete`
 * respectively, that an Orphaned cookbook does not ask at all, and that a
 * refusal is a refusal rather than a silent no-op.
 */

import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cookbookEmitter } from "../mocks/cookbook-emitter";
import {
  createCookbook,
  deleteCookbookById,
  getCookbookRow,
  listCookbooks,
  renameCookbook,
  withMemberSummaries,
} from "../mocks/cookbooks-repository";
import { canAccessResource } from "../mocks/permissions";
import { createMockHousehold, createMockUser } from "../recipes/test-utils";

vi.mock("@norish/db/repositories/cookbooks", () => import("../mocks/cookbooks-repository"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/realtime/cookbooks", () => import("../mocks/cookbook-emitter"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));
// The auth middleware resolves the household itself; the test hands it one on
// the base context so nothing reaches the cache or Redis.
vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: vi.fn().mockResolvedValue(null),
}));

const { cookbooksRouter } = await import("../../src/routers/cookbooks");
const { router, createCallerFactory } = await import("../../src/trpc");

const appRouter = router({ cookbooks: cookbooksRouter });

function callerFor(user = createMockUser()) {
  const household = createMockHousehold();
  // The real base context shape: the authed middleware derives householdKey,
  // householdUserIds and isServerAdmin from it, so the procedures under test
  // see exactly what they see in production.
  const ctx = {
    user,
    household: { id: household.id, name: household.name, users: household.users },
    connectionId: null,
    multiplexer: null,
    operationId: null,
  };

  return { caller: createCallerFactory(appRouter)(ctx as never), ctx };
}

function cookbookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "test-user-id",
    title: "Weeknights",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    ...overrides,
  };
}

function cookbookSummary(overrides: Record<string, unknown> = {}) {
  return { ...cookbookRow(), memberCount: 0, coverImages: [], ...overrides };
}

describe("cookbook procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("stores a title against the caller and echoes the new cookbook", async () => {
      const summary = cookbookSummary();

      createCookbook.mockResolvedValue(summary);

      const { caller } = callerFor();
      const result = await caller.cookbooks.create({ title: "Weeknights" });

      expect(createCookbook).toHaveBeenCalledWith({
        id: undefined,
        userId: "test-user-id",
        title: "Weeknights",
      });
      expect(result.id).toBe(summary.id);
      // The default mocked policy is `household`, so the echo goes there.
      expect(cookbookEmitter.emitToHousehold).toHaveBeenCalledWith("test-household-id", "created", {
        cookbook: summary,
      });
    });

    it("honours a client-minted id, so filing queued behind it lands", async () => {
      const id = "22222222-2222-4222-8222-222222222222";

      createCookbook.mockResolvedValue(cookbookSummary({ id }));

      const { caller } = callerFor();

      await caller.cookbooks.create({ id, title: "Christmas" });

      expect(createCookbook).toHaveBeenCalledWith(
        expect.objectContaining({ id, title: "Christmas" })
      );
    });
  });

  describe("rename", () => {
    it("asks the policy for edit rights and renames when granted", async () => {
      const row = cookbookRow({ userId: "someone-else" });

      getCookbookRow.mockResolvedValue(row);
      canAccessResource.mockResolvedValue(true);
      renameCookbook.mockResolvedValue({
        applied: true,
        stale: false,
        value: { ...row, title: "Christmas baking", version: 2 },
      });
      withMemberSummaries.mockResolvedValue([
        cookbookSummary({ userId: "someone-else", title: "Christmas baking", version: 2 }),
      ]);

      const { caller } = callerFor();
      const result = await caller.cookbooks.rename({
        id: row.id,
        version: 1,
        title: "Christmas baking",
      });

      expect(canAccessResource).toHaveBeenCalledWith(
        "edit",
        "test-user-id",
        "someone-else",
        ["test-user-id", "household-member-id"],
        false
      );
      expect(result?.title).toBe("Christmas baking");
    });

    it("refuses a reader the policy will not let edit", async () => {
      getCookbookRow.mockResolvedValue(cookbookRow({ userId: "someone-else" }));
      canAccessResource.mockResolvedValue(false);

      const { caller } = callerFor();

      await expect(
        caller.cookbooks.rename({ id: cookbookRow().id, version: 1, title: "Mine now" })
      ).rejects.toThrow(TRPCError);
      expect(renameCookbook).not.toHaveBeenCalled();
    });

    it("lets anyone rename an Orphaned cookbook, without consulting the policy", async () => {
      const row = cookbookRow({ userId: null });

      getCookbookRow.mockResolvedValue(row);
      renameCookbook.mockResolvedValue({
        applied: true,
        stale: false,
        value: { ...row, title: "Adopted", version: 2 },
      });
      withMemberSummaries.mockResolvedValue([
        cookbookSummary({ userId: null, title: "Adopted", version: 2 }),
      ]);

      const { caller } = callerFor(createMockUser({ id: "a-stranger" }));

      await expect(
        caller.cookbooks.rename({ id: row.id, version: 1, title: "Adopted" })
      ).resolves.toMatchObject({ title: "Adopted" });
      expect(canAccessResource).not.toHaveBeenCalled();
    });

    it("drops a stale rename rather than clobbering a concurrent one", async () => {
      const row = cookbookRow();

      getCookbookRow.mockResolvedValue(row);
      canAccessResource.mockResolvedValue(true);
      renameCookbook.mockResolvedValue({ applied: false, stale: true });

      const { caller } = callerFor();

      await expect(
        caller.cookbooks.rename({ id: row.id, version: 1, title: "Too late" })
      ).resolves.toBeNull();
      expect(cookbookEmitter.emitToHousehold).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("asks the policy for delete rights", async () => {
      const row = cookbookRow({ userId: "someone-else" });

      getCookbookRow.mockResolvedValue(row);
      canAccessResource.mockResolvedValue(true);
      deleteCookbookById.mockResolvedValue({ applied: true, stale: false, value: undefined });

      const { caller } = callerFor();

      await expect(caller.cookbooks.remove({ id: row.id, version: 1 })).resolves.toEqual({
        id: row.id,
        deleted: true,
      });
      expect(canAccessResource).toHaveBeenCalledWith(
        "delete",
        "test-user-id",
        "someone-else",
        ["test-user-id", "household-member-id"],
        false
      );
    });

    it("refuses a reader the policy will not let delete", async () => {
      getCookbookRow.mockResolvedValue(cookbookRow({ userId: "someone-else" }));
      canAccessResource.mockResolvedValue(false);

      const { caller } = callerFor();

      await expect(caller.cookbooks.remove({ id: cookbookRow().id, version: 1 })).rejects.toThrow(
        TRPCError
      );
      expect(deleteCookbookById).not.toHaveBeenCalled();
    });

    it("reports a cookbook that is not there as not found", async () => {
      getCookbookRow.mockResolvedValue(null);

      const { caller } = callerFor();

      await expect(caller.cookbooks.remove({ id: cookbookRow().id, version: 1 })).rejects.toThrow(
        /not found/i
      );
    });
  });

  describe("list", () => {
    it("pages the viewer's own cookbooks and reports the next cursor", async () => {
      listCookbooks.mockResolvedValue({ cookbooks: [cookbookSummary()], total: 3 });

      const { caller } = callerFor();
      const result = await caller.cookbooks.list({ cursor: 0, limit: 1 });

      expect(listCookbooks).toHaveBeenCalledWith(
        {
          userId: "test-user-id",
          householdUserIds: ["test-user-id", "household-member-id"],
          isServerAdmin: false,
        },
        { limit: 1, offset: 0, search: undefined, sortMode: "dateDesc" }
      );
      expect(result.nextCursor).toBe(1);
      expect(result.total).toBe(3);
    });
  });
});
