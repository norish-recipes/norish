// @vitest-environment node
/**
 * The permission policies an administrator sets: each is stored, and each is
 * announced so every open page offers what the new policy allows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { permissionsProcedures } from "../../src/routers/admin/permissions";
import { createMockCallerContext } from "../calendar/test-utils";
import { ingredients as ingredientsRealtime } from "../mocks/realtime/ingredients";
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
vi.mock(
  "@norish/shared-server/realtime/ingredients",
  () => import("../mocks/realtime/ingredients")
);
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const admin = () =>
  permissionsProcedures.createCaller(createMockCallerContext(createMockAdminContext()));

beforeEach(() => {
  vi.clearAllMocks();
  ingredientsRealtime.reset();
  permissionsRealtime.reset();
  setConfig.mockResolvedValue(undefined);
  isUserServerAdmin.mockResolvedValue(true);
});

describe("the ingredient permission policy", () => {
  it("is stored, and announced as an Ingredient change about no Ingredient in particular", async () => {
    await expect(admin().updateIngredientPermissionPolicy({ edit: "everyone" })).resolves.toEqual({
      success: true,
    });

    expect(setConfig).toHaveBeenCalledWith(
      ServerConfigKeys.INGREDIENT_PERMISSION_POLICY,
      { edit: "everyone" },
      expect.any(String),
      false
    );
    expect(ingredientsRealtime.published).toEqual([
      expect.objectContaining({ event: "changed", payload: { ingredientIds: [] } }),
    ]);
  });

  it("is an administrator's to set", async () => {
    isUserServerAdmin.mockResolvedValue(false);

    const member = permissionsProcedures.createCaller(
      createMockCallerContext(createMockAuthedContext())
    );

    await expect(
      member.updateIngredientPermissionPolicy({ edit: "everyone" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(setConfig).not.toHaveBeenCalled();
  });
});
