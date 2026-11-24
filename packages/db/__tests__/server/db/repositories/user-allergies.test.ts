// @vitest-environment node
import { expect, it, vi } from "vitest";

import { getUserAllergies } from "@norish/db/repositories/user-allergies";
import { users } from "@norish/db/schema";

vi.mock("@norish/db/drizzle", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        const afterClear = [{ version: 3, name: null }];
        const beforeClear = [{ version: 2, name: "Milk" }];

        return {
          where: () => ({
            limit: async () => afterClear,
            orderBy: async () => (table === users ? afterClear : beforeClear),
          }),
          innerJoin: () => ({ where: () => ({ orderBy: async () => beforeClear }) }),
          leftJoin() {
            return this;
          },
        };
      },
    }),
  },
}));

it("reads the allergy list and its version from the same snapshot during a clear", async () => {
  await expect(getUserAllergies("reader")).resolves.toEqual({ allergies: [], version: 3 });
});
