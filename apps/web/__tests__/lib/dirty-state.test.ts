import { isDirtyState } from "@/lib/dirty-state";
import { describe, expect, it } from "vitest";

describe("isDirtyState", () => {
  it("returns false when values are identical", () => {
    expect(isDirtyState({ a: 1, b: ["x", "y"] }, { a: 1, b: ["x", "y"] })).toBe(false);
  });

  it("returns true when nested values differ", () => {
    expect(isDirtyState({ a: 1, b: ["x", "z"] }, { a: 1, b: ["x", "y"] })).toBe(true);
  });

  it("supports normalization for semantic equality", () => {
    const dirty = isDirtyState(
      { scopes: "openid,profile, email" },
      { scopes: ["openid", "profile", "email"] },
      {
        normalizeCurrent: (current) => ({
          scopes: current.scopes
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
        normalizeInitial: (initial) => ({
          scopes: initial.scopes,
        }),
      }
    );

    expect(dirty).toBe(false);
  });

  it("supports custom equality functions", () => {
    const dirty = isDirtyState(
      { locale: "EN-us" },
      { locale: "en-US" },
      {
        isEqual: (left, right) => {
          const current = left as { locale: string };
          const initial = right as { locale: string };

          return current.locale.toLowerCase() === initial.locale.toLowerCase();
        },
      }
    );

    expect(dirty).toBe(false);
  });
});
