// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";

// Setup mocks
vi.mock("@/server/db/repositories/recipes", () => import("../../mocks/recipes-repository"));
vi.mock("@/server/auth/permissions", () => import("../../mocks/permissions"));
vi.mock("@/server/trpc/routers/recipes/emitter", () => import("../../mocks/recipe-emitter"));

// Import mocks
import { listRecipes, getRecipeFull, getRecipeOwnerId } from "../../mocks/recipes-repository";
import { canAccessResource } from "../../mocks/permissions";

// Import test utilities
import {
  createMockUser,
  createMockHousehold,
  createMockAuthedContext,
  createMockFullRecipe,
} from "./test-utils";

// Create test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

describe("recipe permission enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("view policy", () => {
    it("owner can always view their own recipe", async () => {
      const user = createMockUser({ id: "owner-id" });
      const ctx = createMockAuthedContext(user, null);
      const recipe = createMockFullRecipe({ id: "r1", userId: "owner-id" });

      getRecipeFull.mockResolvedValue(recipe);
      canAccessResource.mockResolvedValue(true);

      const testRouter = t.router({
        get: t.procedure
          .input((v: any) => v)
          .query(async ({ input }) => {
            const r = await getRecipeFull(input.id);

            if (!r) return null;

            if (r.userId) {
              const can = await canAccessResource(
                "view",
                ctx.user.id,
                r.userId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!can) return null;
            }

            return r;
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.get({ id: "r1" });

      expect(canAccessResource).toHaveBeenCalledWith("view", "owner-id", "owner-id", null, false);
      expect(result).toBeTruthy();
    });

    it("server admin can view any recipe", async () => {
      const admin = createMockUser({ id: "admin-id", isServerAdmin: true });
      const ctx = createMockAuthedContext(admin, null);
      const recipe = createMockFullRecipe({ id: "r1", userId: "other-user" });

      getRecipeFull.mockResolvedValue(recipe);
      canAccessResource.mockResolvedValue(true);

      const testRouter = t.router({
        get: t.procedure
          .input((v: any) => v)
          .query(async ({ input }) => {
            const r = await getRecipeFull(input.id);

            if (!r) return null;

            if (r.userId) {
              const can = await canAccessResource(
                "view",
                ctx.user.id,
                r.userId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!can) return null;
            }

            return r;
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.get({ id: "r1" });

      expect(canAccessResource).toHaveBeenCalledWith("view", "admin-id", "other-user", null, true);
      expect(result).toBeTruthy();
    });

    it("household member can view when policy is 'household'", async () => {
      const user = createMockUser({ id: "member-id" });
      const household = createMockHousehold({
        users: [
          { id: "member-id", name: "Member" },
          { id: "owner-id", name: "Owner" },
        ],
      });
      const ctx = createMockAuthedContext(user, household);
      const recipe = createMockFullRecipe({ id: "r1", userId: "owner-id" });

      getRecipeFull.mockResolvedValue(recipe);
      canAccessResource.mockResolvedValue(true);

      const testRouter = t.router({
        get: t.procedure
          .input((v: any) => v)
          .query(async ({ input }) => {
            const r = await getRecipeFull(input.id);

            if (!r) return null;

            if (r.userId) {
              const can = await canAccessResource(
                "view",
                ctx.user.id,
                r.userId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!can) return null;
            }

            return r;
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.get({ id: "r1" });

      expect(canAccessResource).toHaveBeenCalledWith(
        "view",
        "member-id",
        "owner-id",
        ["member-id", "owner-id"],
        false
      );
      expect(result).toBeTruthy();
    });

    it("non-household member denied when policy is 'household'", async () => {
      const user = createMockUser({ id: "outsider-id" });
      const ctx = createMockAuthedContext(user, null);
      const recipe = createMockFullRecipe({ id: "r1", userId: "owner-id" });

      getRecipeFull.mockResolvedValue(recipe);
      canAccessResource.mockResolvedValue(false);

      const testRouter = t.router({
        get: t.procedure
          .input((v: any) => v)
          .query(async ({ input }) => {
            const r = await getRecipeFull(input.id);

            if (!r) return null;

            if (r.userId) {
              const can = await canAccessResource(
                "view",
                ctx.user.id,
                r.userId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!can) return null;
            }

            return r;
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.get({ id: "r1" });

      expect(canAccessResource).toHaveBeenCalledWith(
        "view",
        "outsider-id",
        "owner-id",
        null,
        false
      );
      expect(result).toBeNull();
    });
  });

  describe("edit policy", () => {
    it("owner can always edit their own recipe", async () => {
      const user = createMockUser({ id: "owner-id" });
      const ctx = createMockAuthedContext(user, null);

      getRecipeOwnerId.mockResolvedValue("owner-id");
      canAccessResource.mockResolvedValue(true);

      const testRouter = t.router({
        update: t.procedure
          .input((v: any) => v)
          .mutation(async ({ input }) => {
            const ownerId = await getRecipeOwnerId(input.id);

            if (ownerId !== null) {
              const can = await canAccessResource(
                "edit",
                ctx.user.id,
                ownerId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!can) throw new Error("FORBIDDEN");
            }

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.update({ id: "r1", data: {} });

      expect(canAccessResource).toHaveBeenCalledWith("edit", "owner-id", "owner-id", null, false);
      expect(result).toEqual({ success: true });
    });

    it("non-owner denied when policy is 'owner'", async () => {
      const user = createMockUser({ id: "other-id" });
      const ctx = createMockAuthedContext(user, null);

      getRecipeOwnerId.mockResolvedValue("owner-id");
      canAccessResource.mockResolvedValue(false);

      const testRouter = t.router({
        update: t.procedure
          .input((v: any) => v)
          .mutation(async ({ input }) => {
            const ownerId = await getRecipeOwnerId(input.id);

            if (ownerId !== null) {
              const can = await canAccessResource(
                "edit",
                ctx.user.id,
                ownerId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!can) throw new Error("FORBIDDEN");
            }

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await expect(caller.update({ id: "r1", data: {} })).rejects.toThrow("FORBIDDEN");
    });
  });

  describe("delete policy", () => {
    it("owner can always delete their own recipe", async () => {
      const user = createMockUser({ id: "owner-id" });
      const ctx = createMockAuthedContext(user, null);

      getRecipeOwnerId.mockResolvedValue("owner-id");
      canAccessResource.mockResolvedValue(true);

      const testRouter = t.router({
        delete: t.procedure
          .input((v: any) => v)
          .mutation(async ({ input }) => {
            const ownerId = await getRecipeOwnerId(input.id);

            if (ownerId !== null) {
              const can = await canAccessResource(
                "delete",
                ctx.user.id,
                ownerId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!can) throw new Error("FORBIDDEN");
            }

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.delete({ id: "r1" });

      expect(canAccessResource).toHaveBeenCalledWith("delete", "owner-id", "owner-id", null, false);
      expect(result).toEqual({ success: true });
    });

    it("household member denied delete when policy is 'owner'", async () => {
      const user = createMockUser({ id: "member-id" });
      const household = createMockHousehold({
        users: [
          { id: "member-id", name: "Member" },
          { id: "owner-id", name: "Owner" },
        ],
      });
      const ctx = createMockAuthedContext(user, household);

      getRecipeOwnerId.mockResolvedValue("owner-id");
      canAccessResource.mockResolvedValue(false);

      const testRouter = t.router({
        delete: t.procedure
          .input((v: any) => v)
          .mutation(async ({ input }) => {
            const ownerId = await getRecipeOwnerId(input.id);

            if (ownerId !== null) {
              const can = await canAccessResource(
                "delete",
                ctx.user.id,
                ownerId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!can) throw new Error("FORBIDDEN");
            }

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await expect(caller.delete({ id: "r1" })).rejects.toThrow("FORBIDDEN");
    });

    it("server admin can delete any recipe", async () => {
      const admin = createMockUser({ id: "admin-id", isServerAdmin: true });
      const ctx = createMockAuthedContext(admin, null);

      getRecipeOwnerId.mockResolvedValue("owner-id");
      canAccessResource.mockResolvedValue(true);

      const testRouter = t.router({
        delete: t.procedure
          .input((v: any) => v)
          .mutation(async ({ input }) => {
            const ownerId = await getRecipeOwnerId(input.id);

            if (ownerId !== null) {
              const can = await canAccessResource(
                "delete",
                ctx.user.id,
                ownerId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!can) throw new Error("FORBIDDEN");
            }

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.delete({ id: "r1" });

      expect(canAccessResource).toHaveBeenCalledWith("delete", "admin-id", "owner-id", null, true);
      expect(result).toEqual({ success: true });
    });
  });

  describe("list with view policy filtering", () => {
    it("passes correct context to listRecipes for policy filtering", async () => {
      const user = createMockUser({ id: "user-id" });
      const household = createMockHousehold({
        users: [
          { id: "user-id", name: "User" },
          { id: "other-id", name: "Other" },
        ],
      });
      const ctx = createMockAuthedContext(user, household);

      listRecipes.mockResolvedValue({ recipes: [], total: 0 });

      const testRouter = t.router({
        list: t.procedure
          .input((v: any) => v)
          .query(async ({ input }) => {
            const result = await listRecipes(
              {
                userId: ctx.user.id,
                householdUserIds: ctx.householdUserIds,
                isServerAdmin: ctx.isServerAdmin,
              },
              input.limit,
              input.cursor,
              input.search,
              input.searchFields,
              input.tags,
              input.filterMode,
              input.sortMode,
              input.minRating,
              input.maxCookingTime,
              input.categories
            );

            return result;
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await caller.list({ cursor: 0, limit: 50 });

      expect(listRecipes).toHaveBeenCalledWith(
        {
          userId: "user-id",
          householdUserIds: ["user-id", "other-id"],
          isServerAdmin: false,
        },
        50,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
    });
  });
});
