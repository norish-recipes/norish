import { createTRPCClient } from "@trpc/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";
import { HOUSEHOLD_HEADER } from "@norish/shared/lib/trpc-errors";

import { createTRPCClientLinks } from "./trpc-links";

const logger = { info: () => {}, warn: () => {}, debug: () => {} };

afterEach(() => vi.unstubAllGlobals());

describe("the HTTP transport", () => {
  it("sends writes of different households in requests of their own", async () => {
    const sent: { url: string; household: string | null }[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        sent.push({ url, household: new Headers(init.headers).get(HOUSEHOLD_HEADER) });

        return new Response(JSON.stringify({ result: { data: { json: null } } }), {
          headers: { "content-type": "application/json" },
        });
      })
    );
    const client = createTRPCClient<AppRouter>({
      links: createTRPCClientLinks<AppRouter>({
        logger,
        getBaseUrl: () => "http://norish.test",
        includeSubscriptions: false,
        enableLoggerLink: false,
      }),
    });
    const named = (household: string) => ({
      context: { headers: { [HOUSEHOLD_HEADER]: household } },
    });

    await Promise.all([
      client.groceries.delete.mutate({ groceries: [] }, named("former")),
      client.groceries.delete.mutate({ groceries: [] }, named("current")),
    ]);

    expect(sent.map((request) => request.household).sort()).toEqual(["current", "former"]);
    expect(sent.every((request) => !request.url.includes(","))).toBe(true);
  });
});
