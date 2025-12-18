import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

// Setup mocks before any imports that use them
vi.mock("@/server/db/repositories/server-config", () => import("../../mocks/server-config"));
vi.mock("@/server/db/repositories/users", () => import("../../mocks/users"));
vi.mock("@/server/ai/prompts/loader", () => ({
  loadDefaultPrompts: vi.fn().mockReturnValue({
    recipeExtraction: "Default recipe extraction prompt",
    unitConversion: "Default unit conversion prompt",
    nutritionEstimation: "Default nutrition estimation prompt",
  }),
}));

// Import mocks for assertions
import { getConfig, setConfig } from "../../mocks/server-config";
import { isUserServerAdmin } from "../../mocks/users";

import {
  createMockAdminUser,
  createMockUser,
  createMockAuthedContext,
  createMockAdminContext,
} from "./test-utils";

import { loadDefaultPrompts } from "@/server/ai/prompts/loader";
import {
  ServerConfigKeys,
  PromptsConfigSchema,
  PromptsConfigInputSchema,
  type PromptsConfig,
  type PromptsConfigInput,
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

describe("prompts procedures", () => {
  const mockUser = createMockUser();
  const mockAdmin = createMockAdminUser();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: admin check returns true for admin users
    isUserServerAdmin.mockImplementation((userId: string) => {
      return Promise.resolve(userId === mockAdmin.id);
    });
  });

  describe("getPrompts", () => {
    it("returns prompts from database for admin users", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const mockPrompts: PromptsConfig = {
        recipeExtraction: "Custom extraction prompt",
        unitConversion: "Custom conversion prompt",
        nutritionEstimation: "Custom nutrition estimation prompt",
        isOverridden: true,
      };

      getConfig.mockResolvedValue(mockPrompts);

      const testRouter = t.router({
        getPrompts: adminProcedure.query(async () => {
          const value = await getConfig(ServerConfigKeys.PROMPTS);

          if (value) return value as PromptsConfig;

          return loadDefaultPrompts();
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getPrompts();

      expect(result).toEqual(mockPrompts);
      expect(getConfig).toHaveBeenCalledWith(ServerConfigKeys.PROMPTS);
    });

    it("returns default prompts when not set in database", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const defaultPrompts = {
        recipeExtraction: "Default recipe extraction prompt",
        unitConversion: "Default unit conversion prompt",
        nutritionEstimation: "Default nutrition estimation prompt",
      };

      getConfig.mockResolvedValue(null);
      (loadDefaultPrompts as any).mockReturnValue(defaultPrompts);

      const testRouter = t.router({
        getPrompts: adminProcedure.query(async () => {
          const value = await getConfig(ServerConfigKeys.PROMPTS);

          if (value) return value as PromptsConfig;

          return loadDefaultPrompts();
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getPrompts();

      expect(result).toEqual(defaultPrompts);
      expect(loadDefaultPrompts).toHaveBeenCalled();
    });

    it("throws FORBIDDEN for non-admin users", async () => {
      const ctx = createMockAuthedContext(mockUser);

      const testRouter = t.router({
        getPrompts: adminProcedure.query(async () => {
          return getConfig(ServerConfigKeys.PROMPTS);
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await expect(caller.getPrompts()).rejects.toThrow(TRPCError);
    });
  });

  describe("updatePrompts", () => {
    it("updates prompts for admin users", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const newPrompts: PromptsConfigInput = {
        recipeExtraction: "Updated extraction prompt",
        unitConversion: "Updated conversion prompt",
        nutritionEstimation: "Updated nutrition estimation prompt",
      };

      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        updatePrompts: adminProcedure.input(PromptsConfigInputSchema).mutation(async ({ input }) => {
          await setConfig(ServerConfigKeys.PROMPTS, { ...input, isOverridden: true }, ctx.user.id, false);

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.updatePrompts(newPrompts);

      expect(result).toEqual({ success: true });
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.PROMPTS,
        { ...newPrompts, isOverridden: true },
        mockAdmin.id,
        false
      );
    });

    it("throws FORBIDDEN for non-admin users", async () => {
      const ctx = createMockAuthedContext(mockUser);
      const newPrompts: PromptsConfigInput = {
        recipeExtraction: "Updated extraction prompt",
        unitConversion: "Updated conversion prompt",
        nutritionEstimation: "Updated nutrition estimation prompt",
      };

      const testRouter = t.router({
        updatePrompts: adminProcedure.input(PromptsConfigInputSchema).mutation(async ({ input }) => {
          await setConfig(ServerConfigKeys.PROMPTS, { ...input, isOverridden: true }, ctx.user.id, false);

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await expect(caller.updatePrompts(newPrompts)).rejects.toThrow(TRPCError);
    });

    it("validates input against schema", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      const testRouter = t.router({
        updatePrompts: adminProcedure.input(PromptsConfigInputSchema).mutation(async ({ input }) => {
          await setConfig(ServerConfigKeys.PROMPTS, { ...input, isOverridden: true }, ctx.user.id, false);

          return { success: true };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      // Missing required fields should fail validation
      await expect(
        caller.updatePrompts({ recipeExtraction: "only one field" } as any)
      ).rejects.toThrow();
    });
  });

  describe("restoreDefault for PROMPTS", () => {
    it("restores prompts to defaults from text files", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const defaultPrompts = {
        recipeExtraction: "Default recipe extraction prompt",
        unitConversion: "Default unit conversion prompt",
        nutritionEstimation: "Default nutrition estimation prompt",
      };

      (loadDefaultPrompts as any).mockReturnValue(defaultPrompts);
      setConfig.mockResolvedValue(undefined);

      const getDefaultConfigValue = (key: string) => {
        if (key === ServerConfigKeys.PROMPTS) {
          return loadDefaultPrompts();
        }

        return null;
      };

      const testRouter = t.router({
        restoreDefault: adminProcedure
          .input(PromptsConfigSchema.keyof())
          .mutation(async ({ input }) => {
            const defaultValue = getDefaultConfigValue(ServerConfigKeys.PROMPTS);

            if (defaultValue === null) {
              return { success: false, error: `No default value available for ${input}` };
            }

            await setConfig(ServerConfigKeys.PROMPTS, defaultValue, ctx.user.id, false);

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.restoreDefault("recipeExtraction");

      expect(result).toEqual({ success: true });
      expect(loadDefaultPrompts).toHaveBeenCalled();
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.PROMPTS,
        defaultPrompts,
        mockAdmin.id,
        false
      );
    });
  });
});
