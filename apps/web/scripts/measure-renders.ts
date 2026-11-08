/** Mounts and re-renders per scripted action on a dev server; see scripts/README.md. */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { chromium, devices } from "@playwright/test";

import { callTrpc, signIn } from "./api";

const {
  values: args,
  positionals: [scenarioName],
} = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string", default: "http://localhost:3000" },
    email: { type: "string" },
    password: { type: "string" },
  },
});

if (!args.email || !args.password) throw new Error("--email and --password are required");

const BASE = args.base;
const EMAIL = args.email;
const PASSWORD = args.password;
/** An action is over once no request is open and React has not committed for this long. */
const QUIET_MS = 1_500;
/** How long after its request a tRPC response reaches the page. */
const RESPONSE_DELAY_MS = 500;
/** How long after the server sent it a socket message reaches the page. */
const MESSAGE_DELAY_MS = 200;
/** The least time between two of them reaching the page. */
const DELIVERY_GAP_MS = 150;

type Counted = { name: string; mounts: number; updates: number; why: Record<string, number> };
type Taken = { commits: number; components: Counted[] };
type Renders = { __renders: { idle: () => number; take: () => Taken } };

// =============================================================================
// The counter, in the page
// =============================================================================

/**
 * Runs in the page before React loads, as the React DevTools hook: after each commit of the
 * app's root it walks the fibers that rendered and counts mounts and updates per component.
 */
function countRenders() {
  type ContextItem = { memoizedValue: unknown; next: ContextItem | null };
  type Hook = { memoizedState: unknown; queue: unknown; next: Hook | null };
  type Fiber = {
    tag: number;
    type: unknown;
    flags: number;
    alternate: Fiber | null;
    child: Fiber | null;
    sibling: Fiber | null;
    memoizedProps: Record<string, unknown> | null;
    memoizedState: unknown;
    dependencies: { firstContext: ContextItem | null } | null;
  };
  type Named = { displayName?: string; name?: string; render?: Named };

  // Function, class, forwardRef and simple memo components; flag 1 is React's PerformedWork.
  const COMPONENT_TAGS = new Set([0, 1, 11, 15]);
  const CLASS_TAG = 1;
  const PERFORMED_WORK = 1;
  let counts = new Map<string, Counted>();
  let commits = 0;
  let lastCommit = performance.now();

  const entry = (fiber: Fiber) => {
    const type = fiber.type as Named;
    const name =
      type.displayName || type.name || type.render?.displayName || type.render?.name || "Anonymous";
    const counted = counts.get(name) ?? { name, mounts: 0, updates: 0, why: {} };

    counts.set(name, counted);

    return counted;
  };
  /** The props whose identity changed, else whether state or a read context did. */
  const reasons = (prev: Fiber, next: Fiber) => {
    const before = prev.memoizedProps ?? {};
    const after = next.memoizedProps ?? {};
    const why = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
      (key) => !Object.is(before[key], after[key])
    );
    // useState, useReducer and useSyncExternalStore are the hooks with a queue.
    let stateChanged = next.tag === CLASS_TAG && prev.memoizedState !== next.memoizedState;

    for (
      let a = prev.memoizedState as Hook | null, b = next.memoizedState as Hook | null;
      next.tag !== CLASS_TAG && a && b;
      a = a.next, b = b.next
    ) {
      if (b.queue && !Object.is(a.memoizedState, b.memoizedState)) stateChanged = true;
    }
    if (stateChanged) why.push("(state)");
    for (
      let a = prev.dependencies?.firstContext, b = next.dependencies?.firstContext;
      a && b;
      a = a.next, b = b.next
    ) {
      if (!Object.is(a.memoizedValue, b.memoizedValue)) {
        why.push("(context)");
        break;
      }
    }

    return why.length > 0 ? why : ["(parent)"];
  };
  const mounted = (fiber: Fiber) => {
    if (COMPONENT_TAGS.has(fiber.tag)) entry(fiber).mounts++;
    for (let child = fiber.child; child; child = child.sibling) mounted(child);
  };
  // A subtree whose child list is the previous one's was not rendered in this commit.
  const updated = (next: Fiber, prev: Fiber) => {
    if (COMPONENT_TAGS.has(next.tag) && next.flags & PERFORMED_WORK) {
      const counted = entry(next);

      counted.updates++;
      for (const reason of reasons(prev, next))
        counted.why[reason] = (counted.why[reason] ?? 0) + 1;
    }
    if (next.child === prev.child) return;
    for (let child = next.child; child; child = child.sibling) {
      if (child.alternate) updated(child, child.alternate);
      else mounted(child);
    }
  };
  const renderers = new Map<number, unknown>();

  Object.assign(window, {
    __REACT_DEVTOOLS_GLOBAL_HOOK__: {
      supportsFiber: true,
      renderers,
      inject: (renderer: unknown) => renderers.set(renderers.size + 1, renderer).size,
      checkDCE: () => undefined,
      onCommitFiberUnmount: () => undefined,
      onPostCommitFiberRoot: () => undefined,
      onCommitFiberRoot: (_id: number, root: { containerInfo: unknown; current: Fiber }) => {
        // Next hydrates the document; its dev overlay is a root of its own.
        if (root.containerInfo !== document) return;
        commits++;
        lastCommit = performance.now();
        if (root.current.alternate) updated(root.current, root.current.alternate);
        else mounted(root.current);
      },
    },
    __renders: {
      idle: () => performance.now() - lastCommit,
      take: (): Taken => {
        const taken = { commits, components: [...counts.values()] };

        counts = new Map();
        commits = 0;

        return taken;
      },
    },
  });
}

