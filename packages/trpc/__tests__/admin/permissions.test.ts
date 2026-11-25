// @vitest-environment node
/**
 * The Permission Policy an administrator sets: stored and announced, so every open page offers
 * what it allows; edit and delete never reach further than view.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { permissionsProcedures } from "../../src/routers/admin/permissions";
import { createMockCallerContext } from "../calendar/test-utils";
import { permissions as permissionsRealtime } from "../mocks/realtime/permissions";
import { setConfig } from "../mocks/server-config";
import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext, createMockAuthedContext } from "./test-utils";

vi.mock("@norish/db/repositories/server-config", () => import("../mocks/server-config"));
vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock(
  "@norish/shared-server/realtime/permissions",
  () => import("../mocks/realtime/permissions")
);
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const admin = () =>
  permissionsProcedures.createCaller(createMockCallerContext(createMockAdminContext()));

beforeEach(() => {
  permissionsRealtime.reset();
  setConfig.mockResolvedValue(undefined);
  isUserServerAdmin.mockResolvedValue(true);
});

describe("the Permission Policy", () => {
  it("is stored, and announced to everyone", async () => {
    const policy = { view: "household", edit: "household", delete: "household" } as const;

    await expect(admin().updateRecipePermissionPolicy(policy)).resolves.toEqual({
      success: true,
    });

    expect(setConfig).toHaveBeenCalledWith(
      ServerConfigKeys.RECIPE_PERMISSION_POLICY,
      policy,
      expect.any(String),
      false
    );
    expect(permissionsRealtime.published).toEqual([
      expect.objectContaining({ event: "policyUpdated", payload: { recipePolicy: policy } }),
    ]);
  });

  it.each([
    ["edit", { view: "household", edit: "everyone", delete: "household" }],
    ["delete", { view: "household", edit: "household", delete: "everyone" }],
  ] as const)("refuses %s reaching further than view", async (_, policy) => {
    await expect(admin().updateRecipePermissionPolicy(policy)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(setConfig).not.toHaveBeenCalled();
  });

  it("refuses a level that no longer exists", async () => {
    await expect(
      admin().updateRecipePermissionPolicy({
        view: "owner" as never,
        edit: "household",
        delete: "household",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("is an administrator's to set", async () => {
    isUserServerAdmin.mockResolvedValue(false);

    const member = permissionsProcedures.createCaller(
      createMockCallerContext(createMockAuthedContext())
    );

    await expect(
      member.updateRecipePermissionPolicy({
        view: "everyone",
        edit: "everyone",
        delete: "everyone",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(setConfig).not.toHaveBeenCalled();
  });
});
