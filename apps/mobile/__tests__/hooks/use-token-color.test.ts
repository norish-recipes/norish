// @vitest-environment jsdom
import { useTokenColor } from "@/hooks/use-token-color";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// What the native stylesheet holds: the theme-scoped token, never Tailwind's `--color-` alias.
vi.mock("uniwind", () => ({
  useCSSVariable: (name: string) => ({ "--accent-text": "#76be86" })[name],
}));

describe("useTokenColor", () => {
  it("reads the theme-scoped token the native stylesheet keeps", () => {
    expect(renderHook(() => useTokenColor("accent-text")).result.current).toBe("#76be86");
  });

  it("answers undefined for a token the stylesheet lacks", () => {
    expect(renderHook(() => useTokenColor("missing")).result.current).toBeUndefined();
  });
});
