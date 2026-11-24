import { describe, expect, it } from "vitest";

import { replacesCached } from "../use-recipes-cache";

describe("replacesCached", () => {
  it("writes an event over nothing, an older or the same version, never a newer one", () => {
    expect(replacesCached({ version: 2 }, undefined)).toBe(true);
    expect(replacesCached({ version: 2 }, { version: 1 })).toBe(true);
    expect(replacesCached({ version: 2 }, { version: 2 })).toBe(true);
    expect(replacesCached({ version: 2 }, { version: 3 })).toBe(false);
  });

  it("counts a cached recipe with no version, persisted before versions, as older", () => {
    expect(replacesCached({ version: 1 }, {})).toBe(true);
  });
});
