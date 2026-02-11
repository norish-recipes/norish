// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

// Setup mocks before any imports that use them
vi.mock("@/server/db", () => import("../../mocks/user-repository"));
vi.mock("@/config/env-config-server", () => ({
  SERVER_CONFIG: {
    UPLOADS_DIR: "/tmp/uploads",
  },
}));
vi.mock("@/server/startup/media-cleanup", () => ({
  deleteAvatarByFilename: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
}));

// Import mocks for assertions
import {
  updateUserName,
  deleteUser,
  getHouseholdForUser,
  getApiKeysForUser,
  createApiKey,
  deleteApiKey,
  enableApiKey,
  disableApiKey,
  resetUserMocks,
} from "../../mocks/user-repository";

// Import test utilities
import {
  createMockUser,
  createMockAuthedContext,
  createMockApiKey,
  createMockHousehold,
} from "./test-utils";

// Create a test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

// Create authed middleware for testing
const authedMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({ ctx });
});

const authedProcedure = t.procedure.use(authedMiddleware);

describe("user procedures", () => {
  const mockUser = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    resetUserMocks();
  });

  describe("get", () => {
    it("returns user settings with API keys", async () => {
      const ctx = createMockAuthedContext(mockUser);
      const mockApiKeys = [
        createMockApiKey(),
        createMockApiKey({ id: "key-2", name: "Second Key" }),
      ];

      getApiKeysForUser.mockResolvedValue(mockApiKeys);

      const testRouter = t.router({
        get: authedProcedure.query(async ({ ctx }) => {
          const apiKeys = await getApiKeysForUser(ctx.user.id);

          return {
            user: {
              id: ctx.user.id,
              email: ctx.user.email,
              name: ctx.user.name,
              image: ctx.user.image,
            },
            apiKeys: apiKeys.map((k: any) => ({
              id: k.id,
              name: k.name,
              start: k.start,
              createdAt: k.createdAt,
              expiresAt: k.expiresAt,
              enabled: k.enabled,
            })),
          };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.get();

      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.apiKeys).toHaveLength(2);
      expect(getApiKeysForUser).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe("updateName", () => {
    it("updates user name successfully", async () => {
      const ctx = createMockAuthedContext(mockUser);
      const newName = "New Name";

      updateUserName.mockResolvedValue(undefined);

      const testRouter = t.router({
        updateName: authedProcedure
          .input((val: unknown) => {
            if (typeof val !== "object" || val === null || !("name" in val)) {
              throw new Error("Invalid input");
            }

            return val as { name: string };
          })
          .mutation(async ({ ctx, input }) => {
            const trimmedName = input.name.trim();

            if (!trimmedName) {
              return { success: false, error: "Name cannot be empty" };
            }

            await updateUserName(ctx.user.id, trimmedName);

            return {
              success: true,
              user: { ...ctx.user, name: trimmedName },
            };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.updateName({ name: newName });

      expect(result.success).toBe(true);
      expect(result.user?.name).toBe(newName);
      expect(updateUserName).toHaveBeenCalledWith(mockUser.id, newName);
    });

    it("rejects empty name", async () => {
      const ctx = createMockAuthedContext(mockUser);

      const testRouter = t.router({
        updateName: authedProcedure
          .input((val: unknown) => {
            if (typeof val !== "object" || val === null || !("name" in val)) {
              throw new Error("Invalid input");
            }

            return val as { name: string };
          })
          .mutation(async ({ input }) => {
            const trimmedName = input.name.trim();

            if (!trimmedName) {
              return { success: false, error: "Name cannot be empty" };
            }

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.updateName({ name: "   " });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Name cannot be empty");
    });
  });

  describe("deleteAccount", () => {
    it("deletes account when user is not household admin", async () => {
      const ctx = createMockAuthedContext(mockUser, null);

      getHouseholdForUser.mockResolvedValue(null);
      deleteUser.mockResolvedValue(undefined);

      const testRouter = t.router({
        deleteAccount: authedProcedure.mutation(async ({ ctx }) => {
          const household = await getHouseholdForUser(ctx.user.id);

          if (household && household.adminUserId === ctx.user.id) {
            const memberCount = household.users.length;

            if (memberCount > 1) {
              return {
                success: false,
                error: "You cannot delete your account while admin with other members.",
              };
            }
          }

          await deleteUser(ctx.user.id);

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.deleteAccount();

      expect(result.success).toBe(true);
      expect(deleteUser).toHaveBeenCalledWith(mockUser.id);
    });

    it("prevents deletion when user is admin with other members", async () => {
      const ctx = createMockAuthedContext(mockUser);
      const household = createMockHousehold({
        adminUserId: mockUser.id,
        users: [
          { id: mockUser.id, name: mockUser.name },
          { id: "other-user", name: "Other User" },
        ],
      });

      getHouseholdForUser.mockResolvedValue(household);

      const testRouter = t.router({
        deleteAccount: authedProcedure.mutation(async ({ ctx }) => {
          const household = await getHouseholdForUser(ctx.user.id);

          if (household && household.adminUserId === ctx.user.id) {
            const memberCount = household.users.length;

            if (memberCount > 1) {
              return {
                success: false,
                error: "You cannot delete your account while admin with other members.",
              };
            }
          }

          await deleteUser(ctx.user.id);

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.deleteAccount();

      expect(result.success).toBe(false);
      expect(result.error).toContain("admin with other members");
      expect(deleteUser).not.toHaveBeenCalled();
    });

    it("allows deletion when user is only household member", async () => {
      const ctx = createMockAuthedContext(mockUser);
      const household = createMockHousehold({
        adminUserId: mockUser.id,
        users: [{ id: mockUser.id, name: mockUser.name }],
      });

      getHouseholdForUser.mockResolvedValue(household);
      deleteUser.mockResolvedValue(undefined);

      const testRouter = t.router({
        deleteAccount: authedProcedure.mutation(async ({ ctx }) => {
          const household = await getHouseholdForUser(ctx.user.id);

          if (household && household.adminUserId === ctx.user.id) {
            const memberCount = household.users.length;

            if (memberCount > 1) {
              return {
                success: false,
                error: "You cannot delete your account while admin with other members.",
              };
            }
          }

          await deleteUser(ctx.user.id);

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.deleteAccount();

      expect(result.success).toBe(true);
      expect(deleteUser).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe("API keys", () => {
    describe("create", () => {
      it("creates API key successfully", async () => {
        const ctx = createMockAuthedContext(mockUser);
        const mockKey = createMockApiKey();

        createApiKey.mockResolvedValue({
          key: "sk-full-key-value",
          metadata: mockKey,
        });

        const testRouter = t.router({
          create: authedProcedure
            .input((val: unknown) => val as { name?: string })
            .mutation(async ({ ctx, input }) => {
              const { key, metadata } = await createApiKey(ctx.user.id, input.name);

              return {
                success: true,
                key,
                metadata: {
                  id: metadata.id,
                  name: metadata.name,
                  start: metadata.start,
                  createdAt: metadata.createdAt,
                  expiresAt: metadata.expiresAt,
                  enabled: metadata.enabled,
                },
              };
            }),
        });

        const caller = t.createCallerFactory(testRouter)(ctx);
        const result = await caller.create({ name: "My API Key" });

        expect(result.success).toBe(true);
        expect(result.key).toBe("sk-full-key-value");
        expect(result.metadata.id).toBe(mockKey.id);
        expect(createApiKey).toHaveBeenCalledWith(mockUser.id, "My API Key");
      });
    });

    describe("delete", () => {
      it("deletes API key successfully", async () => {
        const ctx = createMockAuthedContext(mockUser);

        deleteApiKey.mockResolvedValue(undefined);

        const testRouter = t.router({
          delete: authedProcedure
            .input((val: unknown) => val as { keyId: string })
            .mutation(async ({ ctx, input }) => {
              await deleteApiKey(input.keyId, ctx.user.id);

              return { success: true };
            }),
        });

        const caller = t.createCallerFactory(testRouter)(ctx);
        const result = await caller.delete({ keyId: "key-to-delete" });

        expect(result.success).toBe(true);
        expect(deleteApiKey).toHaveBeenCalledWith("key-to-delete", mockUser.id);
      });
    });

    describe("toggle", () => {
      it("enables API key", async () => {
        const ctx = createMockAuthedContext(mockUser);

        enableApiKey.mockResolvedValue(undefined);

        const testRouter = t.router({
          toggle: authedProcedure
            .input((val: unknown) => val as { keyId: string; enabled: boolean })
            .mutation(async ({ ctx, input }) => {
              if (input.enabled) {
                await enableApiKey(input.keyId, ctx.user.id);
              } else {
                await disableApiKey(input.keyId, ctx.user.id);
              }

              return { success: true };
            }),
        });

        const caller = t.createCallerFactory(testRouter)(ctx);
        const result = await caller.toggle({ keyId: "key-id", enabled: true });

        expect(result.success).toBe(true);
        expect(enableApiKey).toHaveBeenCalledWith("key-id", mockUser.id);
        expect(disableApiKey).not.toHaveBeenCalled();
      });

      it("disables API key", async () => {
        const ctx = createMockAuthedContext(mockUser);

        disableApiKey.mockResolvedValue(undefined);

        const testRouter = t.router({
          toggle: authedProcedure
            .input((val: unknown) => val as { keyId: string; enabled: boolean })
            .mutation(async ({ ctx, input }) => {
              if (input.enabled) {
                await enableApiKey(input.keyId, ctx.user.id);
              } else {
                await disableApiKey(input.keyId, ctx.user.id);
              }

              return { success: true };
            }),
        });

        const caller = t.createCallerFactory(testRouter)(ctx);
        const result = await caller.toggle({ keyId: "key-id", enabled: false });

        expect(result.success).toBe(true);
        expect(disableApiKey).toHaveBeenCalledWith("key-id", mockUser.id);
        expect(enableApiKey).not.toHaveBeenCalled();
      });
    });
  });
});
