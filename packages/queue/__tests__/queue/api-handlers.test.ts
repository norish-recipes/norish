// @vitest-environment node
/**
 * The queue's API handlers registered as a loader: nothing loads until a job asks for one,
 * and lookups that arrive together load it once.
 */
import { afterEach, expect, it, vi } from "vitest";

import {
  registerQueueApiHandlers,
  requireQueueApiHandler,
  resetQueueApiHandlersForTests,
} from "../../src/api-handlers";

afterEach(() => resetQueueApiHandlersForTests());

it("loads the handlers on the first lookup, once for lookups that arrive together", async () => {
  const parseTags = vi.fn(() => [{ name: "soup" }]);
  const load = vi.fn(async () => ({ parseTags }));

  registerQueueApiHandlers(load);
  expect(load).not.toHaveBeenCalled();

  const [first, second] = await Promise.all([
    requireQueueApiHandler("parseTags"),
    requireQueueApiHandler("parseTags"),
  ]);

  expect(load).toHaveBeenCalledOnce();
  expect(first).toBe(parseTags);
  expect(second).toBe(parseTags);
});

it("refuses a handler the loaded set lacks", async () => {
  registerQueueApiHandlers(async () => ({}));

  await expect(requireQueueApiHandler("parseTags")).rejects.toThrow(
    "Queue API handler not registered: parseTags"
  );
});
