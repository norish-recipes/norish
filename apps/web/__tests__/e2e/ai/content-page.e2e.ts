/** The Content page (ADR-0043) in a browser: Tags added, merged and deleted; server Cuisines; household isolation. */
import type { Locator, Page } from "@playwright/test";

import { userIdOf } from "../harness/accounts";
import { signedInContext, signIn } from "../harness/auth";
import { createRecipe, seedRecipe } from "../harness/recipes";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { expect, MEMBER, OWNER, test } from "./fixture";

interface ListedEntry {
  id: string;
  name: string;
  instance: boolean;
  version: number;
  recipeCount: number;
  editable: boolean;
}

const tagList = { kind: "tag" } as const;

function entry(page: Page, name: string) {
  return page.getByTestId("content-entry").filter({ hasText: name });
}

async function openList(
  browser: Parameters<typeof signedInContext>[0],
  baseURL: string,
  user: typeof OWNER,
  list: "tags" | "cuisines",
  width = 1280
) {
  const context = await signedInContext(browser, baseURL, user, {
    viewport: { width, height: 1200 },
  });
  const page = await context.newPage();

  await page.goto(`/settings/content/${list}`);
  // A list with no entries draws its empty state and no search.
  await expect(
    page.getByTestId("content-search").or(page.getByTestId("content-empty"))
  ).toBeVisible();

  return { context, page };
}

test("a member adds a Tag, renames one onto another, and deletes one", async ({
  browser,
  aiStack,
}) => {
  const word = `Con${Date.now().toString(36)}`;
  const diner = `${word} Diner`;
  const dinner = `${word} dinner`;
  const member = await signIn(aiStack.baseURL, MEMBER);

  // Two Tags the household's recipes carry, so the merge has recipes to move.
  await seedRecipe(await userIdOf(MEMBER), `${word} Stew`, [], { tags: [{ name: diner }] });
  await seedRecipe(await userIdOf(MEMBER), `${word} Soup`, [], { tags: [{ name: dinner }] });

  const { context, page } = await openList(browser, aiStack.baseURL, MEMBER, "tags");

  try {
    await page.getByTestId("content-search").fill(word);

    // Add: the name is listed under what already matches it, and created once nothing folds alike.
    const added = `${word} Grill`;

    await page.getByTestId("content-add").click();
    await page.getByTestId("content-add-name").fill(word);
    await expect(page.getByTestId("content-add-match")).toHaveCount(2);
    await page.getByTestId("content-add-name").fill(added);
    await page.getByTestId("content-add-submit").click();
    await expect(entry(page, added)).toBeVisible();
    await expect(entry(page, added)).toContainText("Not used");

    // Rename onto another Tag's name: Save becomes Merge, and the Tag's recipes move over.
    await entry(page, diner).click();

    const panel = page.getByRole("dialog", { name: "Edit tag" });

    await panel.getByTestId("content-entry-name").fill(dinner.toUpperCase());
    await expect(panel.getByTestId("content-save")).toHaveText("Merge");
    await expect(panel).toContainText(`“${dinner}” already exists`);
    await panel.getByTestId("content-save").click();
    await expect(panel).toBeHidden();
    await expect(entry(page, diner)).toHaveCount(0);
    await expect(entry(page, dinner)).toContainText("2 recipes");

    // Delete: the confirmation says how many recipes it comes off.
    await entry(page, dinner).click();
    await page.getByRole("dialog", { name: "Edit tag" }).getByTestId("content-delete").click();

    const modal = page.getByTestId("content-delete-modal");

    await expect(modal).toContainText("It comes off 2 recipes");
    await modal.getByTestId("content-delete-confirm").click();
    await expect(entry(page, dinner)).toHaveCount(0);
    await expect(entry(page, added)).toBeVisible();

    const left = await queryTrpc<ListedEntry[]>(aiStack.baseURL, member, "lists.list", tagList);

    expect(left.map((tag) => tag.name).filter((name) => name.startsWith(word))).toEqual([added]);
  } finally {
    await context.close();
  }
});

