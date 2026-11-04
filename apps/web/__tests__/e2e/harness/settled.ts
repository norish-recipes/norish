import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * What `read` returns once it has held still for three frames. A click retried
 * on a moving target scrolls it to the top, and a scroll closes what it sits in.
 */
export async function settled<T>(
  page: Page,
  read: () => Promise<T | null | undefined>
): Promise<T> {
  let last = "";
  let value: T | null | undefined;
  let still = 0;

  await expect
    .poll(async () => {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      value = await read();
      const seen = JSON.stringify(value ?? null);

      still = value != null && seen === last ? still + 1 : 0;
      last = seen;

      return still;
    })
    .toBeGreaterThanOrEqual(3);

  return value as T;
}
