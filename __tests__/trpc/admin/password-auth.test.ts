import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

// Setup mocks
vi.mock("@/server/db/repositories/server-config", () => import("../../mocks/server-config"));
vi.mock("@/server/db/repositories/users", () => import("../../mocks/users"));
vi.mock("@/server/logger", () => ({
  trpcLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Import mocks
import { setConfig, configExists } from "../../mocks/server-config";
import { isUserServerAdmin } from "../../mocks/users";

import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

// Test utilities
function createMockAdminUser() {
  return {
    id: "admin-user-id",
    email: "admin@example.com",
    name: "Admin User",
    image: null,
  };
}

function createMockAdminContext(user = createMockAdminUser()) {
  return { user };
}

// Create test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAdminContext>>().create({
  transformer: superjson,
});

// Admin middleware
const adminMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const isAdmin = await isUserServerAdmin(ctx.user.id);

  if (!isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Server admin access required" });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

const adminProcedure = t.procedure.use(adminMiddleware);

describe("Password Auth Admin Procedures", () => {
  const mockAdmin = createMockAdminUser();

  beforeEach(() => {
    vi.clearAllMocks();
    isUserServerAdmin.mockImplementation((userId: string) => {
      return Promise.resolve(userId === mockAdmin.id);
    });
  });

  describe("updatePasswordAuth", () => {
    it("enables password auth for admin users", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        updatePasswordAuth: adminProcedure.input(z.boolean()).mutation(async ({ input }) => {
          await setConfig(ServerConfigKeys.PASSWORD_AUTH_ENABLED, input, ctx.user.id, false);

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.updatePasswordAuth(true);

      expect(result).toEqual({ success: true });
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.PASSWORD_AUTH_ENABLED,
        true,
        mockAdmin.id,
        false
      );
    });

    it("disables password auth for admin users", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        updatePasswordAuth: adminProcedure.input(z.boolean()).mutation(async ({ input }) => {
          await setConfig(ServerConfigKeys.PASSWORD_AUTH_ENABLED, input, ctx.user.id, false);

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.updatePasswordAuth(false);

      expect(result).toEqual({ success: true });
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.PASSWORD_AUTH_ENABLED,
        false,
        mockAdmin.id,
        false
      );
    });

    it("rejects non-admin users", async () => {
      const nonAdminUser = {
        id: "regular-user-id",
        email: "user@example.com",
        name: "Regular User",
        image: null,
      };
      const ctx = createMockAdminContext(nonAdminUser);

      const testRouter = t.router({
        updatePasswordAuth: adminProcedure.input(z.boolean()).mutation(async ({ input }) => {
          await setConfig(ServerConfigKeys.PASSWORD_AUTH_ENABLED, input, ctx.user.id, false);

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await expect(caller.updatePasswordAuth(true)).rejects.toThrow(TRPCError);
    });

    it("returns error when disabling password auth with no OAuth providers configured", async () => {
      // Arrange
      const ctx = createMockAdminContext(mockAdmin);

      configExists.mockResolvedValue(false);
      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        updatePasswordAuth: adminProcedure.input(z.boolean()).mutation(async ({ input }) => {
          if (input === false) {
            const oauthProviderKeys = [
              ServerConfigKeys.AUTH_PROVIDER_OIDC,
              ServerConfigKeys.AUTH_PROVIDER_GITHUB,
              ServerConfigKeys.AUTH_PROVIDER_GOOGLE,
            ];

            const hasOAuthProvider = await Promise.all(
              oauthProviderKeys.map((k) => configExists(k))
            ).then((results) => results.some(Boolean));

            if (!hasOAuthProvider) {
              return {
                success: false,
                error: "Cannot delete the last authentication method.",
              };
            }
          }

          await setConfig(ServerConfigKeys.PASSWORD_AUTH_ENABLED, input, ctx.user.id, false);

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      // Act
      const result = await caller.updatePasswordAuth(false);

      // Assert
      expect(result).toEqual({
        success: false,
        error: "Cannot delete the last authentication method.",
      });
      expect(setConfig).not.toHaveBeenCalled();
    });
  });
});
