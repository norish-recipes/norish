/** Page loads on a throttled phone against a running instance; see scripts/README.md. */
import { connect, createServer } from "node:net";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { chromium } from "@playwright/test";

import { signIn } from "../__tests__/e2e/harness/auth";
import { cookieHeader, queryTrpc } from "../__tests__/e2e/harness/trpc";
import { RECIPE_FILTERS_COOKIE } from "../lib/recipe-filters-cookie";
import { account, accountOptions, newPhone, PHONE } from "./api";

const { values: args } = parseArgs({
  options: {
    ...accountOptions("http://localhost:3400"),
    runs: { type: "string", default: "15" },
    sw: { type: "string", default: "block" },
    share: { type: "string" },
    only: { type: "string" },
    scripts: { type: "boolean", default: false },
  },
});
const { email, password } = account(args);

const RUNS = Number(args.runs);
// "fetch": the worker fetches documents itself, as it does where navigation preload is off.
const SERVICE_WORKER = args.sw === "allow" || args.sw === "fetch";
const DOWN_BYTES_PER_SECOND = 1_600_000 / 8;
const UP_BYTES_PER_SECOND = 750_000 / 8;
const MARK_TIMEOUT_MS = 30_000;

type Marks = Record<string, string>;
type Sample = {
  firstPaint: number;
  scripts: Array<[url: string, bytes: number]>;
  marks: Record<string, number | null>;
};

// =============================================================================
// The link: one shared queue per direction, so parallel requests split the bandwidth
// =============================================================================

let throttled = true;

function lane(bytesPerSecond: number) {
  let freeAt = 0;

  /** When the bytes handed over now have crossed the link. */
  return (bytes: number) => {
    const now = performance.now();

    if (!throttled) return now;
    freeAt = Math.max(freeAt, now) + (bytes / bytesPerSecond) * 1000;

    return freeAt;
  };
}

const down = lane(DOWN_BYTES_PER_SECOND);
const up = lane(UP_BYTES_PER_SECOND);

