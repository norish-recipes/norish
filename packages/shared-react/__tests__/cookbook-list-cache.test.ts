/**
 * The membership panel's list is a cookbook list too.
 *
 * Leaving it out of the cookbook cache helpers is what made a cookbook made
 * from a recipe exist on the server and stay invisible in the panel that made
 * it, so this is the seam that keeps every cookbook list reachable by one
 * updater — a create, a rename and a delete alike.
 */
import { describe, expect, it } from "vitest";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import { applyCookbookUpdateToList } from "../src/hooks/library/library-cache";

function cookbook(id: string, title: string): CookbookSummaryDTO {
  return {
    id,
    userId: "reader",
    title,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    memberCount: 0,
    coverImages: [],
    memberTitles: [],
    memberTags: [],
    totalMinutes: null,
    minServings: null,
  };
}

const EXISTING = [cookbook("a", "Weeknights")];

describe("applyCookbookUpdateToList", () => {
  it("carries a newly created cookbook into the panel's list", () => {
    const made = cookbook("b", "Christmas");

    const next = applyCookbookUpdateToList(EXISTING, (previous) => {
      const [first, ...rest] = previous!.pages;

      return {
        ...previous!,
        pages: [{ ...first!, cookbooks: [made, ...first!.cookbooks] }, ...rest],
      };
    });

    expect(next?.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("carries a rename into the panel's list", () => {
    const next = applyCookbookUpdateToList(EXISTING, (previous) => ({
      ...previous!,
      pages: previous!.pages.map((page) => ({
        ...page,
        cookbooks: page.cookbooks.map((entry) =>
          entry.id === "a" ? { ...entry, title: "Weeknight favourites" } : entry
        ),
      })),
    }));

    expect(next?.[0]?.title).toBe("Weeknight favourites");
  });

  it("carries a delete into the panel's list", () => {
    const next = applyCookbookUpdateToList(EXISTING, (previous) => ({
      ...previous!,
      pages: previous!.pages.map((page) => ({
        ...page,
        cookbooks: page.cookbooks.filter((entry) => entry.id !== "a"),
      })),
    }));

    expect(next).toEqual([]);
  });

  it("leaves an uncached list alone rather than inventing one", () => {
    expect(applyCookbookUpdateToList(undefined, () => undefined)).toBeUndefined();
  });
});
