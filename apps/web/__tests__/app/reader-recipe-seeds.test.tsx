// @vitest-environment node
/**
 * Each layout seeds what its screens draw. The Reader's favourites, household and allergies come
 * with the Library's and the recipe page's full loads, through one helper; the imports still
 * running with the dashboard's.
 */
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";

type Reads = (trpc: unknown, client: unknown) => unknown[] | Promise<unknown[]>;

/** The reads the QuerySeed a layout rendered was asked for. */
const seed = vi.hoisted(() => ({ reads: undefined as Reads | undefined }));

vi.mock("@/components/query-seed", () => ({
  QuerySeed: ({ reads, children }: { reads: Reads; children: ReactNode }) => {
    seed.reads = reads;

    return children;
  },
}));
vi.mock("@/features/library/library-root", () => ({
  LibraryRoot: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/recipe-filters-server", () => ({
  readRecipeFilters: async () => undefined,
  readRecipeQueryFilters: async () => undefined,
}));
vi.mock("@/lib/reader-today-server", () => ({ readReaderToday: async () => "2026-11-10" }));
vi.mock("@/lib/request-profile", () => ({
  readRequestProfile: async () => ({
    kind: "phone",
    preferences: { phone: DEVICE_PREFERENCE_DEFAULTS, desktop: DEVICE_PREFERENCE_DEFAULTS },
  }),
}));

const { default: LibraryLayout } = await import("@/app/(app)/(library)/layout");
const { default: DashboardLayout } = await import("@/app/(app)/(library)/(dashboard)/layout");
const { default: RecipeLayout } = await import("@/app/(app)/recipes/[id]/layout");

/** A tRPC proxy whose `queryOptions` names its procedure. */
function procedures(path: string[] = []): unknown {
  return new Proxy(
    {},
    {
      get: (_, key) =>
        key === "queryOptions" || key === "infiniteQueryOptions"
          ? () => ({ path: path.join(".") })
          : procedures([...path, String(key)]),
    }
  );
}

/** The procedures the layout's seed reads. */
async function seededBy(layout: ReactNode | Promise<ReactNode>) {
  const reads: string[] = [];
  const client = {
    query: async ({ path }: { path: string }) => reads.push(path),
    infiniteQuery: async ({ path }: { path: string }) => reads.push(path),
  };

  renderToString(await layout);
  await Promise.all((await seed.reads?.(procedures(), client)) ?? []);

  return reads.sort();
}

const READER = ["favorites.list", "households.get", "user.getAllergies"];

describe("the layouts' seeds", () => {
  beforeEach(() => {
    seed.reads = undefined;
  });

  it("the Library's carries the Reader's favourites, household and allergies", async () => {
    expect(await seededBy(LibraryLayout({ children: null, params: Promise.resolve({}) }))).toEqual(
      READER
    );
  });

  it("the dashboard's carries the imports still running, not the Reader's", async () => {
    const reads = await seededBy(DashboardLayout({ children: null, params: Promise.resolve({}) }));

    expect(reads).toContain("recipes.getPending");
    expect(reads.filter((read) => READER.includes(read))).toEqual([]);
  });

  it("the recipe page's carries them beside the recipe", async () => {
    const reads = await seededBy(
      RecipeLayout({ children: null, params: Promise.resolve({ id: "r1" }) })
    );

    expect(reads).toEqual(expect.arrayContaining([...READER, "recipes.get"]));
  });
});
