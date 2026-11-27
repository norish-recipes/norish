// A household admin deletes their own account (ADR-0041), under both view levels: their recipe and
// cookbook go for every reader, the household keeps its things and every plan of it is a note.
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
const DEFAULT_POLICY = { view: "everyone", edit: "household", delete: "household" };

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

for (const view of ["everyone", "household"] as const) {
  test(`deleting one's own account erases what it owns and leaves the household its things, view ${view}`, async ({
    browser,
    aiStack,
  }) => {
    // A letter first: an all-digit tag after a name parses as the line's amount.
    const tag = `t${randomUUID().slice(0, 7)}`;
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
      await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateRecipePermissionPolicy", {
        ...DEFAULT_POLICY,
        view,
      });
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

      // Both households plan the recipe under view Everyone; under Household only its own sees it.
      const planners = view === "everyone" ? [staying, stranger] : [staying];
      const plan = (reader: typeof staying, id: string) =>
        callTrpc(aiStack.baseURL, reader.cookies, "calendar.createItem", {
          id: randomUUID(),
          date: DAY,
          slot: "Dinner",
          itemType: "recipe",
          recipeId: id,
        });

      for (const reader of planners) await plan(reader, recipeId);
      // The other household plans a recipe of its own, which the deletion leaves alone.
      const strangersRecipe = await createRecipe(
        aiStack.baseURL,
        stranger.cookies,
        `Taart ${tag}`,
        ["appel"]
      );

      await plan(stranger, strangersRecipe);
      if (view === "everyone") {
        expect(await readRecipe(aiStack.baseURL, stranger.cookies, recipeId)).not.toBeNull();
        expect(await cookbookTitles(aiStack.baseURL, stranger.cookies)).toContain(names.cookbook);
      } else {
        expect(await readRecipe(aiStack.baseURL, stranger.cookies, recipeId)).toBeNull();
        expect(await cookbookTitles(aiStack.baseURL, stranger.cookies)).not.toContain(
          names.cookbook
        );
      }

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

      const strangersEntry = { itemType: "recipe", recipeId: strangersRecipe };

      await expect.poll(() => readRecipe(aiStack.baseURL, staying.cookies, recipeId)).toBeNull();
      expect(await readRecipe(aiStack.baseURL, stranger.cookies, recipeId)).toBeNull();
      expect(await planOn(aiStack.baseURL, staying.cookies)).toEqual([
        expect.objectContaining(note),
      ]);
      const strangersPlan = view === "everyone" ? [note, strangersEntry] : [strangersEntry];
      const strangersDay = await planOn(aiStack.baseURL, stranger.cookies);

      expect(strangersDay).toHaveLength(strangersPlan.length);
      expect(strangersDay).toEqual(
        expect.arrayContaining(strangersPlan.map((entry) => expect.objectContaining(entry)))
      );

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
