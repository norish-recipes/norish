/**
 * Bring! as the instance's shopping list, in a browser, against a Bring! the harness serves itself.
 *
 * The administrator switches the provider and another member's open page loses its Groceries tab
 * with no reload. From a recipe, the panel then keeps the ticked lines ready for Bring! behind a
 * public page the fake fetches, with no cookie, as Bring!'s own servers would, and one press opens
 * Bring!'s link. The real Norish server, database, Valkey, tRPC and realtime are all in the path;
 * only Bring! is ours.
 */
import { randomUUID } from "node:crypto";
import type { APIResponse, BrowserContext, Page } from "@playwright/test";
import { request } from "@playwright/test";

import { deleteRecipeById } from "@norish/db/repositories/recipes";

import type { AIE2EStack } from "./fixture";
import { userIdOf } from "../harness/accounts";
import { signedInContext } from "../harness/auth";
import { seedRecipe } from "../harness/recipes";
import { deleteEveryGrocery } from "../harness/reset";
import { callTrpc } from "../harness/trpc";
import { expect, MEMBER, OWNER, test } from "./fixture";
import { seedGrocery } from "./ingredient-icons-support";
import { readGroceryNames } from "./pantry-support";

test.describe.configure({ mode: "serial" });

const RECIPE = `Bring pasta ${randomUUID().slice(0, 8)}`;
const LINES = ["bring-spaghetti", "bring-tomatoes"];
const EARLIER_GROCERY = "bring-earlier-grocery";

let stack: AIE2EStack;
let recipeId: string;
let ownerContext: BrowserContext;
let memberContext: BrowserContext;
let owner: Page;
let member: Page;

test.beforeAll(async ({ browser, aiStack }) => {
  stack = aiStack;
  stack.bring.reset();
  recipeId = await seedRecipe(await userIdOf(OWNER), RECIPE, LINES);
  await seedGrocery(stack, EARLIER_GROCERY);

  ownerContext = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
  });
  memberContext = await signedInContext(browser, aiStack.baseURL, MEMBER);
  owner = await ownerContext.newPage();
  member = await memberContext.newPage();
});

test.afterAll(async () => {
  // Whatever happened, the instance goes back to its own list for the specs that follow.
  if (stack) {
    await setProvider("builtin");
    stack.bring.reset();
  }
  await Promise.allSettled([ownerContext?.close(), memberContext?.close()]);
  if (recipeId) await deleteRecipeById(recipeId);
  await deleteEveryGrocery();
});

function setProvider(provider: "builtin" | "bring"): Promise<unknown> {
  return callTrpc(stack.baseURL, stack.ownerCookies, "admin.updateGroceryListProvider", provider);
}

/** The Groceries tabs in view: the mobile navigation sits in the DOM beside the desktop one. */
function groceriesTab(page: Page) {
  return page.getByRole("link", { name: "Groceries", exact: true }).filter({ visible: true });
}

/** The recipe page's add-to-list panel, opened from its ingredients card. */
async function openPanel(title: string) {
  await owner.goto(`/recipes/${recipeId}`);
  await owner.getByRole("button", { name: "Add", exact: true }).first().click();

  const panel = owner.getByRole("dialog", { name: title });

  await expect(panel).toBeVisible();
  await expect(panel.getByRole("checkbox", { name: LINES[0] })).toBeVisible();

  return panel;
}

type HandoffRecipe = { name: string; recipeYield: string; recipeIngredient: string[] };

/** The schema.org Recipe a Bring Handoff page carries. */
function recipeOf(html: string): HandoffRecipe {
  const found = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html);

  if (!found) throw new Error("The page carries no JSON-LD");

  return JSON.parse(found[1] ?? "") as HandoffRecipe;
}

/** The path of the Bring Handoff page Bring! was last asked about. */
function lastHandoffPath(): string {
  const sent = stack.bring.requests.at(-1);

  if (!sent) throw new Error("Bring! was never asked for a link");

  return new URL(sent.body.url).pathname;
}

