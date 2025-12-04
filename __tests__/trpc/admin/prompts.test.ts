import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

// Setup mocks before any imports that use them
vi.mock("@/server/db/repositories/server-config", () => import("../../mocks/server-config"));
vi.mock("@/server/db/repositories/users", () => import("../../mocks/users"));

// Mock seed-config for getDefaultConfigValue
vi.mock("@/server/startup/seed-config", () => ({
  getDefaultConfigValue: vi.fn((key: string) => {
    if (key === "prompt_recipe_extraction") {
      return { content: "Default recipe extraction prompt content" };
    }
    if (key === "prompt_unit_conversion") {
      return { content: "Default unit conversion prompt content" };
    }

    return null;
  }),
}));

// Import mocks for assertions
import { getConfig, setConfig } from "../../mocks/server-config";
import { isUserServerAdmin } from "../../mocks/users";

import { createMockAdminUser, createMockUser, createMockAdminContext } from "./test-utils";

import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

// Create a test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAdminContext>>().create({
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

const PromptNameSchema = z.enum(["recipe-extraction", "unit-conversion"]);

const PROMPT_NAME_TO_CONFIG_KEY: Record<string, string> = {
  "recipe-extraction": ServerConfigKeys.PROMPT_RECIPE_EXTRACTION,
  "unit-conversion": ServerConfigKeys.PROMPT_UNIT_CONVERSION,
};

// Helper to get default prompt (simulates the actual implementation)
function getDefaultPrompt(name: string): string {
  if (name === "recipe-extraction") {
    return "Default recipe extraction prompt content";
  }
  if (name === "unit-conversion") {
    return "Default unit conversion prompt content";
  }
  throw new Error(`Unknown prompt: ${name}`);
}

