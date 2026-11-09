// @vitest-environment node
/**
 * A full load of Groceries seeds only what the view it opens on draws. The layout isn't told its
 * path, so it reads the one the proxy forwards.
 */
import type { ReactNode } from "react";
import { DESTINATION_HEADER } from "@/lib/auth/login-redirect";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Reads = (trpc: unknown, client: unknown) => Promise<unknown>[];

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
/** The reads the QuerySeed the layout rendered was asked for. */
const seed = vi.hoisted(() => ({ reads: undefined as Reads | undefined }));

vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current }));
vi.mock("@/components/query-seed", () => ({
  QuerySeed: ({ reads, children }: { reads: Reads; children: ReactNode }) => {
    seed.reads = reads;

    return children;
  },
}));
vi.mock("@/features/groceries/groceries-root", () => ({ GroceriesRoot: () => null }));

const { default: GroceriesLayout } = await import("@/app/(app)/groceries/layout");

const ANSWERS: Record<string, unknown> = {
  "groceries.list": {
    groceries: [{ ingredientId: "b" }, { ingredientId: null }],
    recurringGroceries: [{ ingredientId: "a" }],
  },
  "pantry.list": [{ ingredientId: "c" }],
};

/** A tRPC proxy whose `queryOptions` names its procedure. */
function procedures(path: string[] = []): unknown {
  return new Proxy(
    {},
    {
      get: (_, key) =>
        key === "queryOptions"
          ? (input?: unknown) => ({ path: path.join("."), input })
          : procedures([...path, String(key)]),
    }
  );
}

/** The reads the layout seeds for a request on its way to `destination`. */
async function seededFor(destination: string | null) {
  requestHeaders.current = new Headers(destination ? { [DESTINATION_HEADER]: destination } : {});
  const reads: string[] = [];
  const client = {
    query: async ({ path, input }: { path: string; input?: unknown }) => {
      reads.push(input === undefined ? path : `${path} ${JSON.stringify(input)}`);

      return ANSWERS[path] ?? [];
    },
  };

  renderToString(await GroceriesLayout());
  await Promise.all(seed.reads?.(procedures(), client) ?? []);

  return reads.sort();
}

describe("the groceries layout", () => {
  beforeEach(() => {
    seed.reads = undefined;
  });

  const list = [
    "groceries.list",
    'ingredients.icons {"ids":["a","b"]}',
    "stores.aisleLinks",
    "stores.groceryPrices",
    "stores.list",
  ];

  it("seeds the list, its foods' icons, stores, prices and aisles for the list", async () => {
    expect(await seededFor("/groceries")).toEqual(list);
    // Without the proxy's header, a load opens on the list, as the root does.
    expect(await seededFor(null)).toEqual(list);
  });

  it("seeds the Pantry, its foods' icons, its suggestions and the list for the Pantry", async () => {
    expect(await seededFor("/groceries/pantry?q=oil")).toEqual([
      "groceries.list",
      'ingredients.icons {"ids":["c"]}',
      "pantry.list",
      "pantry.suggestions",
    ]);
  });
});
