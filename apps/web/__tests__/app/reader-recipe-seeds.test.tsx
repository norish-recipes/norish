// @vitest-environment node
/**
 * Each layout seeds what its screens draw: the shell its own reads, the Library and the recipe
 * page the Reader's favourites, household and allergies, the dashboard the running imports.
 */
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";

/** A layout's seed as this test calls it: over a stand-in proxy and client. */
type Reads = (trpc: unknown, client: unknown) => unknown[] | Promise<unknown[]>;

/** The reads the QuerySeed a layout rendered was asked for. */
const seed = vi.hoisted(() => ({ reads: undefined as Reads | undefined }));

vi.mock("@/components/query-seed", () => ({
  QuerySeed: ({ reads, children }: { reads: Reads; children: ReactNode }) => {
    seed.reads = reads;

    return children;
  },
  readQuerySeed: async (reads: Reads) => {
    seed.reads = reads;
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/app/(app)/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => children,
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
    identity: { id: "u1", email: "a@b.c", name: "A", image: null, version: 1 },
    kind: "phone",
    preferences: { phone: DEVICE_PREFERENCE_DEFAULTS, desktop: DEVICE_PREFERENCE_DEFAULTS },
  }),
}));

const { default: AppLayout } = await import("@/app/(app)/layout");
const { default: LibraryLayout } = await import("@/app/(app)/(library)/layout");
const { default: DashboardLayout } = await import("@/app/(app)/(library)/(dashboard)/layout");
const { default: RecipeLayout } = await import("@/app/(app)/recipes/[id]/layout");

/** A tRPC proxy whose `queryOptions` names its procedure. */
function procedures(path: string[] = []): unknown {
  return new Proxy(
    {},
    {
      get: (_, key) =>
        key === "queryOptions" || key === "infiniteQueryOptions" || key === "queryKey"
          ? () => ({ path: path.join(".") })
          : procedures([...path, String(key)]),
    }
  );
}

/** The procedures the layout's seed reads, or writes from what the request already read. */
async function seededBy(layout: ReactNode | Promise<ReactNode>) {
  const reads: string[] = [];
  const client = {
    query: async ({ path }: { path: string }) => reads.push(path),
    infiniteQuery: async ({ path }: { path: string }) => reads.push(path),
    setQueryData: ({ path }: { path: string }) => reads.push(path),
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

  it("the app's carries only permissions and Device Preferences, which the shell draws", async () => {
    expect(await seededBy(AppLayout({ children: null }))).toEqual([
      "permissions.get",
      "user.getDevicePreferences",
    ]);
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
