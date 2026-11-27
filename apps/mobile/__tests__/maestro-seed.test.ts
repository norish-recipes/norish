import { describe, expect, it } from "vitest";

import { seeder } from "../scripts/maestro-seed.mjs";

describe("the Maestro seeder", () => {
  it("makes a recipe's Tags and Categories before saving it, as the form's save only attaches", async () => {
    const calls: string[] = [];
    const trpc = async (path: string, input: { kind?: string; name?: string }) => {
      calls.push(input.kind ? `${path} ${input.kind} ${input.name}` : path);

      return "recipe-1";
    };
    const seed = seeder({ trpc, query: async () => ({}) });

    await seed.createRecipe({ name: "Soup", tags: ["soup"], categories: ["Brunch"] });

    expect(calls).toEqual(["lists.add tag soup", "lists.add category Brunch", "recipes.create"]);
  });
});