// =============================================================================
// Pages and actions
// =============================================================================

type Tab = { context: BrowserContext; page: Page; pending: Set<unknown> };

/** A phone signed in with a session of its own, counting renders when `counted`. */
async function openTab(browser: Browser, counted: boolean): Promise<Tab> {
  const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: BASE });
  const cookies = await signIn(BASE, EMAIL, PASSWORD);

  await context.addCookies(cookies.map((cookie) => ({ ...cookie, url: BASE })));
  // tsx keeps function names with a helper the functions sent to the page still call.
  await context.addInitScript({ content: "globalThis.__name = (target) => target;" });
  const pending = new Set<unknown>();

  if (counted) {
    await context.addInitScript(countRenders);
    // tRPC responses and socket messages reach the page one at a time, a fixed time after they
    // were asked for or sent, so every run hears them in the same order and apart.
    let free = 0;
    const deliver = async (ready: number, send: () => unknown) => {
      const token = {};

      free = Math.max(ready, free + DELIVERY_GAP_MS);
      pending.add(token);
      await delay(free - Date.now());
      await send();
      pending.delete(token);
    };

    await context.route("**/api/trpc/**", async (route) => {
      const asked = Date.now();
      const response = await route.fetch();

      await deliver(asked + RESPONSE_DELAY_MS, () => route.fulfill({ response }));
    });
    await context.routeWebSocket(/\/trpc$/, (socket) => {
      socket.connectToServer().onMessage((message) => {
        void deliver(Date.now() + MESSAGE_DELAY_MS, () => socket.send(message));
      });
    });
  }
  const page = await context.newPage();

  page.on("request", (request) => pending.add(request));
  page.on("requestfinished", (request) => pending.delete(request));
  page.on("requestfailed", (request) => pending.delete(request));

  return { context, page, pending };
}

/** Waits until no request is open and React has been idle for `QUIET_MS`. */
async function settle({ page, pending }: Tab) {
  while (
    pending.size > 0 ||
    (await page.evaluate(() => (window as unknown as Renders).__renders.idle())) < QUIET_MS
  ) {
    await page.waitForTimeout(100);
  }
}

