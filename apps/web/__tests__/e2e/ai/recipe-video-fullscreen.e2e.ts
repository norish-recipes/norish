/**
 * Watching a recipe video on a phone, end to end (#563).
 *
 * The phone hero is a poster: the photo runs edge to edge, dissolves into the
 * page ground over its lower half, and carries the title pulled up over it.
 * That is exactly the band the video player draws its own controls in, so on a
 * phone a video could only ever be seen cropped into the hero's shape and
 * silent — its mute, its scrubber and its expand button were all under the
 * fade and the title.
 *
 * The acceptance is browser behaviour end to end: a control the hero cannot
 * cover, real element fullscreen, the whole frame instead of the crop, sound,
 * and the same element throughout so the playback position simply carries.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { request } from "@playwright/test";
import { Client } from "pg";

import type { AIE2EStack } from "./fixture";
import { databaseUrl } from "./database";
import { expect, test } from "./fixture";
import { setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

const PHONE_VIEWPORT = { width: 390, height: 844 };

/** 270x480, so the hero's own shape can only be reached by cropping it. */
const PORTRAIT_CLIP = path.join(import.meta.dirname, "fixtures/portrait-clip.mp4");
const CLIP_FILENAME = "portrait-clip.mp4";

const RECIPE = {
  name: "Handheld Video Bake",
  description: "A deterministic recipe whose hero is a portrait video.",
  url: null,
  servings: 2,
  prepMinutes: 5,
  cookMinutes: 10,
  totalMinutes: 15,
  systemUsed: "metric",
  recipeIngredients: [
    { ingredientName: "Rolled oats", ingredientId: null, amount: 200, unit: "g", order: 0 },
  ],
  steps: [{ step: "Toast the oats until fragrant.", order: 0, systemUsed: "metric" }],
  tags: [],
  cuisines: [],
  categories: ["Snack"],
  images: [],
  videos: [],
};

let stack: AIE2EStack;
let context: BrowserContext;
let page: Page;
let recipeId: string;

/**
 * The phone tree's. A recipe page renders its phone and its desktop layout
 * both, one of them hidden, so everything here asks for the visible one.
 */
function heroVideo() {
  return page.locator("video").filter({ visible: true }).first();
}

/**
 * The expand control in the floating chrome row. The player draws one of its
 * own with the same label, down in the band the hero covers; this is the one
 * a reader can actually see.
 */
function expandControl() {
  return page.getByTestId("recipe-media-expand").filter({ visible: true }).first();
}

function videoState() {
  return heroVideo().evaluate((video: HTMLVideoElement) => ({
    muted: video.muted,
    currentTime: video.currentTime,
    objectFit: getComputedStyle(video).objectFit,
    inFullscreen: document.fullscreenElement?.contains(video) ?? false,
  }));
}

test.beforeAll(async ({ aiStack, browser }) => {
  stack = aiStack;
  await setAutomaticEnrichment({});

  context = await browser.newContext({
    baseURL: stack.baseURL,
    storageState: { cookies: stack.ownerCookies, origins: [] },
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
  });
  page = await context.newPage();

  const api = await request.newContext({
    baseURL: stack.baseURL,
    extraHTTPHeaders: {
      origin: stack.baseURL,
      cookie: stack.ownerCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });

  try {
    const response = await api.post("/api/trpc/recipes.create", { data: { json: RECIPE } });

    if (!response.ok()) throw new Error(`recipes.create failed: ${response.status()}`);

    const body = (await response.json()) as { result: { data: { json: string } } };

    recipeId = body.result.data.json;
  } finally {
    await api.dispose();
  }

  // The gallery upload mutation transcodes; this spec is about watching a
  // video, not about ingesting one, so the clip is put where the media route
  // serves it from and the row is written beside it.
  const recipeDir = path.join(stack.server.uploadsDir, "recipes", recipeId);

  await fs.mkdir(recipeDir, { recursive: true });
  await fs.copyFile(PORTRAIT_CLIP, path.join(recipeDir, CLIP_FILENAME));

  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();
  try {
    // The mutation answers before its transaction lands, so the row the video
    // points at is not there yet.
    await expect
      .poll(
        async () => {
          const rows = await database.query("select 1 from recipes where id = $1", [recipeId]);

          return rows.rowCount;
        },
        { timeout: 30_000 }
      )
      .toBe(1);

    await database.query(
      `insert into recipe_videos (recipe_id, video, duration, "order") values ($1, $2, $3, 0)`,
      [recipeId, `/recipes/${recipeId}/${CLIP_FILENAME}`, 3]
    );
  } finally {
    await database.end();
  }
});

test.afterAll(async () => {
  await context?.close();
});

test("the hero offers an expand control the fade and the title cannot cover", async () => {
  await page.goto(`/recipes/${recipeId}`);

  await expect(heroVideo()).toBeVisible();

  const expand = expandControl();

  await expect(expand).toBeVisible();

  // The control the player draws for itself sits at the video's bottom edge,
  // under the fade and behind the title block the page pulls up over it. The
  // one in the chrome row is the reachable one, so it is the one on top.
  const expandBox = await expand.boundingBox();
  const heroBox = await heroVideo().boundingBox();

  expect(expandBox).not.toBeNull();
  expect(heroBox).not.toBeNull();
  expect(expandBox!.y).toBeLessThan(heroBox!.y + heroBox!.height / 2);

  const topmostAtControl = await page.evaluate(
    ([x, y]) => {
      const element = document.elementFromPoint(x as number, y as number);

      return element?.closest("button")?.getAttribute("aria-label") ?? null;
    },
    [expandBox!.x + expandBox!.width / 2, expandBox!.y + expandBox!.height / 2]
  );

  expect(topmostAtControl).toBe("Enter fullscreen");
});

test("expanding shows the whole frame with its sound, and hands the crop back on the way out", async () => {
  await page.goto(`/recipes/${recipeId}`);
  await expect(heroVideo()).toBeVisible();

  const cropped = await videoState();

  expect(cropped.objectFit).toBe("cover");
  expect(cropped.muted).toBe(true);
  expect(cropped.inFullscreen).toBe(false);

  await expandControl().click();

  await expect.poll(async () => (await videoState()).inFullscreen).toBe(true);

  const expanded = await videoState();

  // Letterboxed rather than cropped: a portrait clip is finally whole.
  expect(expanded.objectFit).toBe("contain");
  expect(expanded.muted).toBe(false);

  // The same element throughout, so the position carries rather than restarts.
  expect(expanded.currentTime).toBeGreaterThanOrEqual(cropped.currentTime);

  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(async () => (await videoState()).inFullscreen).toBe(false);

  const restored = await videoState();

  expect(restored.objectFit).toBe("cover");
  expect(restored.muted).toBe(true);
  expect(restored.currentTime).toBeGreaterThanOrEqual(expanded.currentTime);
});
