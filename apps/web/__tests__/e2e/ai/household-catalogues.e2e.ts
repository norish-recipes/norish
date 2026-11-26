/** Each household has its own catalogue on the shared seed (ADR-0042): foods, spellings and the
 * Ingredients page stay its own, and the other household reaches none of them by id. */
import type { Browser, Page } from "@playwright/test";

import type { SessionCookies } from "../harness/auth";
import type { AIE2EStack } from "./fixture";
import { signedInContext, signIn } from "../harness/auth";
import { createRecipe } from "../harness/recipes";
import { callTrpc, queryTrpc, TrpcHttpError } from "../harness/trpc";
import { expect, MEMBER, OWNER, test } from "./fixture";
import { seedCatalogue } from "./ingredient-catalogue-support";

interface ListedFood {
  id: string;
  name: string;
  canEdit: boolean;
  aliases: Array<{ id: string; text: string; canRemove: boolean }>;
}

/** The foods a reader's Ingredients page finds for a search. */
async function listed(stack: AIE2EStack, cookies: SessionCookies, search: string) {
  const page = await queryTrpc<{ items: ListedFood[] }>(
    stack.baseURL,
    cookies,
    "ingredients.list",
    {
      search,
      locale: "en",
    }
  );

  return page.items;
}

/** The Ingredients page's row of a food. */
function row(page: Page, name: string) {
  return page.locator(`[data-testid="ingredient-row"][data-ingredient="${name}"]`);
}

async function openIngredients(browser: Browser, stack: AIE2EStack, user: typeof OWNER) {
  const context = await signedInContext(browser, stack.baseURL, user, {
    viewport: { width: 1280, height: 1200 },
  });
  const page = await context.newPage();

  await page.goto("/settings/ingredients");

  return { context, page };
}

/** The HTTP status a call refused with: 404 is tRPC's NOT_FOUND. */
async function refusal(call: Promise<unknown>): Promise<number | null> {
  return call.then(
    () => null,
    (error: unknown) => {
      if (error instanceof TrpcHttpError) return error.status;
      throw error;
    }
  );
}

for (const view of ["everyone", "household"] as const) {
  test(`two households each keep their own catalogue under view ${view}`, async ({
    browser,
    aiStack,
  }) => {
    const word = `Cat${Date.now().toString(36)}`;
    const food = `kipfilet XL ${word}`;
    const seeded = `${word} seeded onion`;
    const theirSpelling = `${word} uitje`;
    const byHand = `${word} sterrenmix`;
    // Household A is the member; household B the owner, an administrator.
    const aCookies = await signIn(aiStack.baseURL, MEMBER);
    const bCookies = aiStack.ownerCookies;

    await callTrpc(aiStack.baseURL, bCookies, "admin.updateRecipePermissionPolicy", {
      view,
      edit: "household",
      delete: "household",
    });
    const { [seeded]: seededId } = await seedCatalogue([
      { name: seeded, aliases: [{ text: seeded, locale: "en" }] },
    ]);

    await createRecipe(aiStack.baseURL, aCookies, `${word} A's dinner`, [food]);
    await createRecipe(aiStack.baseURL, bCookies, `${word} B's dinner`, [food]);

    // Each household minted its own: B's "kipfilet XL" is not A's, though A had one first.
    const [aFood] = await listed(aiStack, aCookies, food);
    const [bFood] = await listed(aiStack, bCookies, food);

    expect(aFood).toMatchObject({ name: food, canEdit: true });
    expect(bFood).toMatchObject({ name: food, canEdit: true });
    expect(bFood!.id).not.toBe(aFood!.id);
    expect(await listed(aiStack, aCookies, food)).toHaveLength(1);
    expect(await listed(aiStack, bCookies, food)).toHaveLength(1);

    // A's spelling on the seeded food, and A's food added by hand, are A's alone.
    await callTrpc(aiStack.baseURL, aCookies, "ingredients.addAlias", {
      ingredientId: seededId,
      text: theirSpelling,
    });
    const added = await callTrpc<{ ingredient: ListedFood | null; created: boolean }>(
      aiStack.baseURL,
      aCookies,
      "ingredients.add",
      { name: byHand, spellings: [], locale: "en" }
    );

    expect(added).toMatchObject({ created: true, ingredient: { name: byHand, canEdit: true } });
    await expect(
      callTrpc(aiStack.baseURL, aCookies, "ingredients.add", { name: byHand, locale: "en" })
    ).resolves.toMatchObject({ created: false, ingredient: { id: added.ingredient!.id } });
    expect((await listed(aiStack, aCookies, seeded))[0]!.aliases.map((a) => a.text)).toContain(
      theirSpelling
    );
    expect((await listed(aiStack, bCookies, seeded))[0]!.aliases.map((a) => a.text)).toEqual([
      seeded,
    ]);
    expect(await listed(aiStack, bCookies, byHand)).toEqual([]);

    // B reaches none of A's foods by id, not even as an administrator.
    expect(
      await refusal(
        callTrpc(aiStack.baseURL, bCookies, "ingredients.rename", {
          ingredientId: aFood!.id,
          name: `${food} renamed`,
        })
      )
    ).toBe(404);
    expect(
      await refusal(
        callTrpc(aiStack.baseURL, bCookies, "ingredients.merge", {
          sourceId: bFood!.id,
          targetId: aFood!.id,
        })
      )
    ).toBe(404);
    expect(
      await refusal(
        queryTrpc(aiStack.baseURL, bCookies, "ingredients.uses", { ingredientId: aFood!.id })
      )
    ).toBe(404);
    await expect(
      queryTrpc(aiStack.baseURL, bCookies, "ingredients.get", { ingredientId: aFood!.id })
    ).resolves.toBeNull();

    // Each Ingredients page lists the seed and the household's own foods, the other's never.
    for (const [user, own, other] of [
      [MEMBER, [food, byHand], []],
      [OWNER, [food], [byHand]],
    ] as const) {
      const { context, page } = await openIngredients(browser, aiStack, user);

      try {
        await page.getByTestId("ingredients-search").fill(word);
        await expect(row(page, seeded)).toBeVisible();
        for (const name of own) await expect(row(page, name)).toHaveCount(1);
        for (const name of other) await expect(row(page, name)).toHaveCount(0);
        await page.getByTestId("ingredients-search").fill(theirSpelling);
        await expect(row(page, seeded)).toHaveCount(user === MEMBER ? 1 : 0);
      } finally {
        await context.close();
      }
    }
  });
}