/** Renders from `act` until the page settles. */
async function measure(tab: Tab, action: string, act: () => Promise<void>) {
  await settle(tab);
  await tab.page.evaluate(() => (window as unknown as Renders).__renders.take());
  await act();
  await settle(tab);

  return {
    action,
    ...(await tab.page.evaluate(() => (window as unknown as Renders).__renders.take())),
  };
}

// =============================================================================
// The groceries scenario and its data set
// =============================================================================

type Line = {
  name: string;
  amount?: number;
  unit?: string;
  done?: boolean;
  aisle?: string;
  price?: number;
};

const STORES: Array<{ name: string; color: string; aisles: string[]; lines: Line[] }> = [
  {
    name: "Albert Heijn",
    color: "sky",
    aisles: ["Produce", "Dairy", "Bakery"],
    lines: [
      { name: "bananas", amount: 6, aisle: "Produce", price: 1.29 },
      { name: "tomatoes", amount: 500, unit: "gram", aisle: "Produce", price: 1.99 },
      { name: "cucumber", amount: 1, aisle: "Produce" },
      { name: "spinach", amount: 300, unit: "gram", aisle: "Produce", done: true },
      { name: "yoghurt", amount: 1, unit: "liter", aisle: "Dairy", price: 1.49 },
      { name: "butter", amount: 250, unit: "gram", aisle: "Dairy", price: 2.79 },
      { name: "cheddar", amount: 200, unit: "gram", aisle: "Dairy" },
      { name: "sourdough bread", amount: 1, aisle: "Bakery", price: 3.19 },
      { name: "rice", amount: 1, unit: "kilogram" },
      { name: "olive oil", amount: 1, unit: "liter", done: true },
      { name: "pasta", amount: 500, unit: "gram" },
    ],
  },
  {
    name: "Lidl",
    color: "warning",
    aisles: ["Produce", "Frozen"],
    lines: [
      { name: "apples", amount: 1, unit: "kilogram", aisle: "Produce", price: 2.49 },
      { name: "carrots", amount: 1, unit: "kilogram", aisle: "Produce" },
      { name: "frozen peas", amount: 450, unit: "gram", aisle: "Frozen" },
      { name: "ice cream", amount: 1, aisle: "Frozen", done: true },
      { name: "toilet paper" },
      { name: "dish soap" },
      { name: "oat milk", amount: 2, unit: "liter" },
    ],
  },
  {
    name: "Butcher",
    color: "danger",
    aisles: [],
    lines: [
      { name: "minced beef", amount: 500, unit: "gram" },
      { name: "chicken thighs", amount: 600, unit: "gram" },
      { name: "bacon", amount: 150, unit: "gram", done: true },
    ],
  },
  {
    name: "Farmers market",
    color: "success",
    aisles: [],
    lines: [
      { name: "strawberries", amount: 500, unit: "gram" },
      { name: "honey" },
      { name: "leeks", amount: 2 },
    ],
  },
];
const NO_STORE: Line[] = [
  { name: "batteries" },
  { name: "birthday candles" },
  { name: "lemons", amount: 3 },
  { name: "garlic", amount: 1 },
];
const RECURRING = [
  { name: "milk", amount: 2, unit: "liter", store: "Albert Heijn", rule: "week" },
  { name: "coffee beans", amount: 1, unit: "kilogram", store: "Albert Heijn", rule: "month" },
  { name: "eggs", amount: 12, unit: null, store: "Farmers market", rule: "week" },
  { name: "bin bags", amount: null, unit: null, store: "Lidl", rule: "month" },
];
// Every line of these recipes is on the list, as "Add to groceries" puts it there.
const RECIPES: Array<{ name: string; lines: Line[] }> = [
  {
    name: "Spaghetti bolognese",
    lines: [
      { name: "spaghetti", amount: 400, unit: "gram" },
      { name: "minced beef", amount: 500, unit: "gram" },
      { name: "onion", amount: 1 },
      { name: "garlic", amount: 2, unit: "clove" },
      { name: "passata", amount: 700, unit: "gram" },
    ],
  },
  {
    name: "Green curry",
    lines: [
      { name: "coconut milk", amount: 400, unit: "milliliter" },
      { name: "green curry paste", amount: 2, unit: "tablespoon" },
      { name: "chicken thighs", amount: 500, unit: "gram" },
      { name: "jasmine rice", amount: 300, unit: "gram" },
      { name: "lime", amount: 1 },
    ],
  },
  {
    name: "Pancakes",
    lines: [
      { name: "flour", amount: 250, unit: "gram" },
      { name: "milk", amount: 500, unit: "milliliter" },
      { name: "eggs", amount: 2 },
    ],
  },
];
const ADDED = "paprika";

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));
}

