// Two households under view Household (ADR-0041): neither sees the other's recipes or cookbooks in
// its Library, and a server admin in a third household is an ordinary reader who sees neither.
import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";

import type { ThrowawayUser } from "./admin-users-support";
import { closeAndDelete } from "../harness/accounts";
import { signedInContext, signIn } from "../harness/auth";
import { createRecipe } from "../harness/recipes";
import { callTrpc } from "../harness/trpc";
import { signUpThrowawayUser } from "./admin-users-support";
import { expect, test } from "./fixture";

const DEFAULT_POLICY = { view: "everyone", edit: "household", delete: "household" };

/** The Library searched for `word`, as its reader sees it. */
async function library(page: Page, word: string): Promise<void> {
  await page.goto("/");
  await page.locator("#search-input").fill(word);
}

const recipeCard = (page: Page, name: string) =>
  page.locator("[data-recipe-card]").filter({ hasText: name });

test("neither household sees the other's Library under view Household, nor does the admin", async ({
  browser,
  aiStack,
  page: adminPage,
}) => {
  const tag = randomUUID().slice(0, 8);
  const word = `Boundary${tag}`;
  const users: ThrowawayUser[] = [];
  const contexts: BrowserContext[] = [];
  const household = async (role: string) => {
    const user = await signUpThrowawayUser(aiStack, {
      email: `library-${role}-${tag}@norish.test`,
      password: `library-${role}-${tag}-password`,
      name: `Library ${role} ${tag}`,
    });

    users.push(user);
    const context = await signedInContext(browser, aiStack.baseURL, user);

    contexts.push(context);

    return { page: await context.newPage(), cookies: await signIn(aiStack.baseURL, user) };
  };

  try {
    const a = await household("a");
    const b = await household("b");
    const names = { a: `${word} Soup`, b: `${word} Stew`, admin: `${word} Admin's` };
    const cookbooks = { a: `${word} Book A`, b: `${word} Book B` };

    await createRecipe(aiStack.baseURL, a.cookies, names.a, ["leek"]);
    await createRecipe(aiStack.baseURL, b.cookies, names.b, ["beans"]);
    await createRecipe(aiStack.baseURL, aiStack.ownerCookies, names.admin, ["salt"]);
    await callTrpc(aiStack.baseURL, a.cookies, "cookbooks.create", {
      id: randomUUID(),
      title: cookbooks.a,
    });
    await callTrpc(aiStack.baseURL, b.cookies, "cookbooks.create", {
      id: randomUUID(),
      title: cookbooks.b,
    });
    await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateRecipePermissionPolicy", {
      view: "household",
      edit: "household",
      delete: "household",
    });

    // Each household finds its own recipe and cookbook, and nothing of the other's.
    for (const [own, ownName, otherName] of [
      [a.page, "a", "b"],
      [b.page, "b", "a"],
    ] as const) {
      await library(own, word);
      await expect(recipeCard(own, names[ownName])).toBeVisible();
      await expect(own.getByText(cookbooks[ownName])).toBeVisible();
      await expect(recipeCard(own, names[otherName])).toHaveCount(0);
      await expect(own.getByText(cookbooks[otherName])).toHaveCount(0);
      await expect(recipeCard(own, names.admin)).toHaveCount(0);
    }

    // The admin, in a household of their own, is an ordinary reader: their own shows, no other.
    await library(adminPage, word);
    await expect(recipeCard(adminPage, names.admin)).toBeVisible();
    await expect(recipeCard(adminPage, names.a)).toHaveCount(0);
    await expect(recipeCard(adminPage, names.b)).toHaveCount(0);
    await expect(adminPage.getByText(cookbooks.a)).toHaveCount(0);
    await expect(adminPage.getByText(cookbooks.b)).toHaveCount(0);

    // Widening brings every Library back as it was: the policy changed nothing.
    await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateRecipePermissionPolicy", {
      view: "everyone",
      edit: "household",
      delete: "household",
    });
    await library(adminPage, word);
    await expect(recipeCard(adminPage, names.a)).toBeVisible();
    await expect(recipeCard(adminPage, names.b)).toBeVisible();
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
