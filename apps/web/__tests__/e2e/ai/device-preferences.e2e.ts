/**
 * Changing Device Preferences from Settings.
 *
 * Writes go out one at a time. Each one is held on the wire until the test
 * lets it go, so the queue the reader builds by clicking quickly is the same
 * on every run.
 */
import type { Route } from "@playwright/test";

import { clearDevicePreferences, readProfilePreferences } from "../harness/device-preferences";
import { databaseUrl } from "./database";
import { expect, test } from "./fixture";

test.beforeEach(async () => {
  await clearDevicePreferences(databaseUrl());
});

test("quick Hidden Items changes all land, and none drops out while the next is queued", async ({
  aiStack,
  page,
}) => {
  const held: Route[] = [];

  await page.route("**/api/trpc/user.setDevicePreferences*", (route) => {
    held.push(route);
  });
  await page.goto("/settings?tab=user");

  await page.getByRole("button", { name: /Hidden items/ }).click();
  const option = (name: string) => page.getByRole("option", { name, exact: true });

  await option("Ratings").click();
  await expect.poll(() => held.length).toBe(1);
  // Queued behind the first: it goes out only once that one has landed.
  await option("Nutrition").click();
  await expect(option("Nutrition")).toHaveAttribute("aria-selected", "true");

  await held[0]!.continue();
  await expect.poll(() => held.length).toBe(2);
  // The first write has landed and the second is on the wire: the server
  // knows only Ratings, but Nutrition is still what the reader chose.
  await expect(option("Nutrition")).toHaveAttribute("aria-selected", "true");

  await option("Notes").click();
  await held[1]!.continue();
  await expect.poll(() => held.length).toBe(3);
  await held[2]!.continue();

  await expect
    .poll(async () => {
      const stored = await readProfilePreferences(aiStack.baseURL, aiStack.ownerCookies);

      return [...((stored.desktop as { hiddenItems?: string[] })?.hiddenItems ?? [])].sort();
    })
    .toEqual(["notes", "nutrition", "rating"]);
});
