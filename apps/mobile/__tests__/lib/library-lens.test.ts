// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LibraryTypeFilter } from "@norish/shared/contracts";

const { useLibraryLens, useMarkLibraryLens } = await import("@/lib/library-lens");

describe("the library lens mark", () => {
  it("follows the lens the Library shows and falls back to All when it unmounts", () => {
    const reader = renderHook(() => useLibraryLens());
    const library = renderHook(({ type }) => useMarkLibraryLens(type), {
      initialProps: { type: "cookbooks" as LibraryTypeFilter },
    });

    expect(reader.result.current).toBe("cookbooks");
    library.rerender({ type: "recipes" });
    expect(reader.result.current).toBe("recipes");
    library.unmount();
    expect(reader.result.current).toBe("all");
  });
});