test("a member sees a server Cuisine read only, and an admin edits and deletes it", async ({
  browser,
  aiStack,
}) => {
  const word = `Con${Date.now().toString(36)}`;
  const basque = `${word} Basque`;
  const renamed = `${word} Basque Country`;
  const member = await signIn(aiStack.baseURL, MEMBER);

  const { entry: made } = await callTrpc<{ entry: ListedEntry }>(
    aiStack.baseURL,
    aiStack.ownerCookies,
    "lists.add",
    { kind: "cuisine", name: basque, instance: true }
  );

  await createRecipe(aiStack.baseURL, member, `${word} Pintxos`, [], { cuisines: [made.id] });

  const asMember = await openList(browser, aiStack.baseURL, MEMBER, "cuisines");

  try {
    await asMember.page.getByTestId("content-search").fill(word);
    await expect(entry(asMember.page, basque)).toBeVisible();
    await expect(
      entry(asMember.page, basque).getByRole("img", { name: "Read only" })
    ).toBeVisible();
    await entry(asMember.page, basque).click();

    const panel = asMember.page.getByRole("dialog", { name: basque });

    await expect(panel).toContainText("Your server admin keeps this cuisine for every household.");
    await expect(panel.getByTestId("content-entry-name")).toHaveAttribute("readonly", "");
    await expect(panel.getByTestId("content-delete")).toHaveCount(0);
    await expect(panel.getByTestId("content-save")).toHaveCount(0);
    await panel.getByRole("button", { name: "Done" }).click();

    const asSeen = await queryTrpc<ListedEntry[]>(aiStack.baseURL, member, "lists.list", {
      kind: "cuisine",
    });

    expect(asSeen.find((cuisine) => cuisine.name === basque)).toMatchObject({
      instance: true,
      editable: false,
    });
  } finally {
    await asMember.context.close();
  }

  const asAdmin = await openList(browser, aiStack.baseURL, OWNER, "cuisines");

  try {
    await asAdmin.page.getByTestId("content-search").fill(word);
    await entry(asAdmin.page, basque).click();

    const panel = asAdmin.page.getByRole("dialog", { name: "Edit cuisine" });

    await expect(panel).toContainText("Every household on this server is offered this cuisine.");
    await panel.getByTestId("content-entry-name").fill(renamed);
    await panel.getByTestId("content-save").click();
    await expect(entry(asAdmin.page, renamed)).toBeVisible();
    await expect(entry(asAdmin.page, basque).filter({ hasNotText: "Country" })).toHaveCount(0);

    await entry(asAdmin.page, renamed).click();
    await asAdmin.page
      .getByRole("dialog", { name: "Edit cuisine" })
      .getByTestId("content-delete")
      .click();

    const modal = asAdmin.page.getByTestId("content-delete-modal");

    await expect(modal).toContainText("in every household on this server");
    await modal.getByTestId("content-delete-confirm").click();
    await expect(entry(asAdmin.page, renamed)).toHaveCount(0);
  } finally {
    await asAdmin.context.close();
  }
});

test("household B never sees household A's entries", async ({ browser, aiStack }) => {
  const word = `Con${Date.now().toString(36)}`;
  const secret = `${word} Secret`;
  const owner = aiStack.ownerCookies;

  // Household A is the member; household B the owner.
  const member = await signIn(aiStack.baseURL, MEMBER);

  await callTrpc(aiStack.baseURL, member, "lists.add", { kind: "tag", name: secret });
  await callTrpc(aiStack.baseURL, member, "lists.add", { kind: "cuisine", name: secret });

  for (const kind of ["tag", "cuisine"] as const) {
    const theirs = await queryTrpc<ListedEntry[]>(aiStack.baseURL, owner, "lists.list", { kind });

    expect(theirs.map((each) => each.name)).not.toContain(secret);
  }

  const { context, page } = await openList(browser, aiStack.baseURL, OWNER, "tags");

  try {
    await expect(entry(page, secret)).toHaveCount(0);

    // B's own Tag of the same name is a new entry, not A's.
    await page.getByTestId("content-add").click();
    await page.getByTestId("content-add-name").fill(secret);
    await expect(page.getByTestId("content-add-match")).toHaveCount(0);
    await page.getByTestId("content-add-submit").click();
    await expect(entry(page, secret)).toBeVisible();

    const ours = await queryTrpc<ListedEntry[]>(aiStack.baseURL, owner, "lists.list", tagList);
    const theirs = await queryTrpc<ListedEntry[]>(aiStack.baseURL, member, "lists.list", tagList);

    expect(ours.find((tag) => tag.name === secret)!.id).not.toBe(
      theirs.find((tag) => tag.name === secret)!.id
    );
  } finally {
    await context.close();
  }
});

