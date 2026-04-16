// @vitest-environment node
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trpcLogger } from "@norish/shared-server/logger";

import { createMockAuthedContext, createMockUser } from "./test-utils";

const getUserPreferences = vi.fn();
const updateUserPreferences = vi.fn();

vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

describe("user stale mutation handling", () => {
  const ctx = createMockAuthedContext(createMockUser(), null);

  beforeEach(() => {
    vi.clearAllMocks();
    getUserPreferences.mockResolvedValue({ timersEnabled: true });
  });

  it("logs stale updatePreferences mutations as no-ops", async () => {
    updateUserPreferences.mockResolvedValue({ stale: true });

    const testRouter = t.router({
      updatePreferences: t.procedure
        .input((value) => value as { preferences: { timersEnabled: boolean }; version: number })
        .mutation(async ({ ctx, input }) => {
          const current = await getUserPreferences(ctx.user.id);
          const merged = { ...(current ?? {}), ...(input.preferences ?? {}) };
          const result = await updateUserPreferences(ctx.user.id, merged, input.version);

          if (result.stale) {
            trpcLogger.info(
              { userId: ctx.user.id, version: input.version },
              "Ignoring stale user preferences mutation"
            );
            return {
              success: true,
              stale: true,
              preferences: current ?? {},
              version: input.version,
            };
          }

          return { success: true, stale: false };
        }),
    });

    const caller = t.createCallerFactory(testRouter)(ctx);
    const result = await caller.updatePreferences({
      preferences: { timersEnabled: false },
      version: 5,
    });

    expect(result).toEqual({
      success: true,
      stale: true,
      preferences: { timersEnabled: true },
      version: 5,
    });
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, version: 5 },
      "Ignoring stale user preferences mutation"
    );
  });
});
