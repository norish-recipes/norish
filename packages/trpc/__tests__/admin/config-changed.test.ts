// @vitest-environment node
/**
 * The reference data an administrator edits is announced to every client, which reads it again:
 * units, words, recurrence, timers, locales and the Cuisine vocabulary.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { contentConfigProcedures } from "../../src/routers/admin/content-config";
import { cuisinesProcedures } from "../../src/routers/admin/cuisines";
import { systemProcedures } from "../../src/routers/admin/system";
import { createMockCallerContext } from "../calendar/test-utils";
import { config as configRealtime } from "../mocks/realtime/config";
import { setConfig } from "../mocks/server-config";
import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext } from "./test-utils";

vi.mock("@norish/db/repositories/server-config", () => import("../mocks/server-config"));
vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/db/repositories/cuisines", () => ({
  createCuisine: vi.fn(async (name: string) => ({ id: "c1", name })),
  renameCuisine: vi.fn(),
  deleteCuisine: vi.fn(),
}));
vi.mock("@norish/shared-server/realtime/config", () => import("../mocks/realtime/config"));
vi.mock("@norish/shared-server/ingredients/resolver", () => ({ forgetSpellingRules: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const context = () => createMockCallerContext(createMockAdminContext());
const announced = () => configRealtime.published.map(({ event }) => event);

beforeEach(() => {
  configRealtime.reset();
  setConfig.mockResolvedValue(undefined);
  isUserServerAdmin.mockResolvedValue(true);
});

describe("an administrator's edit to reference data", () => {
  it("is announced as a config change", async () => {
    const content = contentConfigProcedures.createCaller(context());

    await content.updateUnits(JSON.stringify({}));
    await cuisinesProcedures.createCaller(context()).create({ name: "Thai" });

    expect(announced()).toEqual(["changed", "changed"]);
  });

  it("is announced on a restored default only where clients read it", async () => {
    const system = systemProcedures.createCaller(context());

    await system.restoreDefault(ServerConfigKeys.UNITS);
    await system.restoreDefault(ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS);

    expect(announced()).toEqual(["changed"]);
  });

  it("is not announced when it was refused", async () => {
    await contentConfigProcedures.createCaller(context()).updateUnits("not json");

    expect(announced()).toEqual([]);
  });
});
