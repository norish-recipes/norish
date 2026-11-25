/**
 * Tags are household lists (ADR-0043): household A's Tags are never offered to household B, even
 * when B may view every recipe; B sees them on A's recipe, and filtering by B's own Tag of the
 * same folded name finds A's recipe too. Under view Household, B finds only its own.
 */
import type { Page } from "@playwright/test";

import { userIdOf } from "../harness/accounts";
import { signedInContext } from "../harness/auth";
import { seedRecipe } from "../harness/recipes";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { expect, MEMBER, OWNER, test } from "./fixture";

function card(page: Page, name: string) {
  return page.locator("[data-recipe-card]").filter({ hasText: name }).first();
}

for (const view of ["everyone", "household"] as const) {
  test(`another household's Tags are never offered under view ${view}`, async ({
    browser,
    aiStack,
  }) => {
    const word = `List${Date.now().toString(36)}`;
    const theirTag = `${word}soja`;
    const ourTag = `${word.toUpperCase()}SOJA`;
    const theirOnly = `${word}smoky`;
    const theirs = `${word} Tofu`;
    const ours = `${word} Stew`;
    // Household A is the member; household B the owner.
    const theirId = await seedRecipe(await userIdOf(MEMBER), theirs, [], {
      tags: [{ name: theirTag }, { name: theirOnly }],
    });

    await seedRecipe(await userIdOf(OWNER), ours, [], { tags: [{ name: ourTag }] });
    await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateRecipePermissionPolicy", {
      view,
      edit: "household",
      delete: "household",
    });

    const offered = await callTrpc<{ tags: string[] }>(
      aiStack.baseURL,
      aiStack.ownerCookies,
      "config.tags"
    );
    const listed = await queryTrpc<Array<{ name: string }>>(
      aiStack.baseURL,
      aiStack.ownerCookies,
      "lists.list",
      { kind: "tag" }
    );

    const ofThisRun = (tag: string) => tag.toLowerCase().startsWith(word.toLowerCase());

    expect(offered.tags.filter(ofThisRun)).toEqual([ourTag]);
    expect(listed.map((entry) => entry.name).filter(ofThisRun)).toEqual([ourTag]);

    const context = await signedInContext(browser, aiStack.baseURL, OWNER, {
      viewport: { width: 1280, height: 1200 },
    });
    const page = await context.newPage();

    try {
      await page.goto("/");
      await page.getByRole("button", { name: "Filters" }).click();

      const panel = page.getByRole("dialog");

      await panel.getByPlaceholder("Search tags").fill(word);
      await expect(panel.getByRole("button", { name: ourTag, exact: true })).toBeVisible();
      await expect(panel.getByRole("button", { name: theirTag, exact: true })).toHaveCount(0);
      await expect(panel.getByRole("button", { name: theirOnly, exact: true })).toHaveCount(0);

      await panel.getByRole("button", { name: ourTag, exact: true }).click();
      await panel.getByRole("button", { name: "Apply" }).click();
      await expect(card(page, ours)).toBeVisible();

      if (view === "everyone") {
        await expect(card(page, theirs)).toBeVisible();
        await page.goto(`/recipes/${theirId}`);
        await expect(
          page.getByText(theirOnly, { exact: true }).filter({ visible: true }).first()
        ).toBeVisible();
      } else {
        await expect(card(page, theirs)).toBeHidden();
      }
    } finally {
      await context.close();
    }
  });
}
