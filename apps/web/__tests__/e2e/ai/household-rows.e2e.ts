// A member adds one of each household thing, then leaves (ADR-0041): the household keeps it all,
// and the member's new household of one starts with none of it, under either view level.
import { randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";

import type { SessionCookies } from "../harness/auth";
import type { ThrowawayUser } from "./admin-users-support";
import { closeAndDelete } from "../harness/accounts";
import { settingsCard as card, joinWithCode, signedInContext, signIn } from "../harness/auth";
import { openGroceries, rowFor } from "../harness/groceries";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { signUpThrowawayUser } from "./admin-users-support";
import { expect, test } from "./fixture";

const HOUSEHOLD_SETTINGS = "/settings/household";
const DAY = "2031-05-06";
const DEFAULT_POLICY = { view: "everyone", edit: "household", delete: "household" };

interface Held {
  stores: string[];
  groceries: string[];
  recurring: string[];
  pantry: string[];
  plan: string[];
  kcal: number | null;
}

/** What the reader's household holds of everything the member added. */
async function heldBy(
  baseURL: string,
  cookies: SessionCookies,
  ingredientId: string
): Promise<Held> {
  const stores = await callTrpc<Array<{ name: string }>>(baseURL, cookies, "stores.list");
  const list = await callTrpc<{
    groceries: Array<{ name: string | null; recurringGroceryId: string | null }>;
    recurringGroceries: Array<{ name: string }>;
  }>(baseURL, cookies, "groceries.list");
  const pantry = await callTrpc<Array<{ name: string }>>(baseURL, cookies, "pantry.list");
  const plan = await queryTrpc<Array<{ title: string | null }>>(
    baseURL,
    cookies,
    "calendar.listItems",
    { startISO: DAY, endISO: DAY }
  );
  const nutrition = await queryTrpc<{ numbers: { value: { kcal: number } } | null } | null>(
    baseURL,
    cookies,
    "ingredients.nutrition",
    { ingredientId }
  );

  return {
    stores: stores.map((store) => store.name),
    groceries: list.groceries
      .filter((grocery) => !grocery.recurringGroceryId)
      .map((grocery) => grocery.name ?? ""),
    recurring: list.recurringGroceries.map((recurring) => recurring.name),
    pantry: pantry.map((item) => item.name),
    plan: plan.map((entry) => entry.title ?? ""),
    kcal: nutrition?.numbers?.value.kcal ?? null,
  };
}

for (const view of ["everyone", "household"] as const) {
  test(`a member who leaves takes none of the household's things, and starts with none of them, under view ${view}`, async ({
    browser,
    aiStack,
  }) => {
    // A letter first: an all-digit tag after a name parses as the line's amount.
    const tag = `t${randomUUID().slice(0, 7)}`;
    const users: ThrowawayUser[] = [];
    const contexts: BrowserContext[] = [];
    const signedIn = async (role: string) => {
      const user = await signUpThrowawayUser(aiStack, {
        email: `rows-${role}-${tag}@norish.test`,
        password: `rows-${role}-${tag}-password`,
        name: `Rows ${role} ${tag}`,
      });

      users.push(user);
      const context = await signedInContext(browser, aiStack.baseURL, user);

      contexts.push(context);

      return { user, page: await context.newPage(), cookies: await signIn(aiStack.baseURL, user) };
    };
    const names = {
      store: `Markt ${tag}`,
      grocery: `melk ${tag}`,
      recurring: `brood ${tag}`,
      pantry: `olijfolie ${tag}`,
      plan: `Soep ${tag}`,
    };

    try {
      await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateRecipePermissionPolicy", {
        ...DEFAULT_POLICY,
        view,
      });
      const { user: admin, page: adminPage, cookies: adminCookies } = await signedIn("admin");
      const { page: memberPage, cookies: memberCookies } = await signedIn("member");

      // The member joins the admin's household by code.
      await adminPage.goto(HOUSEHOLD_SETTINGS);
      await card(adminPage, "Join code")
        .getByRole("button", { name: "Generate join code" })
        .click();
      const codeField = card(adminPage, "Join code").locator("input");

      await expect(codeField).toHaveValue(/^\d{6}$/);
      await memberPage.goto(HOUSEHOLD_SETTINGS);
      await joinWithCode(memberPage, await codeField.inputValue());
      await expect(
        card(memberPage, "Members").getByRole("row").filter({ hasText: admin.name })
      ).toBeVisible();

      // The member adds one of everything.
      const storeId = await callTrpc<string>(aiStack.baseURL, memberCookies, "stores.create", {
        id: randomUUID(),
        name: names.store,
      });

      await callTrpc(aiStack.baseURL, memberCookies, "groceries.create", [
        { id: randomUUID(), name: names.grocery, unit: null, amount: null, storeId },
      ]);
      await callTrpc(aiStack.baseURL, memberCookies, "groceries.createRecurring", {
        id: randomUUID(),
        name: names.recurring,
        amount: null,
        unit: null,
        recurrenceRule: "week",
        recurrenceInterval: 1,
        recurrenceWeekday: null,
        nextPlannedFor: DAY,
      });
      await callTrpc(aiStack.baseURL, memberCookies, "pantry.add", {
        id: randomUUID(),
        name: names.pantry,
      });
      await callTrpc(aiStack.baseURL, memberCookies, "calendar.createItem", {
        id: randomUUID(),
        date: DAY,
        slot: "Dinner",
        itemType: "note",
        title: names.plan,
      });
      const [kept] = await callTrpc<Array<{ ingredientId: string }>>(
        aiStack.baseURL,
        memberCookies,
        "pantry.list"
      );

      await callTrpc(aiStack.baseURL, memberCookies, "ingredients.correctNutrition", {
        ingredientId: kept!.ingredientId,
        numbers: { kcal: 123, fat: 1, carbs: 2, protein: 3 },
        pieceWeight: null,
        density: null,
      });

      const everything: Held = {
        stores: [names.store],
        groceries: [names.grocery],
        recurring: [names.recurring],
        pantry: [names.pantry],
        plan: [names.plan],
        kcal: 123,
      };

      expect(await heldBy(aiStack.baseURL, adminCookies, kept!.ingredientId)).toEqual(everything);

      // The member leaves.
      await memberPage.reload();
      await memberPage.getByRole("button", { name: "Leave household" }).click();
      await memberPage.getByRole("dialog").getByRole("button", { name: "Leave household" }).click();
      await expect(memberPage.getByText("Your household (just you)")).toBeVisible();

      // The household keeps everything; the member's new household holds none of it.
      expect(await heldBy(aiStack.baseURL, adminCookies, kept!.ingredientId)).toEqual(everything);
      expect(await heldBy(aiStack.baseURL, memberCookies, kept!.ingredientId)).toMatchObject({
        stores: [],
        groceries: [],
        recurring: [],
        pantry: [],
        plan: [],
      });
      expect((await heldBy(aiStack.baseURL, memberCookies, kept!.ingredientId)).kcal).not.toBe(123);

      // And the lists read so on screen.
      await openGroceries(adminPage);
      await expect(rowFor(adminPage, names.grocery, { visible: true })).toBeVisible();
      await expect(adminPage.getByText(names.store).first()).toBeVisible();
      await openGroceries(memberPage);
      await expect(rowFor(memberPage, names.grocery)).toHaveCount(0);
      await expect(memberPage.getByText(names.store)).toHaveCount(0);
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
