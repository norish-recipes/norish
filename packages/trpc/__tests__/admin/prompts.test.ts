// @vitest-environment node
/**
 * Prompt procedures under the overrides-only model.
 *
 * The stored config row carries only prompts that differ from the shipped
 * defaults; reads merge the row over the defaults. The procedure bodies here
 * mirror the production router exactly, with the shared override logic
 * (`pruneToOverrides` / `mergeWithDefaults`) imported for real — only
 * storage, prompt files, and auth are mocked. The production glue itself is
 * covered end-to-end by the prompt-default e2e suite.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptValues } from "@norish/config/zod/server-config";
import { PromptsConfigInputSchema, ServerConfigKeys } from "@norish/config/zod/server-config";
import { mergeWithDefaults, pruneToOverrides } from "@norish/shared-server/ai/prompts/overrides";

import { getConfig, setConfig } from "../mocks/server-config";
import { isUserServerAdmin } from "../mocks/users";
import {
  createMockAdminContext,
  createMockAdminUser,
  createMockAuthedContext,
  createMockUser,
} from "./test-utils";

vi.mock("@norish/db/repositories/server-config", () => import("../mocks/server-config"));
vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));

const DEFAULTS: PromptValues = {
  recipeExtraction: "Default recipe extraction prompt",
  imageExtraction: "Default image extraction prompt",
  unitConversion: "Default unit conversion prompt",
  nutritionEstimation: "Default nutrition estimation prompt",
  autoTagging: "Default auto tagging prompt",
  autoCategorization: "Default auto categorization prompt",
  allergyDetection: "Default allergy detection prompt",
  recipeProvenance: "Default recipe provenance prompt",
  ingredientLinking: "Default ingredient linking prompt",
};

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

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

/** The production procedure bodies, over mocked storage and prompt files. */
function buildRouter(userId: string) {
  return t.router({
    getPrompts: adminProcedure.query(async () => {
      const stored = await getConfig(ServerConfigKeys.PROMPTS);
      const { values, overriddenFields } = mergeWithDefaults(stored, DEFAULTS);

      return { ...values, isOverridden: overriddenFields.length > 0 };
    }),
    updatePrompts: adminProcedure.input(PromptsConfigInputSchema).mutation(async ({ input }) => {
      const { overrides } = pruneToOverrides(input, DEFAULTS);

      await setConfig(ServerConfigKeys.PROMPTS, overrides, userId, false);

      return { success: true };
    }),
  });
}

describe("prompts procedures", () => {
  const mockUser = createMockUser();
  const mockAdmin = createMockAdminUser();

  beforeEach(() => {
    vi.clearAllMocks();
    isUserServerAdmin.mockImplementation((userId: string) => {
      return Promise.resolve(userId === mockAdmin.id);
    });
  });

  function adminCaller() {
    const ctx = createMockAdminContext(mockAdmin);

    return t.createCallerFactory(buildRouter(mockAdmin.id))(ctx);
  }

  describe("getPrompts", () => {
    it("serves the shipped defaults when nothing is overridden", async () => {
      getConfig.mockResolvedValue({});

      const result = await adminCaller().getPrompts();

      expect(result).toEqual({ ...DEFAULTS, isOverridden: false });
    });

    it("serves the shipped defaults when the row is missing entirely", async () => {
      getConfig.mockResolvedValue(null);

      const result = await adminCaller().getPrompts();

      expect(result).toEqual({ ...DEFAULTS, isOverridden: false });
    });

    it("lays stored overrides over the defaults", async () => {
      getConfig.mockResolvedValue({ autoTagging: "Tag it my way" });

      const result = await adminCaller().getPrompts();

      expect(result).toEqual({
        ...DEFAULTS,
        autoTagging: "Tag it my way",
        isOverridden: true,
      });
    });

    it("ignores a legacy row's pinned copies of shipped defaults", async () => {
      // A pre-0.20 row: full copy of the then-current defaults plus the
      // row-level flag. Only genuinely divergent texts count as overrides.
      getConfig.mockResolvedValue({
        ...DEFAULTS,
        recipeExtraction: "Hand-tuned extraction",
        isOverridden: true,
      });

      const result = await adminCaller().getPrompts();

      expect(result).toEqual({
        ...DEFAULTS,
        recipeExtraction: "Hand-tuned extraction",
        isOverridden: true,
      });
    });

    it("throws FORBIDDEN for non-admin users", async () => {
      const ctx = createMockAuthedContext(mockUser);
      const caller = t.createCallerFactory(buildRouter(mockUser.id))(ctx);

      await expect(caller.getPrompts()).rejects.toThrow(TRPCError);
    });
  });

  describe("updatePrompts", () => {
    it("stores only the prompts that differ from the shipped defaults", async () => {
      setConfig.mockResolvedValue(undefined);

      const result = await adminCaller().updatePrompts({
        ...DEFAULTS,
        autoTagging: "Tag it my way",
      });

      expect(result).toEqual({ success: true });
      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.PROMPTS,
        { autoTagging: "Tag it my way" },
        mockAdmin.id,
        false
      );
    });

    it("stores nothing when the form is saved with every prompt at its default", async () => {
      // Saving an untouched form must not pin the current defaults — that is
      // exactly what used to freeze prompts across releases.
      setConfig.mockResolvedValue(undefined);

      await adminCaller().updatePrompts({ ...DEFAULTS });

      expect(setConfig).toHaveBeenCalledWith(ServerConfigKeys.PROMPTS, {}, mockAdmin.id, false);
    });

    it("un-pins a prompt reverted to the default text, keeping the others", async () => {
      setConfig.mockResolvedValue(undefined);

      await adminCaller().updatePrompts({
        ...DEFAULTS,
        recipeExtraction: DEFAULTS.recipeExtraction, // reverted by hand
        unitConversion: "Metric only, always",
      });

      expect(setConfig).toHaveBeenCalledWith(
        ServerConfigKeys.PROMPTS,
        { unitConversion: "Metric only, always" },
        mockAdmin.id,
        false
      );
    });

    it("treats blank prompts as no override", async () => {
      setConfig.mockResolvedValue(undefined);

      await adminCaller().updatePrompts({
        ...DEFAULTS,
        allergyDetection: "   ",
      });

      expect(setConfig).toHaveBeenCalledWith(ServerConfigKeys.PROMPTS, {}, mockAdmin.id, false);
    });

    it("throws FORBIDDEN for non-admin users", async () => {
      const ctx = createMockAuthedContext(mockUser);
      const caller = t.createCallerFactory(buildRouter(mockUser.id))(ctx);

      await expect(caller.updatePrompts({ ...DEFAULTS })).rejects.toThrow(TRPCError);
    });
  });
});