async function startProxy(target: URL): Promise<string> {
  const server = createServer((client) => {
    const upstream = connect(Number(target.port), target.hostname);
    // One ordered queue per direction: timers alone can fire out of order at millisecond rounding.
    const pipe = (from: typeof client, to: typeof client, crossed: (bytes: number) => number) => {
      const queue: Array<{ at: number; slice: Buffer | null }> = [];
      let timer: NodeJS.Timeout | null = null;
      const drain = () => {
        timer = null;
        while (queue.length > 0 && queue[0]!.at <= performance.now()) {
          const { slice } = queue.shift()!;

          if (slice) to.destroyed || to.write(slice);
          else to.end();
        }
        if (queue.length > 0) {
          timer = setTimeout(drain, Math.max(0, queue[0]!.at - performance.now()));
        }
      };
      const push = (at: number, slice: Buffer | null) => {
        queue.push({ at, slice });
        timer ??= setTimeout(drain, Math.max(0, queue[0]!.at - performance.now()));
      };

      from.on("data", (chunk: Buffer) => {
        for (let offset = 0; offset < chunk.length; offset += 16_384) {
          const slice = chunk.subarray(offset, offset + 16_384);

          push(crossed(slice.length), slice);
        }
      });
      from.on("end", () => push(queue.at(-1)?.at ?? performance.now(), null));
      from.on("error", () => to.destroy());
    };

    pipe(client, upstream, up);
    pipe(upstream, client, down);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (!address || typeof address === "string") throw new Error("The proxy has no port");

  return `http://localhost:${address.port}`;
}

// =============================================================================
// The account
// =============================================================================

const target = new URL(args.base);
const base = await startProxy(target);

throttled = false;
// Cookies name a host, not a port, so the session's reach the proxy's origin too.
const session = await signIn(args.base, { email, password });
// A returning reader's browser has told the server its Library filters, here the defaults.
const cookies: Parameters<BrowserContext["addCookies"]>[0] = [
  ...session,
  { name: RECIPE_FILTERS_COOKIE, value: encodeURIComponent("{}"), url: base },
];

// The newest recipe and the first cookbook in the Library's default order.
const library = await queryTrpc<{ items: Array<{ kind: string; recipe?: { id: string } }> }>(
  args.base,
  session,
  "library.list",
  { limit: 50 }
);
const recipeId = library.items.find((item) => item.kind === "recipe")?.recipe?.id;
const cookbookId = (
  library.items.find((item) => item.kind === "cookbook") as { cookbook?: { id: string } }
)?.cookbook?.id;

// =============================================================================
// The pages
// =============================================================================

// A recipe's card, not its skeleton.
const CARD = '[data-recipe-card][role="button"]';
const AVATAR = 'button[aria-label="Open user menu"] [role="img"]';
// A filled heart: the seeded account favourites its newest recipes.
const HEART = 'button[aria-label="Remove from favorites"]';
const RECIPE_MARKS: Marks = {
  title: "h1",
  ingredient: "[data-ingredient-checkbox]",
};

const PAGES: Array<{ name: string; url: string | undefined; marks: Marks }> = [
  {
    name: "/",
    url: "/",
    marks: {
      card: CARD,
      today: "[data-slot-card].card--default",
      avatar: AVATAR,
      heart: HEART,
    },
  },
  {
    name: "/calendar",
    url: "/calendar",
    marks: { plan: '[data-day-key] [aria-roledescription="draggable"]' },
  },
  {
    name: "recipe",
    url: recipeId && `/recipes/${recipeId}`,
    marks: {
      ...RECIPE_MARKS,
      rating: 'button[aria-label="Rate 1 out of 5"]:not([disabled]) .text-warning',
      avatar: AVATAR,
      heart: HEART,
    },
  },
  { name: "share", url: args.share, marks: RECIPE_MARKS },
  {
    name: "cookbook",
    url: cookbookId && `/cookbooks/${cookbookId}`,
    marks: { header: "#cookbook-heading", member: CARD },
  },
  {
    name: "/groceries",
    url: "/groceries",
    marks: { price: '[data-testid="grocery-price"]', aisle: '[data-aisle-empty="false"]' },
  },
  {
    name: "/groceries/pantry",
    url: "/groceries/pantry",
    marks: { fromYourRecipes: '[data-testid="pantry-suggestions"]' },
  },
  {
    name: "/settings/account",
    url: "/settings/account",
    marks: { name: 'input[placeholder="Your name"][value]:not([value=""])' },
  },
];

/**
 * Runs in the page: the frame each mark is first drawn in. With `tap`, only on a recipe page,
 * since the Library matches a recipe's marks too, and the time of the first press is kept.
 */
function watchMarks({ marks, tap }: { marks: Marks; tap: boolean }) {
  const found: Record<string, number> = {};
  const target = window as unknown as { __marks: typeof found; __tap: number };
  const drawn = (element: Element) =>
    element.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
    element.getBoundingClientRect().height > 0;
  const tick = (frame: number) => {
    if (!tap || location.pathname.startsWith("/recipes/")) {
      for (const [name, selector] of Object.entries(marks)) {
        if (!(name in found) && [...document.querySelectorAll(selector)].some(drawn)) {
          found[name] = frame;
        }
      }
    }
    if (Object.keys(found).length < Object.keys(marks).length) requestAnimationFrame(tick);
  };

  target.__marks = found;
  if (tap) {
    addEventListener("pointerdown", () => (target.__tap = performance.now()), {
      capture: true,
      once: true,
    });
  }
  requestAnimationFrame(tick);
}

function newContext(browser: Browser): Promise<BrowserContext> {
  return newPhone(browser, base, cookies, { serviceWorkers: SERVICE_WORKER ? "allow" : "block" });
}

async function readMarks(page: Page, marks: Marks): Promise<Record<string, number | null>> {
  await page
    .waitForFunction(
      (count) =>
        Object.keys((window as unknown as { __marks: object }).__marks ?? {}).length >= count,
      Object.keys(marks).length,
      { timeout: MARK_TIMEOUT_MS }
    )
    .catch(() => undefined);
  const found = await page.evaluate(
    () => (window as unknown as { __marks: Record<string, number> }).__marks
  );

  return Object.fromEntries(Object.keys(marks).map((name) => [name, found[name] ?? null]));
}

/** One cold load. With the service worker allowed, it is installed first, off the clock. */
async function load(browser: Browser, url: string, marks: Marks): Promise<Sample> {
  const context = await newContext(browser);

  try {
    const page = await context.newPage();

    if (SERVICE_WORKER) {
      throttled = false;
      await page.goto("/");
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        while (!navigator.serviceWorker.controller) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      if (args.sw === "fetch") {
        await page.evaluate(async () =>
          (await navigator.serviceWorker.ready).navigationPreload.disable()
        );
      }
    }

    await context.addInitScript(watchMarks, { marks, tap: false });
    const cdp = await context.newCDPSession(page);
    // The encoded size of every script the load downloads.
    const scripts: Array<Promise<[string, number]>> = [];

    page.on("requestfinished", (request) => {
      if (request.resourceType() === "script") {
        scripts.push(request.sizes().then((sizes) => [request.url(), sizes.responseBodySize]));
      }
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    throttled = true;
    await page.goto(url);
    const found = await readMarks(page, marks);
    const firstPaint = await page.evaluate(
      () =>
        (
          performance.getEntriesByName("first-paint")[0] ??
          performance.getEntriesByName("first-contentful-paint")[0]
        )?.startTime ?? Number.NaN
    );

    return {
      firstPaint,
      scripts: await Promise.all(scripts),
      marks: Object.fromEntries(
        Object.entries(found).map(([name, at]) => [
          name,
          at === null ? null : Math.max(at, firstPaint),
        ])
      ),
    };
  } finally {
    await context.close();
  }
}

/**
 * The Library, then a tap on a recipe card whose recipe was never read: every `recipes.get`
 * (the Cache Warmer's, the cards' prefetch) fails until the tap. From the tap to the recipe drawn.
 */
async function tap(browser: Browser): Promise<Sample> {
  const context = await newContext(browser);

  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const held = (url: URL) => url.pathname.includes("recipes.get");

    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    throttled = true;
    await page.route(held, (route) => route.abort());
    await page.goto("/");
    await page.locator(`${CARD}:visible`).first().waitFor();
    await page.waitForTimeout(5_000);
    await page.unroute(held);
    await page.evaluate(watchMarks, { marks: RECIPE_MARKS, tap: true });
    await page.locator(`${CARD}:visible`).first().click();
    const found = await readMarks(page, RECIPE_MARKS);
    const tappedAt = await page.evaluate(() => (window as unknown as { __tap: number }).__tap);

    return {
      firstPaint: Number.NaN,
      scripts: [],
      marks: Object.fromEntries(
        Object.entries(found).map(([name, at]) => [name, at === null ? null : at - tappedAt])
      ),
    };
  } finally {
    await context.close();
  }
}

/** The document a full load of `url` answers, gzipped. */
async function documentSize(url: string): Promise<number> {
  const response = await fetch(`${args.base}${url}`, {
    headers: {
      cookie: cookieHeader(cookies),
      "user-agent": PHONE.userAgent,
      accept: "text/html",
      "sec-fetch-dest": "document",
    },
  });

  return gzipSync(Buffer.from(await response.arrayBuffer())).length;
}

// =============================================================================
// The report
// =============================================================================

function summary(values: number[]): string {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);

  if (sorted.length === 0) return "—";
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const misses = values.length - sorted.length;

  return `${Math.round(median)} (${Math.round(sorted[0]!)}–${Math.round(sorted.at(-1)!)})${
    misses ? `, ${misses} missed` : ""
  }`;
}

/** Each mark's summary across the samples. */
function marksSummary(marks: Marks, samples: Sample[]): string {
  return Object.keys(marks)
    .map((mark) => `${mark} ${summary(samples.map((sample) => sample.marks[mark] ?? Number.NaN))}`)
    .join("; ");
}

/** One run to warm up, off the record, then the measured ones. */
async function sampled(run: () => Promise<Sample>): Promise<Sample[]> {
  const samples: Sample[] = [];

  await run();
  for (let index = 0; index < RUNS; index++) samples.push(await run());

  return samples;
}

const browser = await chromium.launch();
const only = args.only?.split(",");
const lines = [
  `Service worker ${args.sw}, ${RUNS} runs, median (spread) in ms.`,
  "",
  "| Page | First paint | Content | Document (KB gzip) | JS (KB) |",
  "| ---- | ----------: | ------- | -----------------: | ------: |",
];

try {
  for (const { name, url, marks } of PAGES) {
    if (!url || (only && !only.includes(name))) continue;
    const samples = await sampled(() => load(browser, url, marks));
    const size = ((await documentSize(url)) / 1024).toFixed(1);

    const js = summary(
      samples.map((sample) => sample.scripts.reduce((total, [, bytes]) => total + bytes, 0) / 1024)
    );

    lines.push(
      `| ${name} | ${summary(samples.map((sample) => sample.firstPaint))} | ${marksSummary(marks, samples)} | ${size} | ${js} |`
    );
    process.stdout.write(`${lines.at(-1)}\n`);
    if (args.scripts) {
      // The last load's scripts, largest first.
      for (const [url, bytes] of samples.at(-1)!.scripts.sort(([, a], [, b]) => b - a)) {
        process.stdout.write(`  ${(bytes / 1024).toFixed(1)} KB ${new URL(url).pathname}\n`);
      }
    }
  }

  if (!only || only.includes("tap")) {
    const samples = await sampled(() => tap(browser));

    lines.push(`| tap to a recipe | — | ${marksSummary(RECIPE_MARKS, samples)} | — | — |`);
  }
} finally {
  await browser.close();
}

process.stdout.write(`\n${lines.join("\n")}\n`);
process.exit(0);
