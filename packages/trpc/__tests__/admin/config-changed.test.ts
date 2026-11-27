// @vitest-environment node
/**
 * The reference data an administrator edits is announced to every client, which reads it again:
 * units, words, recurrence, timers, locales and the instance's Cuisines.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { contentConfigProcedures } from "../../src/routers/admin/content-config";
import { systemProcedures } from "../../src/routers/admin/system";
import { listsProcedures } from "../../src/routers/lists/lists";
import { createMockCallerContext } from "../calendar/test-utils";
import { config as configRealtime } from "../mocks/realtime/config";
import { setConfig } from "../mocks/server-config";
import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext } from "./test-utils";

vi.mock("@norish/db/repositories/server-config", () => import("../mocks/server-config"));
vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/db/repositories/list-entries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/db/repositories/list-entries")>()),
  addEntry: vi.fn(async (_kind: string, _scope: string | null, name: string) => ({
    created: true,
    entry: { id: "c1", name, instance: true, version: 1 },
  })),
}));
vi.mock("@norish/shared-server/realtime/lists", () => import("../mocks/realtime/lists"));
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
    await listsProcedures
      .createCaller(context())
      .add({ kind: "cuisine", name: "Thai", instance: true });

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
