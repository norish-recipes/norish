// @vitest-environment node
/** The Master Key's fingerprint is boot's alone: no Admin setting procedure reads or restores it. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { adminConfigProcedures } from "../../src/routers/admin/config";
import { systemProcedures } from "../../src/routers/admin/system";
import { createMockCallerContext } from "../calendar/test-utils";
import { getConfigSecret, setConfig } from "../mocks/server-config";
import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext } from "./test-utils";

vi.mock("@norish/db/repositories/server-config", () => import("../mocks/server-config"));
vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/shared-server/realtime/config", () => import("../mocks/realtime/config"));
vi.mock("@norish/shared-server/ingredients/resolver", () => ({ forgetSpellingRules: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const context = () => createMockCallerContext(createMockAdminContext());

beforeEach(() => {
  setConfig.mockReset();
  getConfigSecret.mockReset();
  isUserServerAdmin.mockResolvedValue(true);
});

describe("the Master Key fingerprint in Admin settings", () => {
  it("cannot be restored to a default", async () => {
    const restore = systemProcedures
      .createCaller(context())
      .restoreDefault(ServerConfigKeys.MASTER_KEY_FINGERPRINT);

    await expect(restore).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(setConfig).not.toHaveBeenCalled();
  });

  it("cannot be read as a secret field", async () => {
    const read = adminConfigProcedures
      .createCaller(context())
      .getSecretField({ key: ServerConfigKeys.MASTER_KEY_FINGERPRINT, field: "value" });

    await expect(read).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getConfigSecret).not.toHaveBeenCalled();
  });
});
