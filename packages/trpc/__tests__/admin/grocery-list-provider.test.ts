// @vitest-environment node
/**
 * The Shopping List Provider (ADR-0041): an administrator switches it, every client is told to
 * read it again, and any signed-in reader can read it. Nothing else is touched by the switch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { generalProcedures } from "../../src/routers/admin/general";
import { systemProcedures } from "../../src/routers/admin/system";
import { configProcedures } from "../../src/routers/config/procedures";
import { createMockCallerContext } from "../calendar/test-utils";
import { config as configRealtime } from "../mocks/realtime/config";
import { setConfig } from "../mocks/server-config";
import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext, createMockAdminUser, createMockHousehold } from "./test-utils";

const getGroceryListProvider = vi.hoisted(() => vi.fn());

vi.mock("@norish/db/repositories/server-config", () => import("../mocks/server-config"));
vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/shared-server/realtime/config", () => import("../mocks/realtime/config"));
vi.mock("@norish/shared-server/ingredients/resolver", () => ({ forgetSpellingRules: vi.fn() }));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({ getGroceryListProvider }));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const adminContext = () =>
  createMockCallerContext(createMockAdminContext(createMockAdminUser(), createMockHousehold()));
const announced = () => configRealtime.published.map(({ event }) => event);

beforeEach(() => {
  configRealtime.reset();
  setConfig.mockReset().mockResolvedValue(undefined);
  isUserServerAdmin.mockReset().mockResolvedValue(true);
  getGroceryListProvider.mockReset().mockResolvedValue("builtin");
});

describe("admin.updateGroceryListProvider", () => {
  it("stores the provider unencrypted and announces a config change", async () => {
    const admin = generalProcedures.createCaller(adminContext());

    await expect(admin.updateGroceryListProvider("bring")).resolves.toEqual({ success: true });

    expect(setConfig).toHaveBeenCalledWith(
      ServerConfigKeys.GROCERY_LIST_PROVIDER,
      "bring",
      expect.any(String),
      false
    );
    expect(announced()).toEqual(["changed"]);
  });

  it("refuses a provider that does not exist", async () => {
    const admin = generalProcedures.createCaller(adminContext());

    await expect(
      admin.updateGroceryListProvider("anylist" as unknown as "bring")
    ).rejects.toThrow();
    expect(setConfig).not.toHaveBeenCalled();
    expect(announced()).toEqual([]);
  });

  it("refuses a reader who is not an administrator", async () => {
    isUserServerAdmin.mockResolvedValue(false);

    await expect(
      generalProcedures.createCaller(adminContext()).updateGroceryListProvider("bring")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(setConfig).not.toHaveBeenCalled();
    expect(announced()).toEqual([]);
  });

  it("is announced on a restored default too, where clients read it", async () => {
    await systemProcedures
      .createCaller(adminContext())
      .restoreDefault(ServerConfigKeys.GROCERY_LIST_PROVIDER);

    expect(setConfig).toHaveBeenCalledWith(
      ServerConfigKeys.GROCERY_LIST_PROVIDER,
      "builtin",
      expect.any(String),
      false
    );
    expect(announced()).toEqual(["changed"]);
  });
});

describe("config.groceryListProvider", () => {
  const reader = () => configProcedures.createCaller(adminContext());

  it("is the built-in list by default", async () => {
    await expect(reader().groceryListProvider()).resolves.toBe("builtin");
  });

  it("is Bring! once an administrator chose it", async () => {
    getGroceryListProvider.mockResolvedValue("bring");

    await expect(reader().groceryListProvider()).resolves.toBe("bring");
  });
});
