import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreDto } from "@norish/shared/contracts";
import { useStoresMutations } from "@norish/shared-react/groceries";

import { createTestQueryClient, createTestWrapper } from "./test-utils";

/** What each procedure is sent; a test answers or refuses it by its implementation. */
const sent = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  reorder: vi.fn(),
}));

vi.mock("../trpc", () => {
  /** A procedure's mutation options as tRPC builds them: the caller's own, and its send. */
  const procedure = (mutationFn: (input: unknown) => unknown) => ({
    mutationOptions: (options?: object) => ({ ...options, mutationFn }),
  });

  return {
    useTRPC: () => ({
      groceries: { list: { queryKey: () => ["groceries", "list"] } },
      stores: {
        list: { queryKey: () => ["stores", "list"] },
        create: procedure(sent.create),
        update: procedure(sent.update),
        delete: procedure(sent.delete),
        reorder: procedure(sent.reorder),
        checkSearchAddress: procedure(vi.fn()),
      },
    }),
  };
});

function store(id: string, version: number, sortOrder = 0): StoreDto {
  return {
    id,
    version,
    name: id,
    color: "primary",
    website: null,
    searchAddress: null,
    sortOrder,
    userId: "user-1",
    aisles: [],
  };
}

/** Answers the next send of a procedure when the test says, the way a slow server does. */
function answerLater(send: typeof sent.create) {
  const answer = Promise.withResolvers<unknown>();

  send.mockImplementationOnce(() => answer.promise);

  return answer;
}

describe("useStoresMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    for (const send of Object.values(sent)) send.mockReset();
    queryClient.setQueryData(["stores", "list"], [store("store-1", 6), store("store-2", 3, 1)]);
    queryClient.setQueryData(["groceries", "list"], {
      groceries: [
        { id: "g1", version: 2, storeId: "store-1" },
        { id: "g2", version: 5, storeId: "store-1" },
        { id: "g3", version: 1, storeId: "store-2" },
      ],
      recurringGroceries: [],
      recipeMap: {},
    });
  });

  const render = () =>
    renderHook(() => useStoresMutations(), { wrapper: createTestWrapper(queryClient) });
  const settled = () =>
    act(async () => {
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });
  const names = () =>
    queryClient.getQueryData<StoreDto[]>(["stores", "list"])?.map((held) => held.name);

  it("sends the store version with its groceries as held on delete", async () => {
    const { result } = render();

    await act(async () => result.current.deleteStore("store-1", true));

    expect(sent.delete.mock.calls[0]?.[0]).toEqual({
      storeId: "store-1",
      version: 6,
      deleteGroceries: true,
      grocerySnapshot: [
        { id: "g1", version: 2 },
        { id: "g2", version: 5 },
      ],
    });
  });

  it("settles both of two creates that overlap, each Store listed under its answer", async () => {
    const { result } = render();
    const first = answerLater(sent.create);
    const second = answerLater(sent.create);
    const answers: string[] = [];

    act(() => {
      void result.current
        .createStore({ name: "Lidl", color: "primary" })
        .then((id) => answers.push(id));
    });
    act(() => {
      void result.current
        .createStore({ name: "Butcher", color: "primary" })
        .then((id) => answers.push(id));
    });
    await act(async () => first.resolve("lidl"));
    await act(async () => second.resolve("butcher"));
    await settled();

    expect(answers).toEqual(["lidl", "butcher"]);
    expect(names()).toEqual(["store-1", "store-2", "Lidl", "Butcher"]);
  });

  it("keeps a create Queued in the Outbox on the list, under the id it was sent with", async () => {
    const { result } = render();

    // Unreachable and admitted to the Outbox: the Queued signal.
    sent.create.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    let answer: string | undefined;

    await act(async () => {
      answer = await result.current.createStore({ name: "Lidl", color: "primary" });
    });
    await settled();

    const held = queryClient.getQueryData<StoreDto[]>(["stores", "list"]);

    expect(held?.at(-1)).toMatchObject({ id: answer, name: "Lidl" });
    expect(answer).toBe((sent.create.mock.calls[0]![0] as { id: string }).id);
    expect(queryClient.getQueryState(["stores", "list"])?.isInvalidated).toBe(false);
  });

  it.each([
    ["update", (m: ReturnType<typeof useStoresMutations>) => m.updateStore({ id: "store-1" })],
    ["delete", (m: ReturnType<typeof useStoresMutations>) => m.deleteStore("store-1", false)],
    [
      "reorder",
      (m: ReturnType<typeof useStoresMutations>) => m.reorderStores(["store-2", "store-1"]),
    ],
  ] as const)(
    "reads the Stores again when the earlier of two %s saves that overlap fails",
    async (procedure, save) => {
      const { result } = render();
      const first = answerLater(sent[procedure]);
      const second = answerLater(sent[procedure]);

      act(() => save(result.current));
      act(() => save(result.current));
      await act(async () => second.resolve(undefined));
      await act(async () => first.reject(new Error("Version conflict")));
      await settled();

      expect(queryClient.getQueryState(["stores", "list"])?.isInvalidated).toBe(true);
    }
  );
});