/** Reads until `done` holds, for the writes that land after their mutation answers. */
async function until<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  for (const deadline = Date.now() + 30_000; Date.now() < deadline;) {
    const value = await read().catch(() => null);

    if (value !== null && done(value)) return value;
    await delay(200);
  }
  throw new Error("Timed out waiting for a write to land");
}

/**
 * Brings the account's list back to the data set through the API: its groceries are replaced,
 * while stores (with their prices and aisles) and recipes are made once and kept.
 */
async function resetGroceries(cookie: string) {
  const call = <T>(procedure: string, input?: unknown, mutation = false) =>
    callTrpc<T>(BASE, cookie, procedure, input, mutation);
  type Listed = {
    groceries: Array<{
      id: string;
      name: string | null;
      version: number;
      storeId: string | null;
      sortOrder: number;
    }>;
    recurringGroceries: Array<{ id: string; version: number }>;
  };
  const known = new Set(
    [
      ...STORES.flatMap((store) => store.lines),
      ...NO_STORE,
      ...RECURRING,
      ...RECIPES.flatMap((recipe) => recipe.lines),
    ]
      .map((line) => line.name)
      .concat(ADDED)
  );
  const listed = await call<Listed>("groceries.list");
  const foreign = listed.groceries.find((grocery) => !known.has(grocery.name ?? ""));

  if (foreign)
    throw new Error(`"${foreign.name}" is not in the data set: use a measurement account`);
  if (listed.groceries.length > 0) {
    await call(
      "groceries.delete",
      { groceries: listed.groceries.map(({ id, version }) => ({ id, version })) },
      true
    );
  }
  for (const { id, version } of listed.recurringGroceries) {
    await call("groceries.deleteRecurring", { recurringGroceryId: id, version }, true);
  }
  // A recurring grocery is deleted after its mutation answers.
  await until(
    () => call<Listed>("groceries.list"),
    (left) => left.groceries.length + left.recurringGroceries.length === 0
  );

  const stores =
    await call<Array<{ id: string; name: string; aisles: Array<{ id: string; name: string }> }>>(
      "stores.list"
    );
  const made: string[] = [];

  for (const { name, color, aisles } of STORES) {
    if (stores.some((store) => store.name === name)) continue;
    const aisleRows = aisles.map((aisle) => ({ id: randomUUID(), name: aisle }));
    const id = await call<string>(
      "stores.create",
      { id: randomUUID(), name, color, aisles: aisleRows },
      true
    );

    stores.push({ id, name, aisles: aisleRows });
    made.push(name);
  }
  const storeId = (name: string) => stores.find((store) => store.name === name)!.id;
  const row = (line: Line, store: string | null, recipeIngredientId: string | null = null) => ({
    id: randomUUID(),
    name: line.name,
    amount: line.amount ?? null,
    unit: line.unit ?? null,
    isDone: line.done ?? false,
    storeId: store && storeId(store),
    recipeIngredientId,
  });

  await call(
    "groceries.create",
    [
      ...STORES.flatMap((store) => store.lines.map((line) => row(line, store.name))),
      ...NO_STORE.map((line) => row(line, null)),
    ],
    true
  );
  for (const { store, rule, ...line } of RECURRING) {
    await call(
      "groceries.createRecurring",
      {
        ...line,
        id: randomUUID(),
        recurrenceRule: rule,
        recurrenceInterval: 1,
        recurrenceWeekday: null,
        nextPlannedFor: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
        storeId: storeId(store),
      },
      true
    );
  }

  const library = await call<{ items: Array<{ recipe?: { id: string; name: string } }> }>(
    "library.list",
    { limit: 50 }
  );

  for (const recipe of RECIPES) {
    const id =
      library.items.find((item) => item.recipe?.name === recipe.name)?.recipe?.id ??
      (await call<string>(
        "recipes.create",
        {
          name: recipe.name,
          systemUsed: "metric",
          servings: 2,
          recipeIngredients: recipe.lines.map((line, order) => ({
            ingredientName: line.name,
            ingredientId: null,
            amount: line.amount ?? null,
            unit: line.unit ?? null,
            order,
          })),
          steps: [],
          tags: [],
          cuisines: [],
          categories: [],
          images: [],
          videos: [],
        },
        true
      ));
    // A recipe is written after its create answers.
    const { recipeIngredients } = await until(
      () =>
        call<{ recipeIngredients: Array<{ id: string; ingredientName: string }> }>("recipes.get", {
          id,
        }),
      () => true
    );

    await call(
      "groceries.create",
      recipe.lines.map((line) =>
        row(
          line,
          null,
          recipeIngredients.find((ingredient) => ingredient.ingredientName === line.name)!.id
        )
      ),
      true
    );
  }

  // Prices and aisles are kept per Store and food, so a Store made now gets them once.
  for (const store of STORES.filter(({ name }) => made.includes(name))) {
    const { id, aisles } = stores.find(({ name }) => name === store.name)!;

    for (const line of store.lines) {
      if (line.price !== undefined) {
        await call(
          "stores.chooseProduct",
          {
            storeId: id,
            name: line.name,
            choice: {
              kind: "manual",
              id: randomUUID(),
              name: line.name,
              price: line.price,
              currency: "EUR",
            },
          },
          true
        );
      }
      if (line.aisle) {
        const aisleId = aisles.find(({ name }) => name === line.aisle)!.id;

        await call("stores.fileGroceryName", { storeId: id, name: line.name, aisleId }, true);
      }
    }
  }

  // The server orders the list by sortOrder alone, so Stores' equal ones would come back in any
  // order: each Store's groceries are moved to a range of their own.
  const { groceries } = await call<Listed>("groceries.list");
  const updates = [...STORES.map(({ name }) => storeId(name)), null].flatMap((id, index) =>
    groceries
      .filter((grocery) => grocery.storeId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ id, version }, position) => ({ id, version, sortOrder: index * 100 + position }))
  );

  await call("groceries.reorderInStore", { updates, savePreference: false }, true);
  await until(
    () => call<Listed>("groceries.list"),
    (after) =>
      after.groceries.every(
        (grocery) => updates.find(({ id }) => id === grocery.id)?.sortOrder === grocery.sortOrder
      )
  );
}