/** A request from a stranger: no cookie, no session. */
async function getPublic(path: string): Promise<APIResponse> {
  const api = await request.newContext({ baseURL: stack.baseURL });

  try {
    return await api.get(path);
  } finally {
    await api.dispose();
  }
}

test("switching to Bring! takes the Groceries tab from another member's open page, live", async () => {
  await member.goto("/");
  await expect(groceriesTab(member).first()).toBeVisible();
  expect(await readGroceryNames(stack)).toEqual([EARLIER_GROCERY]);

  await setProvider("bring");

  // No reload anywhere: the configuration announcement reaches the open page.
  await expect(groceriesTab(member)).toHaveCount(0);
});

test("the grocery list's address takes a member home", async () => {
  await member.goto("/groceries");

  await expect(member).toHaveURL(/\/$/);
  await expect(groceriesTab(member)).toHaveCount(0);
});

test("the panel readies the ticked lines for Bring!, and one press opens its link", async () => {
  // Bring! is slow to answer, so the button waits for it.
  const release = stack.bring.hold();
  const panel = await openPanel("Add to Bring!");
  const add = panel.getByRole("button", { name: "Add to Bring!" });

  await expect(add).toBeDisabled();
  release();
  await expect(add).toBeEnabled();

  // Bring!'s parser read the page first, then Bring! was asked once, for this instance's page.
  expect(stack.bring.parsed).toHaveLength(1);
  expect(stack.bring.requests).toHaveLength(1);
  const [sent] = stack.bring.requests;
  const { body, pageStatus, pageHtml } = sent!;

  expect(body.source).toBe("web");
  expect(new URL(body.url).pathname).toMatch(/^\/share\/bring\/[A-Za-z0-9_-]{32}$/);
  // The fake fetched it with no cookie at all.
  expect(pageStatus).toBe(200);
  const prepared = recipeOf(pageHtml);

  expect(prepared.name).toBe(RECIPE);
  expect(prepared.recipeYield).toBe("2");
  for (const line of LINES) expect(prepared.recipeIngredient.join("\n")).toContain(line);

  // A change waits for the page to hold it before the button can open it.
  // Keyboard: the checkbox's control span sits over the input, so a click never reaches it.
  await panel.getByRole("checkbox", { name: LINES[1] }).press("Space");
  await expect(add).toBeDisabled();
  await expect(add).toBeEnabled();
  await panel.getByRole("button", { name: "More servings" }).click();
  await expect(add).toBeDisabled();
  await expect(add).toBeEnabled();

  // One press: Bring!'s link opens in a new tab at once, with no blank tab before it and no second
  // tap.
  const [opened] = await Promise.all([ownerContext.waitForEvent("page"), add.click()]);

  await opened.waitForURL(`${stack.bring.url}/deeplink/1`);
  expect(await opened.evaluate(() => window.opener)).toBeNull();
  await opened.close();
  await expect(panel).toBeHidden();
  await expect(owner.getByRole("button", { name: "Open Bring!" })).toHaveCount(0);

  // The changes stayed with this instance: Bring! was not asked again, and the link it gave
  // reads the page as the member left it.
  expect(stack.bring.requests).toHaveLength(1);
  expect(stack.bring.opened).toHaveLength(1);
  const [read] = stack.bring.opened;

  expect(read!.pageStatus).toBe(200);
  const recipe = recipeOf(read!.pageHtml);

  expect(recipe.name).toBe(RECIPE);
  expect(recipe.recipeYield).toBe("3");
  expect(recipe.recipeIngredient.join("\n")).toContain(LINES[0]);
  expect(recipe.recipeIngredient.join("\n")).not.toContain(LINES[1]);

  // An opened page stays up for Bring! to read again.
  expect((await getPublic(new URL(body.url).pathname)).status()).toBe(200);

  // Nothing landed on the built-in list.
  expect(await readGroceryNames(stack)).toEqual([EARLIER_GROCERY]);
});

