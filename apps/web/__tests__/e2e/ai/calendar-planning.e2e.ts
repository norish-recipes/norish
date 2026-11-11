/**
 * Planning from the dashboard reaches the calendar page's own cached range
 * (issue #583).
 *
 * The calendar page's range is fetched when the page is visited and stays in
 * the cache — and in the persisted Offline Cache — while the user is on the
 * dashboard. A recipe planned there used to reach only the ranges with a
 * mounted subscription: the calendar page's range learned of it from nothing
 * but its next successful refetch, so a refetch that failed, or a range served
 * without one, showed a plan that was not there. The create's own result now
 * places the item in every cached range, so the calendar shows it even when
 * its refetch cannot be answered.
 */
import type { Locator, Page } from "@playwright/test";

import { dateKey, parseDateKey } from "@norish/shared/lib/helpers";

import { removePlans } from "../harness/plans";
import { fingerFor, glide } from "../harness/pointer";
import { settled } from "../harness/settled";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { seedRecipe } from "./cookbooks-support";
import { expect, test } from "./fixture";

test.describe.configure({ mode: "serial" });

const NAME = `Planned Stew ${Date.now()}`;

/**
 * Whether a calendar range in the persisted query cache in IndexedDB holds
 * `text` yet. Only the ranges count: a recipe's name is persisted with the
 * recipe lists long before the plan is.
 */
function persistedCalendarHolds(page: Page, text: string): Promise<boolean> {
  return page.evaluate(
    (wanted) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open("norish-offline");

        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const database = open.result;

          if (!database.objectStoreNames.contains("keyval")) {
            database.close();
            resolve(false);

            return;
          }

          const all = database.transaction("keyval").objectStore("keyval").getAll();

          all.onsuccess = () => {
            database.close();
            type Persisted = {
              clientState?: { queries?: { queryKey: unknown; state: { data: unknown } }[] };
            };
            const ranges = (all.result as Persisted[])
              .flatMap((client) => client?.clientState?.queries ?? [])
              .filter((query) => JSON.stringify(query.queryKey).includes("listItems"));

            resolve(ranges.some((query) => JSON.stringify(query.state.data).includes(wanted)));
          };
          all.onerror = () => {
            database.close();
            resolve(false);
          };
        };
      }),
    text
  );
}

async function visitCalendar(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Calendar" }).click();
  await page.waitForURL(/\/calendar/);
}

