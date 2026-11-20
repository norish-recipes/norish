import { stringifyStored } from "@/lib/offline/stringify-stored";
import superjson from "superjson";
import { describe, expect, it } from "vitest";

const roundTrip = (value: unknown) => superjson.parse(stringifyStored(value));

describe("stringifyStored", () => {
  it("reads back through superjson as the value it was, Dates and undefined included", () => {
    const value = {
      queries: [
        {
          queryKey: [["library", "list"], { input: { limit: 100, search: undefined } }],
          state: {
            data: { pages: [{ items: [{ createdAt: new Date("2026-01-02T03:04:05.000Z") }] }] },
            pageParams: [undefined, 100],
          },
        },
      ],
      "a.key\\with dots": { at: new Date(0), gone: undefined },
      empty: {},
      none: null,
    };

    expect(roundTrip(value)).toStrictEqual(superjson.parse(superjson.stringify(value)));
    expect(roundTrip(value)).toStrictEqual(value);
  });

  it("hands anything but plain data to superjson", () => {
    const value = {
      tags: new Set(["soup"]),
      at: new Map([["k", 1]]),
      ratio: Number.NaN,
      drift: -0,
    };

    expect(stringifyStored(value)).toBe(superjson.stringify(value));
    expect(roundTrip(value)).toStrictEqual(value);
  });
});