function rowFor(page: Page, name: string) {
  return page.locator(`[data-grocery-name="${name}"]:visible`).first();
}

async function openGroceries(tab: Tab) {
  await tab.page.goto("/groceries");
  await rowFor(tab.page, "cucumber").waitFor();
}

async function chooseView(tab: Tab, view: "By Store" | "By Recipe") {
  await tab.page.getByRole("button", { name: "View Mode" }).click();
  await tab.page.getByRole("menuitem", { name: view }).click();
  await tab.page
    .locator(`[data-grocery-view="${view === "By Store" ? "store" : "recipe"}"]`)
    .first()
    .waitFor();
}

async function groceries(browser: Browser) {
  const cookies = await signIn(BASE, EMAIL, PASSWORD);

  await resetGroceries(cookies.map(({ name, value }) => `${name}=${value}`).join("; "));
  const tab = await openTab(browser, true);
  const other = await openTab(browser, false);

  try {
    await openGroceries(tab);
    await openGroceries(other);
    await settle(tab);
    if (
      (await tab.page.locator("[data-grocery-view]").first().getAttribute("data-grocery-view")) !==
      "store"
    ) {
      await chooseView(tab, "By Store");
    }
    const { page } = tab;
    const results: Array<Taken & { action: string }> = [];

    results.push(
      await measure(tab, "check an item", async () => {
        await rowFor(page, "cucumber").locator('[data-slot="checkbox"]').first().click();
        // A checked grocery moves into its Store's folded "done" rows.
        await rowFor(page, "cucumber").waitFor({ state: "detached" });
      })
    );

    await page.getByRole("button", { name: "Add Item" }).click();
    await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(ADDED);
    results.push(
      await measure(tab, "add an item", async () => {
        await page.getByRole("button", { name: "Add", exact: true }).click();
        await rowFor(page, ADDED).waitFor();
      })
    );
    await page.getByRole("button", { name: "Close panel" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    results.push(
      await measure(tab, "open the edit panel", async () => {
        await rowFor(page, "tomatoes")
          .getByRole("button", { name: /tomatoes/ })
          .click();
        await page.getByRole("dialog").waitFor();
      })
    );
    await page.getByRole("button", { name: "Close panel" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    results.push(
      await measure(tab, "realtime echo of another browser checking an item", async () => {
        await rowFor(other.page, "carrots").locator('[data-slot="checkbox"]').first().click();
        await rowFor(page, "carrots").waitFor({ state: "detached" });
      })
    );

    await page.getByRole("button", { name: "View Mode" }).click();
    results.push(
      await measure(tab, "switch the view mode", async () => {
        await page.getByRole("menuitem", { name: "By Recipe" }).click();
        await page.locator('[data-grocery-view="recipe"]').first().waitFor();
      })
    );
    await chooseView(tab, "By Store");
    await settle(tab);

    return results;
  } finally {
    await Promise.all([tab.context.close(), other.context.close()]);
  }
}

// =============================================================================
// The report
// =============================================================================

const SCENARIOS = { groceries };

function isScenario(name: string | undefined): name is keyof typeof SCENARIOS {
  return name !== undefined && name in SCENARIOS;
}

if (!isScenario(scenarioName))
  throw new Error(`Name a scenario: ${Object.keys(SCENARIOS).join(", ")}`);

const browser = await chromium.launch();
const lines: string[] = [];

try {
  // A first pass off the record, so every chunk the actions load is compiled.
  await SCENARIOS[scenarioName](browser);
  for (const { action, commits, components } of await SCENARIOS[scenarioName](browser)) {
    const sum = (key: "mounts" | "updates") =>
      components.reduce((total, row) => total + row[key], 0);

    lines.push(
      `### ${action}: ${sum("mounts")} mounts, ${sum("updates")} updates, ${commits} commits`,
      "",
      "| Component | Mounts | Updates | Changed |",
      "| --------- | -----: | ------: | ------- |",
      ...components
        .sort((a, b) => b.mounts + b.updates - a.mounts - a.updates || a.name.localeCompare(b.name))
        .map(({ name, mounts, updates, why }) => {
          const changed = Object.entries(why)
            .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
            .map(([reason, count]) => `${reason} ${count}`)
            .join(", ");

          return `| ${name} | ${mounts} | ${updates} | ${changed} |`;
        }),
      ""
    );
  }
} finally {
  await browser.close();
}

process.stdout.write(`${lines.join("\n")}\n`);
process.exit(0);
