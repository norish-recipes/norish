import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

// Setup mocks before any imports that use them
vi.mock("@/server/db/repositories/server-config", () => import("../../mocks/server-config"));
vi.mock("@/server/db/repositories/users", () => import("../../mocks/users"));
vi.mock("@/server/auth/connection-tests", () => import("../../mocks/connection-tests"));
vi.mock(
  "@/server/trpc/routers/permissions/emitter",
  () => import("../../mocks/permissions-emitter")
);
vi.mock("@/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({
    view: "everyone",
    edit: "household",
    delete: "household",
  }),
  isAIEnabled: vi.fn().mockResolvedValue(false),
}));

// Import mocks for assertions
import {
  getAllConfigs,
  getConfig,
  setConfig,
  deleteConfig,
  configExists,
  getConfigSecret,
} from "../../mocks/server-config";
import { isUserServerAdmin, getUserServerRole } from "../../mocks/users";
import { testAIEndpoint } from "../../mocks/connection-tests";
import { permissionsEmitter } from "../../mocks/permissions-emitter";

import {
  createMockUser,
  createMockAdminUser,
  createMockAuthedContext,
  createMockAdminContext,
} from "./test-utils";

import { getRecipePermissionPolicy } from "@/config/server-config-loader";
// Import schemas for validation
import {
  ServerConfigKeys,
  AIConfigSchema,
  RecipePermissionPolicySchema,
} from "@/server/db/zodSchemas/server-config";

// Create a test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

// Create admin middleware for testing
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
const authedProcedure = t.procedure;

