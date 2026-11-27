// @vitest-environment node
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { describe, expect, it, vi } from "vitest";

import { HOUSEHOLD_HEADER } from "@norish/shared/lib/trpc-errors";

import { createMockUser } from "./recipes/test-utils";

vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: vi.fn().mockResolvedValue(null),
}));

const { authedProcedure } = await import("../src/middleware");
const { router } = await import("../src/trpc");

const write = vi.fn(async () => "written");
const appRouter = router({ write: authedProcedure.mutation(write) });

/** A write through the real handler, the caller in "current", naming `named` in its header. */
async function send(named: string | null) {
  write.mockClear();
  const headers = new Headers({ "content-type": "application/json" });

  if (named) headers.set(HOUSEHOLD_HEADER, named);
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request("http://localhost/api/trpc/write", {
      method: "POST",
      headers,
      body: JSON.stringify(superjson.serialize(undefined)),
    }),
    router: appRouter,
    createContext: ({ req }) => ({
      user: createMockUser(),
      household: { id: "current", name: "Home", users: [] },
      connectionId: null,
      operationId: null,
      writeHousehold: req.headers.get(HOUSEHOLD_HEADER),
    }),
  });

  return { status: response.status, body: (await response.json()) as Record<string, never> };
}

describe("a write naming its household", () => {
  it("is served when it names the caller's household", async () => {
    const { status } = await send("current");

    expect(status).toBe(200);
    expect(write).toHaveBeenCalledOnce();
  });

  it("is refused, unapplied and marked, when it names another household", async () => {
    const { status, body } = await send("former");

    expect(status).toBe(412);
    expect(write).not.toHaveBeenCalled();
    expect(body).toMatchObject({ error: { json: { data: { otherHousehold: true } } } });
  });

  it("is served as before when it names none", async () => {
    const { status } = await send(null);

    expect(status).toBe(200);
    expect(write).toHaveBeenCalledOnce();
  });
});
