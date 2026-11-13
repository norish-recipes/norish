// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { configProcedures } from "../../src/routers/config/procedures";
import { createMockCallerContext } from "../calendar/test-utils";
import { getRecipePermissionPolicy } from "../mocks/config";
import {
  createMockAuthedContext,
  createMockHousehold,
  createMockUser,
} from "../recipes/test-utils";

const listCategoryNamesForUsers = vi.hoisted(() => vi.fn());

vi.mock("@norish/db/repositories/categories", () => ({ listCategoryNamesForUsers }));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));

describe("config.categories", () => {
  it("lists only the household's Categories, even for an admin under the everyone policy", async () => {
    getRecipePermissionPolicy.mockResolvedValue({
      view: "everyone",
      edit: "household",
      delete: "household",
    });
    listCategoryNamesForUsers.mockResolvedValue([
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snack",
      "Puddings",
    ]);

    const ctx = createMockAuthedContext(
      createMockUser({ isServerAdmin: true }),
      createMockHousehold()
    );
    const result = await configProcedures.createCaller(createMockCallerContext(ctx)).categories();

    expect(listCategoryNamesForUsers).toHaveBeenCalledWith(ctx.userIds);
    expect(result).toEqual({
      categories: ["Breakfast", "Lunch", "Dinner", "Snack", "Puddings"],
      builtInAliases: expect.objectContaining({ ontbijt: "Breakfast", snack: "Snack" }),
    });
  });
});
