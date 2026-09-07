import type { Locator, Page } from "@playwright/test";

/**
 * Move a grocery's row onto a drop target the way a shopper does: pick up its
 * drag handle, travel to the target and let go. dnd-kit marks its own
 * activator, which sits inside the row in the grouped list and just outside
 * it in the plain one.
 */
export async function dragRowTo(page: Page, row: Locator, target: Locator): Promise<void> {
  const inside = row.locator("button[aria-roledescription]");
  const handle =
    (await inside.count()) > 0
      ? inside.first()
      : row.locator("xpath=..").locator("button[aria-roledescription]").first();

  // Both ends of the drag have to be on screen at once for the pointer to
  // travel between them, and a list can be longer than the default viewport.
  await page.setViewportSize({ width: 1280, height: 1600 });
  await handle.scrollIntoViewIfNeeded();

  const from = await handle.boundingBox();
  const to = await target.boundingBox();

  if (!from || !to) throw new Error("The row or the drop target is not on screen");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // dnd-kit's pointer sensor waits for 8px before it calls this a drag.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 20, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 25 });
  await page.waitForTimeout(200);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 6, { steps: 5 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(300);
}
