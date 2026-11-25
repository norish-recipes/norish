// A household admin deletes their own account (ADR-0041): their recipe and cookbook go for every
// reader, the household keeps its things and hands the role on, and every plan of it is a note.
import { randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";

import type { SessionCookies } from "../harness/auth";
import type { ThrowawayUser } from "./admin-users-support";
import { closeAndDelete } from "../harness/accounts";
import { signedInContext, signIn } from "../harness/auth";
import { openGroceries, rowFor } from "../harness/groceries";
import { createRecipe, readRecipe } from "../harness/recipes";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { readHousehold, seedHousehold, signUpThrowawayUser } from "./admin-users-support";
import { expect, test } from "./fixture";

const DAY = "2031-05-06";

/** The cookbooks the reader may view, by title. */
async function cookbookTitles(baseURL: string, cookies: SessionCookies): Promise<string[]> {
  const { cookbooks } = await queryTrpc<{ cookbooks: Array<{ title: string }> }>(
    baseURL,
    cookies,
    "cookbooks.list",
    {}
  );

  return cookbooks.map((cookbook) => cookbook.title);
}

/** The reader's plan on the day, as the calendar lists it. */
async function planOn(baseURL: string, cookies: SessionCookies) {
  return await queryTrpc<
    Array<{ itemType: string; recipeId: string | null; title: string | null }>
  >(baseURL, cookies, "calendar.listItems", { startISO: DAY, endISO: DAY });
}

test("deleting one's own account erases what it owns and leaves the household its things", async ({
  browser,
  aiStack,
}) => {
  const tag = randomUUID().slice(0, 8);
  const users: ThrowawayUser[] = [];
  const contexts: BrowserContext[] = [];
  const signedIn = async (role: string) => {
    const user = await signUpThrowawayUser(aiStack, {
      email: `deletion-${role}-${tag}@norish.test`,
      password: `deletion-${role}-${tag}-password`,
      name: `Deletion ${role} ${tag}`,
    });

    users.push(user);
    const context = await signedInContext(browser, aiStack.baseURL, user);

    contexts.push(context);

    return { user, page: await context.newPage(), cookies: await signIn(aiStack.baseURL, user) };
  };
  const names = {
    recipe: `Soep ${tag}`,
    cookbook: `Boek ${tag}`,
    store: `Markt ${tag}`,
    grocery: `melk ${tag}`,
  };

  try {
    const leaving = await signedIn("leaving");
    const staying = await signedIn("staying");
    const stranger = await signedIn("stranger");
    const householdId = await seedHousehold(`Deletion ${tag}`, leaving.user.id, [
      leaving.user.id,
      staying.user.id,
    ]);

    // The leaving admin owns a recipe and a cookbook and adds household things.
    const recipeId = await createRecipe(aiStack.baseURL, leaving.cookies, names.recipe, ["prei"]);

    await callTrpc(aiStack.baseURL, leaving.cookies, "cookbooks.create", {
      id: randomUUID(),
      title: names.cookbook,
    });
    const storeId = await callTrpc<string>(aiStack.baseURL, leaving.cookies, "stores.create", {
      id: randomUUID(),
      name: names.store,
    });

    await callTrpc(aiStack.baseURL, leaving.cookies, "groceries.create", [
      { id: randomUUID(), name: names.grocery, unit: null, amount: null, storeId },
    ]);

    // Both households plan the recipe; under view Everyone the stranger may.
    for (const reader of [staying, stranger]) {
      await callTrpc(aiStack.baseURL, reader.cookies, "calendar.createItem", {
        id: randomUUID(),
        date: DAY,
        slot: "Dinner",
        itemType: "recipe",
        recipeId,
      });
    }
    expect(await readRecipe(aiStack.baseURL, stranger.cookies, recipeId)).not.toBeNull();
    expect(await cookbookTitles(aiStack.baseURL, stranger.cookies)).toContain(names.cookbook);

    // The admin deletes their own account in Settings, told what goes and who takes over.
    await leaving.page.goto("/settings/account");
    await leaving.page.getByRole("button", { name: "Delete my account" }).click();
    const dialog = leaving.page.getByRole("dialog");

    await expect(dialog).toContainText("the longest-standing member takes over");
    await expect(dialog).toContainText("Your recipes on the plan stay there as notes");
    await dialog.getByRole("button", { name: "Delete my account" }).click();
    await expect(leaving.page).toHaveURL(/\/login/);
    users.splice(users.indexOf(leaving.user), 1);

    // The recipe is gone for every reader; each plan shows a note with its title.
    const note = { itemType: "note", recipeId: null, title: names.recipe };

    for (const reader of [staying, stranger]) {
      await expect.poll(() => readRecipe(aiStack.baseURL, reader.cookies, recipeId)).toBeNull();
      expect(await planOn(aiStack.baseURL, reader.cookies)).toEqual([
        expect.objectContaining(note),
      ]);
    }

    // The household stays, run by who stays, with its store and groceries.
    expect(await readHousehold(householdId)).toEqual({
      adminUserId: staying.user.id,
      memberIds: [staying.user.id],
    });
    const stores = await callTrpc<Array<{ name: string }>>(
      aiStack.baseURL,
      staying.cookies,
      "stores.list"
    );

    expect(stores.map((store) => store.name)).toEqual([names.store]);
    expect(await cookbookTitles(aiStack.baseURL, stranger.cookies)).not.toContain(names.cookbook);
    await openGroceries(staying.page);
    await expect(rowFor(staying.page, names.grocery, { visible: true })).toBeVisible();
  } finally {
    await closeAndDelete(contexts, users);
  }
});