async function box(locator: Locator) {
  const found = await locator.boundingBox({ timeout: 5000 });

  if (!found) throw new Error("the element has no box");

  return found;
}

test("on a phone Add sits at the right edge of the list header", async ({ browser, aiStack }) => {
  const member = await signIn(aiStack.baseURL, MEMBER);

  await callTrpc(aiStack.baseURL, member, "lists.add", { kind: "tag", name: `Edge${Date.now()}` });

  const { context, page } = await openList(browser, aiStack.baseURL, MEMBER, "tags", 390);

  try {
    const frame = await box(
      page.getByTestId("content-entry").first().locator("xpath=ancestor::ul")
    );
    const add = await box(page.getByTestId("content-add"));

    expect(Math.abs(add.x + add.width - (frame.x + frame.width))).toBeLessThanOrEqual(1);
  } finally {
    await context.close();
  }
});

test("on a desktop each picker row spans the picker with its count at the right edge", async ({
  browser,
  aiStack,
}) => {
  const { context, page } = await openList(browser, aiStack.baseURL, MEMBER, "tags");

  try {
    const list = await box(page.getByRole("tablist", { name: "Content", exact: true }));
    const tabs = page.getByRole("tab", { name: /^(Tags|Cuisines|Categories|Ingredients)/ });

    await expect(tabs).toHaveCount(4);

    for (const tab of await tabs.all()) {
      const row = await box(tab);

      // The list pads its rows by 4 px a side.
      expect(row.width).toBeGreaterThanOrEqual(list.width - 9);
    }

    const tags = page.getByRole("tab", { name: /^Tags/ });
    const tagsBox = await box(tags);
    const count = await box(tags.locator(".tabular-nums"));

    // The row's padding is 16 px.
    expect(tagsBox.x + tagsBox.width - (count.x + count.width)).toBeLessThanOrEqual(17);
  } finally {
    await context.close();
  }
});

test("a loading list moves nothing when its entries arrive", async ({ browser, aiStack }) => {
  const word = `Con${Date.now().toString(36)}`;
  const member = await signIn(aiStack.baseURL, MEMBER);

  await callTrpc(aiStack.baseURL, member, "lists.add", { kind: "cuisine", name: `${word} Own` });
  await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "lists.add", {
    kind: "cuisine",
    name: `${word} Server`,
    instance: true,
  });

  const context = await signedInContext(browser, aiStack.baseURL, MEMBER, {
    viewport: { width: 1280, height: 1200 },
  });
  const page = await context.newPage();

  try {
    await page.goto("/settings/account");

    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    await page.route(/lists\.list/, async (route) => {
      await held;
      await route.continue();
    });
    await page.getByRole("tab", { name: "Content" }).click();
    await page.getByRole("tab", { name: /^Cuisines/ }).click();

    const loading = page.getByTestId("content-loading");

    await expect(loading).toBeVisible();
    // One frame of rows and one heading: nothing it draws is a guess about the second section.
    await expect(loading.locator("ul")).toHaveCount(1);
    await expect(loading.locator("h3")).toHaveCount(1);

    const heading = await box(loading.locator("h3"));
    const frame = await box(loading.locator("ul"));

    release();
    await expect(loading).toHaveCount(0);

    const loaded = page.getByRole("heading", { level: 3 });

    await expect(loaded).toHaveCount(2);
    expect(await box(loaded.first())).toMatchObject({ y: heading.y, height: heading.height });
    expect(
      (await box(page.getByTestId("content-entry").first().locator("xpath=ancestor::ul"))).y
    ).toBe(frame.y);
  } finally {
    await context.close();
  }
});
