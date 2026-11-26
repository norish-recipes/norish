// Leaving takes a member's recipes along with the Tags and foods they use; joining from a household
// of one merges it into the joined household (ADR-0041), both through the household settings tab.
import { randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import type { SessionCookies } from "../harness/auth";
import type { ThrowawayUser } from "./admin-users-support";
import { closeAndDelete } from "../harness/accounts";
import { settingsCard as card, joinWithCode, signedInContext, signIn } from "../harness/auth";
import { createRecipe, readRecipe } from "../harness/recipes";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { seedHousehold, signUpThrowawayUser } from "./admin-users-support";
import { expect, test } from "./fixture";

const HOUSEHOLD_SETTINGS = "/settings/household";
const DEFAULT_POLICY = { view: "everyone", edit: "household", delete: "household" };

interface Entry {
  id: string;
  name: string;
  instance: boolean;
}

async function householdOf(baseURL: string, cookies: SessionCookies) {
  const { household } = await callTrpc<{
    household: { id: string; version: number; joinCode?: string | null };
  }>(baseURL, cookies, "households.get");

  return household;
}

/** The household's own Tags, by name. */
async function ownTags(baseURL: string, cookies: SessionCookies): Promise<string[]> {
  const entries = await queryTrpc<Entry[]>(baseURL, cookies, "lists.list", { kind: "tag" });

  return entries.filter((entry) => !entry.instance).map((entry) => entry.name);
}

/** The recipe's Tags and its lines' foods, as its Owner reads it. */
async function carried(baseURL: string, cookies: SessionCookies, recipeId: string) {
  const recipe = (await readRecipe(baseURL, cookies, recipeId)) as FullRecipeDTO;

  return {
    tags: recipe.tags.map((tag) => tag.name),
    foods: recipe.recipeIngredients.map((line) => line.ingredientId),
  };
}

for (const view of ["everyone", "household"] as const) {
  test(`a member who leaves keeps their recipe with its Tag and food; joining back merges them in, under view ${view}`, async ({
    browser,
    aiStack,
  }) => {
    const tag = randomUUID().slice(0, 8);
    const users: ThrowawayUser[] = [];
    const contexts: BrowserContext[] = [];
    const signedIn = async (role: string) => {
      const user = await signUpThrowawayUser(aiStack, {
        email: `moves-${role}-${tag}@norish.test`,
        password: `moves-${role}-${tag}-password`,
        name: `Moves ${role} ${tag}`,
      });

      users.push(user);
      const context = await signedInContext(browser, aiStack.baseURL, user);

      contexts.push(context);

      return { user, page: await context.newPage(), cookies: await signIn(aiStack.baseURL, user) };
    };
    const names = { recipe: `Stoof ${tag}`, tag: `Pittig ${tag}`, food: `gochujang ${tag}` };

    try {
      await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateRecipePermissionPolicy", {
        ...DEFAULT_POLICY,
        view,
      });
      const admin = await signedIn("admin");
      const member = await signedIn("member");
      const householdId = await seedHousehold(`Moves ${tag}`, admin.user.id, [
        admin.user.id,
        member.user.id,
      ]);

      // The member's recipe carries the household's Tag and names a food of the household's own.
      await callTrpc(aiStack.baseURL, member.cookies, "lists.add", {
        kind: "tag",
        name: names.tag,
      });
      const recipeId = await createRecipe(
        aiStack.baseURL,
        member.cookies,
        names.recipe,
        [names.food],
        {
          tags: [{ name: names.tag }],
        }
      );
      const before = await carried(aiStack.baseURL, member.cookies, recipeId);

      expect(before.tags).toEqual([names.tag]);
      expect(await readRecipe(aiStack.baseURL, admin.cookies, recipeId)).not.toBeNull();
      // The admin's page holds the recipe before the member leaves.
      await admin.page.goto(`/recipes/${recipeId}`);
      await expect(admin.page.getByText(names.recipe).first()).toBeVisible();

      // The leave dialog says what goes with the member and what stays.
      await member.page.goto(HOUSEHOLD_SETTINGS);
      await member.page.getByRole("button", { name: "Leave household" }).click();
      const dialog = member.page.getByRole("dialog");

      await expect(dialog).toContainText("Your recipes and cookbooks go with you");
      await expect(dialog).toContainText("stay with the household");
      await dialog.getByRole("button", { name: "Leave household" }).click();
      await expect(member.page.getByText("Your household (just you)")).toBeVisible();
      const ofOne = await householdOf(aiStack.baseURL, member.cookies);

      expect(ofOne.id).not.toBe(householdId);

      // The recipe went with them, its Tag and food now their new household's own.
      const after = await carried(aiStack.baseURL, member.cookies, recipeId);

      expect(after.tags).toEqual([names.tag]);
      expect(await ownTags(aiStack.baseURL, member.cookies)).toEqual([names.tag]);
      expect(after.foods[0]).not.toBe(before.foods[0]);
      await expect(
        queryTrpc(aiStack.baseURL, member.cookies, "ingredients.get", {
          ingredientId: after.foods[0],
        })
      ).resolves.toMatchObject({ name: names.food });
      if (view === "household") {
        // The old household no longer sees it, nor does the page it has open.
        await expect.poll(() => readRecipe(aiStack.baseURL, admin.cookies, recipeId)).toBeNull();
        await expect(admin.page.getByText("Recipe Not Found")).toBeVisible({ timeout: 30_000 });
      } else {
        // Everyone may still view it: the old household reads it, and its open page stays.
        expect(await readRecipe(aiStack.baseURL, admin.cookies, recipeId)).not.toBeNull();
        await admin.page.reload();
        await expect(admin.page.getByText(names.recipe).first()).toBeVisible();
        await expect(admin.page.getByText("Recipe Not Found")).toHaveCount(0);
      }
      // The old household keeps its own Tag.
      expect(await ownTags(aiStack.baseURL, admin.cookies)).toEqual([names.tag]);

      // Joining back: the join card says the household of one is merged into the one joined.
      await callTrpc(aiStack.baseURL, admin.cookies, "households.regenerateCode", {
        householdId,
        version: (await householdOf(aiStack.baseURL, admin.cookies)).version,
      });
      await expect
        .poll(async () => (await householdOf(aiStack.baseURL, admin.cookies)).joinCode)
        .toMatch(/^\d{6}$/);
      const code = (await householdOf(aiStack.baseURL, admin.cookies)).joinCode!;

      await expect(card(member.page, "Join household")).toContainText(
        "Your household is merged into it"
      );
      await joinWithCode(member.page, code);
      await expect
        .poll(async () => (await householdOf(aiStack.baseURL, member.cookies)).id)
        .toBe(householdId);

      // The Tag and the food of the same name join the household's: one of each, the recipe on them.
      const joined = await carried(aiStack.baseURL, member.cookies, recipeId);

      expect(await ownTags(aiStack.baseURL, admin.cookies)).toEqual([names.tag]);
      expect(joined.tags).toEqual([names.tag]);
      expect(joined.foods[0]).toBe(before.foods[0]);
      expect(await readRecipe(aiStack.baseURL, admin.cookies, recipeId)).not.toBeNull();
    } finally {
      await callTrpc(
        aiStack.baseURL,
        aiStack.ownerCookies,
        "admin.updateRecipePermissionPolicy",
        DEFAULT_POLICY
      );
      await closeAndDelete(contexts, users);
    }
  });
}