test("a panel closed without opening Bring! takes its page down", async () => {
  // Counted before the panel opens: it prepares the page as it opens.
  const requestsBefore = stack.bring.requests.length;
  const panel = await openPanel("Add to Bring!");

  await expect(panel.getByRole("button", { name: "Add to Bring!" })).toBeEnabled();
  expect(stack.bring.requests).toHaveLength(requestsBefore + 1);
  const path = lastHandoffPath();

  expect((await getPublic(path)).status()).toBe(200);

  await panel.getByRole("button", { name: "Close panel" }).click();
  await expect(panel).toBeHidden();

  await expect.poll(async () => (await getPublic(path)).status()).toBe(404);
  expect(stack.bring.opened).toHaveLength(1);
});

test("when Bring! cannot fetch the page, the member is told the status, and no tab opens", async () => {
  const parsedBefore = stack.bring.parsed.length;
  const requestsBefore = stack.bring.requests.length;
  const pagesBefore = ownerContext.pages().length;

  // The parser reads a token that does not exist, so the instance answers it 404.
  stack.bring.breakPages();

  // The panel readies the lines as it opens, so it says so before any press.
  const panel = await openPanel("Add to Bring!");
  const add = panel.getByRole("button", { name: "Add to Bring!" });

  await expect(owner.getByText(/Bring! couldn't open the page Norish made for it/)).toBeVisible();
  await expect(owner.getByText("Your server answered HTTP 404.")).toBeVisible();
  await expect(panel).toBeVisible();
  expect(stack.bring.parsed).toHaveLength(parsedBefore + 1);

  // A press tries again, and still opens nothing.
  await expect(add).toBeEnabled();
  await add.click();

  await expect.poll(() => stack.bring.parsed.length).toBe(parsedBefore + 2);
  await expect(owner.getByText("Your server answered HTTP 404.").first()).toBeVisible();
  await expect(panel).toBeVisible();
  expect(ownerContext.pages()).toHaveLength(pagesBefore);
  // Bring! was never asked for a link.
  expect(stack.bring.requests).toHaveLength(requestsBefore);
  stack.bring.reset();
});

test("when Bring! cannot read the page, the member is told and the panel stays open", async () => {
  const requestsBefore = stack.bring.requests.length;
  const pagesBefore = ownerContext.pages().length;

  stack.bring.refuse();
  const panel = await openPanel("Add to Bring!");

  await expect(owner.getByText(/Bring! couldn't read the list/)).toBeVisible();
  await expect(panel).toBeVisible();
  expect(stack.bring.requests).toHaveLength(requestsBefore + 1);
  // A page Bring! refused is not left up.
  expect((await getPublic(lastHandoffPath())).status()).toBe(404);
  expect(ownerContext.pages()).toHaveLength(pagesBefore);
  await expect(owner.getByRole("button", { name: "Open Bring!" })).toHaveCount(0);
  expect(await readGroceryNames(stack)).toEqual([EARLIER_GROCERY]);
});

test("a token that is unknown or malformed answers 404", async () => {
  expect((await getPublic(`/share/bring/${"A".repeat(32)}`)).status()).toBe(404);
  expect((await getPublic("/share/bring/not-a-token")).status()).toBe(404);
  expect((await getPublic(`/share/bring/${"A".repeat(33)}`)).status()).toBe(404);
});

test("switching back restores the tab and the list is as it was", async () => {
  await setProvider("builtin");

  await expect(groceriesTab(member).first()).toBeVisible();

  // The grocery is the owner's, so the owner is the one who sees it.
  await owner.goto("/groceries");
  await expect(owner).toHaveURL(/\/groceries$/);
  await expect(owner.getByText(EARLIER_GROCERY).first()).toBeVisible();
  expect(await readGroceryNames(stack)).toEqual([EARLIER_GROCERY]);
});