describe("prompts procedures", () => {
  const mockAdmin = createMockAdminUser();
  const mockUser = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: admin check returns true for admin users
    isUserServerAdmin.mockImplementation((userId: string) => {
      return Promise.resolve(userId === mockAdmin.id);
    });
  });

  describe("getPrompt", () => {
    it("returns prompt from database with isCustom=false when content matches default", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      // Database has default content (seeded on startup)
      getConfig.mockResolvedValue({ content: "Default recipe extraction prompt content" });

      const testRouter = t.router({
        getPrompt: adminProcedure
          .input(z.object({ name: PromptNameSchema }))
          .query(async ({ input }) => {
            const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];
            const stored = await getConfig(configKey);
            const defaultContent = getDefaultPrompt(input.name);

            const content = stored?.content ?? defaultContent;
            const isCustom = content !== defaultContent;

            return {
              name: input.name,
              content,
              isCustom,
              defaultContent,
            };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getPrompt({ name: "recipe-extraction" });

      expect(result.name).toBe("recipe-extraction");
      expect(result.content).toBe("Default recipe extraction prompt content");
      expect(result.isCustom).toBe(false);
      expect(result.defaultContent).toBe("Default recipe extraction prompt content");
      expect(getConfig).toHaveBeenCalledWith(ServerConfigKeys.PROMPT_RECIPE_EXTRACTION);
    });

    it("returns custom prompt with isCustom=true when content differs from default", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const customContent = "My custom recipe extraction prompt";

      // Database has custom content
      getConfig.mockResolvedValue({ content: customContent });

      const testRouter = t.router({
        getPrompt: adminProcedure
          .input(z.object({ name: PromptNameSchema }))
          .query(async ({ input }) => {
            const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];
            const stored = await getConfig(configKey);
            const defaultContent = getDefaultPrompt(input.name);

            const content = stored?.content ?? defaultContent;
            const isCustom = content !== defaultContent;

            return {
              name: input.name,
              content,
              isCustom,
              defaultContent,
            };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getPrompt({ name: "recipe-extraction" });

      expect(result.name).toBe("recipe-extraction");
      expect(result.content).toBe(customContent);
      expect(result.isCustom).toBe(true);
      expect(result.defaultContent).toBe("Default recipe extraction prompt content");
    });

    it("works for unit-conversion prompt", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      getConfig.mockResolvedValue({ content: "Default unit conversion prompt content" });

      const testRouter = t.router({
        getPrompt: adminProcedure
          .input(z.object({ name: PromptNameSchema }))
          .query(async ({ input }) => {
            const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];
            const stored = await getConfig(configKey);
            const defaultContent = getDefaultPrompt(input.name);

            const content = stored?.content ?? defaultContent;
            const isCustom = content !== defaultContent;

            return {
              name: input.name,
              content,
              isCustom,
              defaultContent,
            };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getPrompt({ name: "unit-conversion" });

      expect(result.name).toBe("unit-conversion");
      expect(result.content).toBe("Default unit conversion prompt content");
      expect(result.isCustom).toBe(false);
      expect(getConfig).toHaveBeenCalledWith(ServerConfigKeys.PROMPT_UNIT_CONVERSION);
    });

    it("throws FORBIDDEN for non-admin users", async () => {
      const ctx = createMockAdminContext(mockUser);

      const testRouter = t.router({
        getPrompt: adminProcedure
          .input(z.object({ name: PromptNameSchema }))
          .query(async ({ input }) => {
            const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];
            const stored = await getConfig(configKey);
            const defaultContent = getDefaultPrompt(input.name);

            const content = stored?.content ?? defaultContent;
            const isCustom = content !== defaultContent;

            return {
              name: input.name,
              content,
              isCustom,
              defaultContent,
            };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await expect(caller.getPrompt({ name: "recipe-extraction" })).rejects.toThrow(TRPCError);
    });
  });

  describe("updatePrompt", () => {
    it("saves custom prompt to database", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const newContent = "My new custom prompt content";

      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        updatePrompt: adminProcedure
          .input(
            z.object({
              name: PromptNameSchema,
              content: z.string().min(1),
            })
          )
          .mutation(async ({ input, ctx: procedureCtx }) => {
            const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];

            await setConfig(configKey, { content: input.content }, procedureCtx.user.id, false);

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.updatePrompt({
        name: "recipe-extraction",
        content: newContent,
      });

      expect(result).toEqual({ success: true });
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.PROMPT_RECIPE_EXTRACTION,
        { content: newContent },
        mockAdmin.id,
        false
      );
    });

    it("saves unit-conversion prompt", async () => {
      const ctx = createMockAdminContext(mockAdmin);
      const newContent = "Custom unit conversion instructions";

      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        updatePrompt: adminProcedure
          .input(
            z.object({
              name: PromptNameSchema,
              content: z.string().min(1),
            })
          )
          .mutation(async ({ input, ctx: procedureCtx }) => {
            const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];

            await setConfig(configKey, { content: input.content }, procedureCtx.user.id, false);

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.updatePrompt({
        name: "unit-conversion",
        content: newContent,
      });

      expect(result).toEqual({ success: true });
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.PROMPT_UNIT_CONVERSION,
        { content: newContent },
        mockAdmin.id,
        false
      );
    });

    it("rejects empty content", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      const testRouter = t.router({
        updatePrompt: adminProcedure
          .input(
            z.object({
              name: PromptNameSchema,
              content: z.string().min(1, "Prompt content is required"),
            })
          )
          .mutation(async ({ input, ctx: procedureCtx }) => {
            const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];

            await setConfig(configKey, { content: input.content }, procedureCtx.user.id, false);

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await expect(
        caller.updatePrompt({
          name: "recipe-extraction",
          content: "",
        })
      ).rejects.toThrow();

      expect(setConfig).not.toHaveBeenCalled();
    });
  });

  describe("resetPrompt", () => {
    it("resets prompt to default by re-seeding from file", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        resetPrompt: adminProcedure
          .input(z.object({ name: PromptNameSchema }))
          .mutation(async ({ input, ctx: procedureCtx }) => {
            const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];
            const defaultContent = getDefaultPrompt(input.name);

            await setConfig(configKey, { content: defaultContent }, procedureCtx.user.id, false);

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.resetPrompt({ name: "recipe-extraction" });

      expect(result).toEqual({ success: true });
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.PROMPT_RECIPE_EXTRACTION,
        { content: "Default recipe extraction prompt content" },
        mockAdmin.id,
        false
      );
    });

    it("resets unit-conversion prompt to default", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      setConfig.mockResolvedValue(undefined);

      const testRouter = t.router({
        resetPrompt: adminProcedure
          .input(z.object({ name: PromptNameSchema }))
          .mutation(async ({ input, ctx: procedureCtx }) => {
            const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];
            const defaultContent = getDefaultPrompt(input.name);

            await setConfig(configKey, { content: defaultContent }, procedureCtx.user.id, false);

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.resetPrompt({ name: "unit-conversion" });

      expect(result).toEqual({ success: true });
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.PROMPT_UNIT_CONVERSION,
        { content: "Default unit conversion prompt content" },
        mockAdmin.id,
        false
      );
    });
  });

  describe("listPrompts", () => {
    it("lists all prompts with custom status based on content comparison", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      // Recipe extraction has custom content, unit conversion has default
      getConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.PROMPT_RECIPE_EXTRACTION) {
          return Promise.resolve({ content: "Custom content" });
        }
        if (key === ServerConfigKeys.PROMPT_UNIT_CONVERSION) {
          return Promise.resolve({ content: "Default unit conversion prompt content" });
        }

        return Promise.resolve(null);
      });

      const testRouter = t.router({
        listPrompts: adminProcedure.query(async () => {
          const prompts = ["recipe-extraction", "unit-conversion"] as const;
          const results = await Promise.all(
            prompts.map(async (name) => {
              const configKey = PROMPT_NAME_TO_CONFIG_KEY[name];
              const stored = await getConfig(configKey);
              const defaultContent = getDefaultPrompt(name);

              return {
                name,
                isCustom: stored?.content !== defaultContent,
              };
            })
          );

          return results;
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.listPrompts();

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { name: "recipe-extraction", isCustom: true },
        { name: "unit-conversion", isCustom: false },
      ]);
    });

    it("shows all prompts as default when content matches defaults", async () => {
      const ctx = createMockAdminContext(mockAdmin);

      // Both prompts have default content
      getConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.PROMPT_RECIPE_EXTRACTION) {
          return Promise.resolve({ content: "Default recipe extraction prompt content" });
        }
        if (key === ServerConfigKeys.PROMPT_UNIT_CONVERSION) {
          return Promise.resolve({ content: "Default unit conversion prompt content" });
        }

        return Promise.resolve(null);
      });

      const testRouter = t.router({
        listPrompts: adminProcedure.query(async () => {
          const prompts = ["recipe-extraction", "unit-conversion"] as const;
          const results = await Promise.all(
            prompts.map(async (name) => {
              const configKey = PROMPT_NAME_TO_CONFIG_KEY[name];
              const stored = await getConfig(configKey);
              const defaultContent = getDefaultPrompt(name);

              return {
                name,
                isCustom: stored?.content !== defaultContent,
              };
            })
          );

          return results;
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.listPrompts();

      expect(result).toEqual([
        { name: "recipe-extraction", isCustom: false },
        { name: "unit-conversion", isCustom: false },
      ]);
    });
  });
});