test("a recipe planned on the dashboard shows on the calendar page from the cache alone", async ({
  browser,
  aiStack,
}) => {
  // The service worker is bypassed on purpose: a page it controls fetches
  // through it, out of reach of the route below that has to fail the refetch.
  // The cache under test is the persisted query cache, which needs no worker.
  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const recipeId = await seedRecipe(NAME);
  const today = new Date().toLocaleDateString("en-CA");

  try {
    // Today's Dinner offers Add Recipe only while nothing is planned there.
    await removePlans(
      aiStack.baseURL,
      aiStack.ownerCookies,
      (plan) => plan.date === today && plan.slot === "Dinner"
    );
    await page.goto("/");
    await expect(page.locator("[data-recipe-card]").filter({ hasText: NAME })).toBeVisible();

    // The calendar page's range enters the cache on a first visit.
    await visitCalendar(page);
    await expect(
      page.getByRole("heading", { name: /calendar/i }).or(page.locator("main"))
    ).toBeVisible();
    await expect(page.getByText(NAME)).toHaveCount(0);

    // Back on the dashboard, today's dinner is planned through the Today section.
    await page.getByRole("link", { name: "Home" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await page.getByRole("button", { name: "Add Recipe Dinner" }).click();

    const dialog = page.getByRole("dialog");

    await expect(dialog).toBeVisible();
    await dialog.getByRole("button").filter({ hasText: NAME }).first().click();

    // Planning opens Add to Groceries for the recipe: After planning a recipe's
    // default. Closing it leaves the plan in place.
    const groceries = page.getByRole("dialog", { name: "Add to Groceries" });

    await expect(groceries).toBeVisible();
    await groceries.getByRole("button", { name: "Close panel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(NAME).first()).toBeVisible();

    // From here on the calendar range cannot be refetched: what the page shows
    // is what the cache holds.
    let refetches = 0;

    await page.route(
      (url) => url.pathname.includes("/api/trpc/") && url.pathname.includes("calendar.listItems"),
      (route) => {
        refetches += 1;
        void route.abort("failed");
      }
    );

    await visitCalendar(page);
    await expect(page.getByText(NAME).first()).toBeVisible();
    expect(refetches).toBeGreaterThan(0);

    // A reload restores the persisted cache: the plan is still there. The copy
    // in IndexedDB is written after the cache changes, and by this point in the
    // project it is large, so the reload waits until a range there holds the plan.
    await expect.poll(() => persistedCalendarHolds(page, NAME)).toBe(true);
    await page.reload();
    await expect(page.getByText(NAME).first()).toBeVisible();
  } finally {
    await context.close();
    await removePlans(aiStack.baseURL, aiStack.ownerCookies, (plan) => plan.recipeId === recipeId);
  }
});

function shiftDay(day: string, days: number): string {
  const date = parseDateKey(day);

  date.setDate(date.getDate() + days);

  return dateKey(date);
}

test("plans dragged out of one slot after a slot-mate's delete move there and stay after a reload", async ({
  browser,
  aiStack,
}) => {
  const across = `Dragged Stew ${Date.now()}`;
  const down = `Dropped Soup ${Date.now()}`;
  const gone = `Deleted Pie ${Date.now()}`;
  const ids = {
    [across]: await seedRecipe(across),
    [down]: await seedRecipe(down),
    [gone]: await seedRecipe(gone),
  };
  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const card = (day: string) => page.locator(`[data-day-key="${day}"]`);
  const rowOf = (day: string) => page.locator("[data-index]").filter({ has: card(day) });
  const plannedDate = async (recipeId: string) => {
    const items = await queryTrpc<Array<{ date: string; recipeId: string | null }>>(
      aiStack.baseURL,
      aiStack.ownerCookies,
      "calendar.listItems",
      { startISO: "2000-01-01", endISO: "2999-12-31" }
    );

    return items.find((item) => item.recipeId === recipeId)?.date;
  };
  const centre = (box: { x: number; y: number; width: number; height: number }) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  });

  // Centres both ends in their scroller: dnd-kit auto-scrolls a drag near its edge.
  async function bringIntoView(from: Locator, to: Locator) {
    const target = await to.elementHandle();

    await from.evaluate((source, other) => {
      let scroller = source.parentElement;

      const scrolls = (el: HTMLElement) =>
        /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight;

      while (scroller && !scrolls(scroller)) {
        scroller = scroller.parentElement;
      }
      const box = (scroller ?? document.documentElement).getBoundingClientRect();
      const viewportCentre = scroller ? box.top + box.height / 2 : window.innerHeight / 2;
      const [a, b] = [source.getBoundingClientRect(), other.getBoundingClientRect()];
      const pairCentre = (Math.min(a.top, b.top) + Math.max(a.bottom, b.bottom)) / 2;

      (scroller ?? window).scrollBy(0, pairCentre - viewportCentre);
    }, target);
  }

  // Both ends in view and settled first, so nothing scrolls between pointer down and up.
  async function drag(name: string, to: string) {
    const item = page.getByText(name);

    await bringIntoView(item, card(to));
    const start = centre(await settled(page, () => item.boundingBox()));
    const end = centre(await settled(page, () => card(to).boundingBox()));
    const lifted = { x: start.x + 12, y: start.y };
    const mouse = await fingerFor(page, "mouse");

    // The desktop pointer sensor starts a drag only after 8 px of movement.
    await mouse.down(start);
    await glide(page, mouse, start, lifted);
    await glide(page, mouse, lifted, end);
    // The answer carries the plan's new version, which its next drag sends.
    const answered = page.waitForResponse((response) =>
      response.url().includes("calendar.moveItem")
    );

    await mouse.up();
    await answered;
  }

  try {
    await page.goto("/calendar");
    // Today as the page reads it, once it has loaded, so a run across midnight agrees with it.
    const today = await page.evaluate(() => {
      const now = new Date();

      return [now.getFullYear(), now.getMonth(), now.getDate()] as const;
    });
    const todayKey = dateKey(new Date(...today));

    // One slot: a delete or move renumbers its slot-mates, whose next writes must still apply.
    for (const name of [across, down, gone]) {
      await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "calendar.createItem", {
        date: todayKey,
        slot: "Dinner",
        itemType: "recipe",
        recipeId: ids[name],
      });
    }
    await page.reload();
    for (const name of [across, down, gone]) {
      await expect(card(todayKey).getByText(name)).toBeVisible();
    }

    await card(todayKey).getByText(gone).click();
    const editor = page.getByRole("dialog", { name: "Edit Planned Recipe" });

    await editor.getByRole("button", { name: "Delete" }).click();
    // The closing drawer holds body at pointer-events: none until it has left.
    await expect(editor).toBeHidden();
    await expect(card(todayKey).getByText(gone)).toHaveCount(0);
    await expect.poll(() => plannedDate(ids[gone]!)).toBeUndefined();

    // Whatever the weekday: a neighbour in today's row, and the day under today in the next.
    const todayRow = await rowOf(todayKey).getAttribute("data-index");
    const after = shiftDay(todayKey, 1);
    const beside =
      (await rowOf(after).getAttribute("data-index")) === todayRow ? after : shiftDay(todayKey, -1);
    const rowLength = await rowOf(todayKey).locator("[data-day-key]").count();
    const below = shiftDay(todayKey, rowLength);
    const targets = { [across]: beside, [down]: below };

    for (const [name, day] of Object.entries(targets)) {
      await drag(name, day);
      await expect(card(day).getByText(name)).toBeVisible();
      await expect(card(todayKey).getByText(name)).toHaveCount(0);
      await expect.poll(() => plannedDate(ids[name]!)).toBe(day);
    }

    // The same plan again at once: its second write sends the version its first answered with.
    targets[across] = shiftDay(beside, rowLength);
    await drag(across, targets[across]);
    await expect(card(targets[across]).getByText(across)).toBeVisible();
    await expect(card(beside).getByText(across)).toHaveCount(0);
    await expect.poll(() => plannedDate(ids[across]!)).toBe(targets[across]);

    await page.reload();
    for (const [name, day] of Object.entries(targets)) {
      await expect(card(day).getByText(name)).toBeVisible();
    }
    await expect(card(todayKey).getByText(across)).toHaveCount(0);
    await expect(card(todayKey).getByText(down)).toHaveCount(0);
    await expect(page.getByText(gone)).toHaveCount(0);
  } finally {
    await context.close();
    // The drags leave the plans on other days, where a later spec's Today could draw them.
    await removePlans(aiStack.baseURL, aiStack.ownerCookies, (plan) =>
      Object.values(ids).includes(plan.recipeId ?? "")
    );
  }
});
