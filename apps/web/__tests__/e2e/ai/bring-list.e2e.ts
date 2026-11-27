/**
 * Bring! as the instance's shopping list, in a browser, against a Bring! the harness serves itself.
 *
 * The administrator switches the provider and another member's open page loses its Groceries tab
 * with no reload. From a recipe, the panel then hands the ticked lines to Bring! through the public
 * page the fake fetches, with no cookie, as Bring!'s own servers would. The real Norish server,
 * database, Valkey, tRPC and realtime are all in the path; only Bring! is ours.
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

/** The schema.org Recipe a Bring Handoff page carries. */
function recipeOf(html: string): { name: string; recipeIngredient: string[] } {
  const found = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html);

  if (!found) throw new Error("The page carries no JSON-LD");

  return JSON.parse(found[1] ?? "") as { name: string; recipeIngredient: string[] };
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

test("a recipe's ingredients go to Bring! as a public schema.org Recipe, and not onto the list", async () => {
  const panel = await openPanel("Add to Bring!");

  // One press: Bring!'s link opens in a new tab as soon as it is back, with no blank tab before it
  // and no second tap.
  const [opened] = await Promise.all([
    ownerContext.waitForEvent("page"),
    panel.getByRole("button", { name: "Add to Bring!" }).click(),
  ]);

  await opened.waitForURL(`${stack.bring.url}/deeplink/1`);
  expect(await opened.evaluate(() => window.opener)).toBeNull();
  await opened.close();
  await expect(owner.getByRole("button", { name: "Open Bring!" })).toHaveCount(0);

  // Bring!'s parser read the page first, then Bring! was asked once, for this instance's page.
  expect(stack.bring.parsed).toHaveLength(1);
  expect(stack.bring.requests).toHaveLength(1);
  const [sent] = stack.bring.requests;
  const { body, pageStatus, pageHtml } = sent!;

  expect(body.source).toBe("web");
  expect(new URL(body.url).pathname).toMatch(/^\/share\/bring\/[A-Za-z0-9_-]{32}$/);
  // The fake fetched it with no cookie at all.
  expect(pageStatus).toBe(200);
  const recipe = recipeOf(pageHtml);

  expect(recipe.name).toBe(RECIPE);
  for (const line of LINES) expect(recipe.recipeIngredient.join("\n")).toContain(line);

  // Nothing landed on the built-in list.
  expect(await readGroceryNames(stack)).toEqual([EARLIER_GROCERY]);
});

test("when Bring! cannot fetch the page, the member is told the status, and no tab opens", async () => {
  const panel = await openPanel("Add to Bring!");
  const parsedBefore = stack.bring.parsed.length;
  const requestsBefore = stack.bring.requests.length;
  const pagesBefore = ownerContext.pages().length;

  // The parser reads a token that does not exist, so the instance answers it 404.
  stack.bring.breakPages();

  await panel.getByRole("button", { name: "Add to Bring!" }).click();

  await expect(owner.getByText(/Bring! couldn't open the page Norish made for it/)).toBeVisible();
  await expect(owner.getByText("Your server answered HTTP 404.")).toBeVisible();
  expect(ownerContext.pages()).toHaveLength(pagesBefore);
  await expect(panel).toBeVisible();
  expect(stack.bring.parsed).toHaveLength(parsedBefore + 1);
  // Bring! was never asked for a link.
  expect(stack.bring.requests).toHaveLength(requestsBefore);
  stack.bring.reset();
});

test("when Bring! cannot read the page, the member is told and the panel stays open", async () => {
  stack.bring.refuse();
  const panel = await openPanel("Add to Bring!");
  const requestsBefore = stack.bring.requests.length;

  await panel.getByRole("button", { name: "Add to Bring!" }).click();

  await expect(owner.getByText(/Bring! couldn't read the list/)).toBeVisible();
  await expect(panel).toBeVisible();
  expect(stack.bring.requests).toHaveLength(requestsBefore + 1);
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
