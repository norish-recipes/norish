/** A cookbook created while Offline is queued as one write that carries its recipes, and replays with them. */

import { act, renderHook } from "@testing-library/react";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { createOutboxLink } from "../../offline/outbox-link";
import { createOutboxStore } from "../../offline/outbox-store";
import { runReplayPass } from "../../offline/replay";
import { replayOutboxEntry } from "../../offline/replay-client";
import { createMemoryStorage } from "../../offline/testing/memory-storage";
import { useCookbooksMutations } from "../use-cookbooks-mutations";

const proxy = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("../../trpc", () => ({ useTRPC: () => proxy.current }));
vi.mock("../../reader", () => ({ useReader: () => ({ user: { id: "reader-1" } }) }));

describe("a cookbook created Offline", () => {
  it("queues one create holding the picked recipes, and replays it with them", async () => {
    const queryClient = createTestQueryClient();
    const store = createOutboxStore(createMemoryStorage().outbox);

    proxy.current = createTRPCOptionsProxy<AppRouter>({
      client: createTRPCClient<AppRouter>({
        links: [
          createOutboxLink<AppRouter>({
            store,
            owner: () => "reader-1",
            replayHeaderValue: "test-outbox",
          }),
          // The server cannot be reached.
          () => () => observable((observer) => observer.error(new TypeError("Failed to fetch"))),
        ],
      }),
      queryClient,
    });

    const { result } = renderHook(() => useCookbooksMutations(), {
      wrapper: createTestWrapper(queryClient),
    });
    let id: string | undefined;

    await act(async () => {
      id = await result.current.createCookbook({ title: "Soups", recipeIds: ["r1", "r2"] });
    });

    const queued = await store.forOwner("reader-1");

    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      path: "cookbooks.create",
      entityId: id,
      input: { id, title: "Soups", recipeIds: ["r1", "r2"] },
    });

    // The server is back: the stored entry goes out as it was queued.
    const create = vi.fn(async () => ({}));
    const client = { cookbooks: { create: { mutate: create } } };

    await runReplayPass({
      store,
      ownerId: "reader-1",
      submit: (entry) => replayOutboxEntry(client, entry, "test-outbox"),
    });

    expect(create).toHaveBeenCalledExactlyOnceWith(
      { id, title: "Soups", recipeIds: ["r1", "r2"] },
      expect.anything()
    );
    expect(await store.size("reader-1")).toBe(0);
  });
});