describe("admin procedures", () => {
  const mockUser = createMockUser();
  const mockAdmin = createMockAdminUser();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: admin check returns true for admin users
    isUserServerAdmin.mockImplementation((userId: string) => {
      return Promise.resolve(userId === mockAdmin.id);
    });
  });

  describe("getAllConfigs", () => {
    it("returns all configs for admin users", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const mockConfigs = {
        [ServerConfigKeys.REGISTRATION_ENABLED]: true,
        [ServerConfigKeys.AI_CONFIG]: { enabled: false },
      };

      getAllConfigs.mockResolvedValue(mockConfigs);

      const testRouter = t.router({
        getAllConfigs: adminProcedure.query(async () => {
          return getAllConfigs(false);
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getAllConfigs();

      expect(result).toEqual(mockConfigs);
      expect(getAllConfigs).toHaveBeenCalledWith(false);
    });

    it("throws FORBIDDEN for non-admin users", async () => {
      const ctx = createMockAuthedContext(mockUser);

      const testRouter = t.router({
        getAllConfigs: adminProcedure.query(async () => {
          return getAllConfigs(false);
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await expect(caller.getAllConfigs()).rejects.toThrow(TRPCError);
    });
  });

  describe("getUserRole", () => {
    it("returns user role for any authenticated user", async () => {
      const ctx = createMockAuthedContext(mockUser);
      const mockRole = { isOwner: false, isAdmin: false };

      getUserServerRole.mockResolvedValue(mockRole);

      const testRouter = t.router({
        getUserRole: authedProcedure.query(async () => {
          return getUserServerRole(ctx.user.id);
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getUserRole();

      expect(result).toEqual(mockRole);
      expect(getUserServerRole).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe("updateRegistration", () => {
    it("updates registration setting for admin users", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        updateRegistration: adminProcedure.input(z.boolean()).mutation(async ({ input }) => {
          await setConfig(ServerConfigKeys.REGISTRATION_ENABLED, input, ctx.user.id, false);

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.updateRegistration(true);

      expect(result).toEqual({ success: true });
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.REGISTRATION_ENABLED,
        true,
        mockAdmin.id,
        false
      );
    });
  });

  describe("updateAIConfig", () => {
    it("updates AI config and broadcasts policyUpdated when enabled state changes", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const newConfig = {
        enabled: true,
        provider: "openai" as const,
        model: "gpt-4",
        temperature: 0.7,
        maxTokens: 4096,
        autoTagAllergies: true,
        alwaysUseAI: false,
      };

      // Current config has enabled: false
      getConfig.mockResolvedValue({ enabled: false });
      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        updateAIConfig: adminProcedure.input(AIConfigSchema).mutation(async ({ input }) => {
          const currentConfig = await getConfig(ServerConfigKeys.AI_CONFIG);
          const enabledChanged = currentConfig?.enabled !== input.enabled;

          await setConfig(ServerConfigKeys.AI_CONFIG, input, ctx.user.id, true);

          if (enabledChanged) {
            // Broadcast policyUpdated so all users get updated isAIEnabled
            const recipePolicy = await getRecipePermissionPolicy();

            permissionsEmitter.broadcast("policyUpdated", { recipePolicy });
          }

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.updateAIConfig(newConfig);

      expect(result).toEqual({ success: true });
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.AI_CONFIG,
        newConfig,
        mockAdmin.id,
        true
      );
      expect(permissionsEmitter.broadcast).toHaveBeenCalledWith("policyUpdated", {
        recipePolicy: { view: "everyone", edit: "household", delete: "household" },
      });
    });

    it("does not broadcast when enabled state unchanged", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const newConfig = {
        enabled: false,
        provider: "openai" as const,
        model: "gpt-4",
        temperature: 0.7,
        maxTokens: 4096,
        autoTagAllergies: true,
        alwaysUseAI: false,
      };

      // Current config also has enabled: false
      getConfig.mockResolvedValue({ enabled: false });
      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        updateAIConfig: adminProcedure.input(AIConfigSchema).mutation(async ({ input }) => {
          const currentConfig = await getConfig(ServerConfigKeys.AI_CONFIG);
          const enabledChanged = currentConfig?.enabled !== input.enabled;

          await setConfig(ServerConfigKeys.AI_CONFIG, input, ctx.user.id, true);

          if (enabledChanged) {
            const recipePolicy = await getRecipePermissionPolicy();

            permissionsEmitter.broadcast("policyUpdated", { recipePolicy });
          }

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await caller.updateAIConfig(newConfig);

      // permissionsEmitter.broadcast may have been called by other tests, so we check
      // that it wasn't called with policyUpdated in this test specifically
      expect(permissionsEmitter.broadcast).not.toHaveBeenCalled();
    });
  });

  describe("updateRecipePermissionPolicy", () => {
    it("updates policy and broadcasts to all users", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const newPolicy = {
        view: "household" as const,
        edit: "owner" as const,
        delete: "owner" as const,
      };

      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        updateRecipePermissionPolicy: adminProcedure
          .input(RecipePermissionPolicySchema)
          .mutation(async ({ input }) => {
            await setConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY, input, ctx.user.id, false);
            permissionsEmitter.broadcast("policyUpdated", { recipePolicy: input });

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.updateRecipePermissionPolicy(newPolicy);

      expect(result).toEqual({ success: true });
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.RECIPE_PERMISSION_POLICY,
        newPolicy,
        mockAdmin.id,
        false
      );
      expect(permissionsEmitter.broadcast).toHaveBeenCalledWith("policyUpdated", {
        recipePolicy: newPolicy,
      });
    });
  });

  describe("deleteAuthProvider", () => {
    it("prevents deleting last auth provider", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      // Mock: only OIDC exists, no other providers
      configExists.mockImplementation((key: string) => {
        return Promise.resolve(key === ServerConfigKeys.AUTH_PROVIDER_OIDC);
      });

      const testRouter = t.router({
        deleteProvider: adminProcedure
          .input(z.enum(["oidc", "github", "google"]))
          .mutation(async ({ input }) => {
            const keyMap: Record<string, string> = {
              oidc: ServerConfigKeys.AUTH_PROVIDER_OIDC,
              github: ServerConfigKeys.AUTH_PROVIDER_GITHUB,
              google: ServerConfigKeys.AUTH_PROVIDER_GOOGLE,
            };

            const otherProviderKeys = Object.entries(keyMap)
              .filter(([k]) => k !== input)
              .map(([, v]) => v);

            const hasOtherProvider = await Promise.all(
              otherProviderKeys.map((k) => configExists(k))
            ).then((results) => results.some(Boolean));

            if (!hasOtherProvider) {
              return {
                success: false,
                error: "Cannot delete the last authentication provider.",
              };
            }

            await deleteConfig(keyMap[input]);

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.deleteProvider("oidc");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot delete the last authentication provider");
      expect(deleteConfig).not.toHaveBeenCalled();
    });

    it("allows deleting when other providers exist", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      // Mock: OIDC and GitHub both exist
      configExists.mockImplementation((key: string) => {
        return Promise.resolve(
          key === ServerConfigKeys.AUTH_PROVIDER_OIDC ||
            key === ServerConfigKeys.AUTH_PROVIDER_GITHUB
        );
      });
      deleteConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        deleteProvider: adminProcedure
          .input(z.enum(["oidc", "github", "google"]))
          .mutation(async ({ input }) => {
            const keyMap: Record<string, string> = {
              oidc: ServerConfigKeys.AUTH_PROVIDER_OIDC,
              github: ServerConfigKeys.AUTH_PROVIDER_GITHUB,
              google: ServerConfigKeys.AUTH_PROVIDER_GOOGLE,
            };

            const otherProviderKeys = Object.entries(keyMap)
              .filter(([k]) => k !== input)
              .map(([, v]) => v);

            const hasOtherProvider = await Promise.all(
              otherProviderKeys.map((k) => configExists(k))
            ).then((results) => results.some(Boolean));

            if (!hasOtherProvider) {
              return {
                success: false,
                error: "Cannot delete the last authentication provider.",
              };
            }

            await deleteConfig(keyMap[input]);

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.deleteProvider("oidc");

      expect(result.success).toBe(true);
      expect(deleteConfig).toHaveBeenCalledWith(ServerConfigKeys.AUTH_PROVIDER_OIDC);
    });
  });

  describe("testAIEndpoint", () => {
    it("calls test function and returns result", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const config = {
        provider: "openai" as const,
        endpoint: "https://api.openai.com",
        apiKey: "test-key",
      };

      testAIEndpoint.mockResolvedValue({ success: true });

      const testRouter = t.router({
        testAIEndpoint: adminProcedure
          .input(
            z.object({
              provider: z.enum(["openai", "ollama", "lm-studio", "generic-openai"]),
              endpoint: z.string().url().optional(),
              apiKey: z.string().optional(),
            })
          )
          .mutation(async ({ input }) => {
            return testAIEndpoint(input);
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.testAIEndpoint(config);

      expect(result).toEqual({ success: true });
      expect(testAIEndpoint).toHaveBeenCalledWith(config);
    });
  });

  describe("getSecretField", () => {
    it("returns decrypted secret for admin users", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      getConfigSecret.mockResolvedValue("decrypted-secret-value");

      const testRouter = t.router({
        getSecretField: adminProcedure
          .input(
            z.object({
              key: z.nativeEnum(ServerConfigKeys),
              field: z.string().min(1),
            })
          )
          .query(async ({ input }) => {
            const secret = await getConfigSecret(input.key, input.field);

            return { value: secret };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getSecretField({
        key: ServerConfigKeys.AI_CONFIG,
        field: "apiKey",
      });

      expect(result.value).toBe("decrypted-secret-value");
      expect(getConfigSecret).toHaveBeenCalledWith(ServerConfigKeys.AI_CONFIG, "apiKey");
    });
  });
});
