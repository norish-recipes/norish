import type { Locator, Page } from "@playwright/test";

import { settled } from "./settled";

export type Pointer = "mouse" | "touch";
export type Point = { x: number; y: number };

/** A pointer that presses, moves and lets go: the mouse, or one finger. */
export interface Finger {
  down(at: Point): Promise<void>;
  move(to: Point): Promise<void>;
  up(): Promise<void>;
  release(): Promise<void>;
}

export async function fingerFor(page: Page, pointer: Pointer): Promise<Finger> {
  if (pointer === "mouse") {
    return {
      down: async (at) => {
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
      },
      move: (to) => page.mouse.move(to.x, to.y),
      up: () => page.mouse.up(),
      release: async () => {},
    };
  }

  // Chromium turns CDP touches into touch pointer events, as a phone sends them.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, at?: Point) =>
    cdp.send("Input.dispatchTouchEvent", {
      type: type as "touchStart" | "touchMove" | "touchEnd",
      touchPoints: at ? [{ x: at.x, y: at.y, id: 1 }] : [],
    });

  return {
    down: async (at) => void (await touch("touchStart", at)),
    move: async (to) => void (await touch("touchMove", to)),
    up: async () => void (await touch("touchEnd")),
    release: () => cdp.detach(),
  };
}

/**
 * Moves the pointer in small steps, a frame apart: motion reads each move
 * against the layout the last one left, so a row passes a neighbour only once
 * the list has redrawn.
 */
export async function glide(page: Page, finger: Finger, from: Point, to: Point): Promise<void> {
  const steps = 12;

  for (let step = 1; step <= steps; step++) {
    await finger.move({
      x: from.x + ((to.x - from.x) * step) / steps,
      y: from.y + ((to.y - from.y) * step) / steps,
    });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  }
}

/**
 * Swipe a recipe card open with a finger and press one of the actions beside it. The page needs
 * a touch screen (`hasTouch`).
 */
export async function swipeOpenTo(page: Page, card: Locator, actionName: string): Promise<void> {
  const box = (await card.boundingBox())!;
  const from = { x: box.x + box.width * 0.75, y: box.y + box.height / 2 };
  const finger = await fingerFor(page, "touch");

  try {
    await finger.down(from);
    await glide(page, finger, from, { x: from.x - 160, y: from.y });
    await finger.up();
  } finally {
    await finger.release();
  }
  // The actions sit beside the card in its swipable row, hidden until it opens.
  const action = page
    .getByRole("row")
    .filter({ has: card })
    .getByRole("button", { name: actionName });

  // A click retried on a moving button scrolls it to the top, and a scroll closes the row.
  await settled(page, () => action.boundingBox());
  await action.click();
}
