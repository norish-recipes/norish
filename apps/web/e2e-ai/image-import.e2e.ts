/**
 * Image import through the real stack.
 *
 * A browser-triggered image import uploads real image bytes, a real queued
 * worker calls the vision extraction, and the extraction's provider call is
 * served by the fake AI provider's chat-completions route — vision requests
 * use the same path as text requests, with image parts in the message
 * content. Only the provider HTTP boundary is faked.
 *
 * This is the regression net for the AI-architecture refactor: the flow and
 * the wire shape asserted here must survive extraction moving packages and
 * the runtime taking over the provider call.
 */
import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import type { AIE2EStack } from "./harness";
import { E2E_BASE_URL, USER_A } from "./env";
import { bootStack, signIn, submitImageImport } from "./harness";

test.describe.configure({ mode: "serial" });

// A deterministic recipe the fake provider returns for the vision call. The
// distinctive name can only reach the browser through the controlled provider
// response, since the uploaded pixel carries no recipe content.
const IMAGE_RECIPE = {
  name: "Photographed Lentil Bake",
  description: "A deterministic recipe returned for the vision extraction call.",
  notes: null,
  recipeYield: 2,
  prepTime: null,
  cookTime: null,
  totalTime: null,
  recipeIngredient: {
    metric: ["150 g red lentils", "400 ml water"],
    us: ["5 oz red lentils", "1.5 cups water"],
  },
  recipeInstructions: {
    metric: ["Simmer the lentils until soft.", "Bake for 20 minutes."],
    us: ["Simmer the lentils until soft.", "Bake for 20 minutes."],
  },
  keywords: null,
  allergyIndications: [],
  categories: ["Dinner"],
  nutrition: { calories: null, fat: null, carbs: null, protein: null },
};

let stack: AIE2EStack | null = null;
let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  stack = await bootStack();

  const cookies = await signIn(USER_A);

  context = await browser.newContext({ baseURL: E2E_BASE_URL });
  await context.addCookies(cookies);
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
  await stack?.stop().catch(() => undefined);
  stack = null;
});

test("a browser image import reaches the provider as a vision request and persists the result", async () => {
  const ai = stack!.ai;

  ai.control.succeedWith(IMAGE_RECIPE);

  await page.goto("/");
  await submitImageImport(page);

  // The real image-import worker persists the controlled recipe and the
  // dashboard renders it.
  await expect(async () => {
    await page.reload();
    await expect(page.getByText(IMAGE_RECIPE.name).first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  expect(ai.control.requestCount).toBeGreaterThanOrEqual(1);

  // The provider saw one request, on the chat-completions path, whose message
  // content carries the uploaded image alongside the prompt text — the wire
  // shape of a vision request.
  const request = ai.control.requests.at(-1)!;

  expect(request.path).toBe("/v1/chat/completions");

  const body = request.body as {
    messages: { role: string; content: unknown }[];
  };
  const userMessage = body.messages.find((message) => message.role === "user");

  expect(userMessage).toBeDefined();
  expect(Array.isArray(userMessage!.content)).toBe(true);

  const parts = userMessage!.content as { type: string }[];

  expect(parts.some((part) => part.type === "text")).toBe(true);
  expect(parts.some((part) => part.type === "image_url")).toBe(true);
});
