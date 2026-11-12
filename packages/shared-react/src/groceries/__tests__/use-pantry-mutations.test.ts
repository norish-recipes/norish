import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { usePantryMutations } from "@norish/shared-react/groceries";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

/** What each procedure is sent; a test answers or refuses it by its implementation. */
const sent = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }));

vi.mock("../../trpc", () => {
  /** A procedure's mutation options as tRPC builds them: the caller's own, and its send. */
  const procedure = (mutationFn: (input: unknown) => unknown) => ({
    mutationOptions: (options?: object) => ({ ...options, mutationFn }),
  });

  return {
    useTRPC: () => ({
      pantry: {
        list: { queryKey: () => ["pantry", "list"] },
        add: procedure(sent.add),
        remove: procedure(sent.remove),
      },
    }),
  };
});

const SALT: PantryIngredientDto = {
  id: "salt",
  userId: "u1",
  ingredientId: "i-salt",
  name: "Salt",
  version: 1,
  ancestorIds: [],
  localeNames: {},
};

/** Answers the next send of a procedure when the test says, the way a slow server does. */
function answerLater(send: typeof sent.add) {
  const answer = Promise.withResolvers<unknown>();

  send.mockImplementationOnce(() => answer.promise);

  return answer;
}

describe("usePantryMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    sent.add.mockReset();
    sent.remove.mockReset();
  });

  const render = () =>
    renderHook(() => usePantryMutations(), { wrapper: createTestWrapper(queryClient) });
  const settled = () =>
    act(async () => {
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });

  it("settles both of two adds that overlap, each with its own answer", async () => {
    queryClient.setQueryData(["pantry", "list"], []);
    const { result } = render();
    const first = answerLater(sent.add);
    const second = answerLater(sent.add);
    const answers: string[] = [];

    act(() => {
      void result.current.addPantryIngredient("Salt").then((id) => answers.push(`salt ${id}`));
    });
    act(() => {
      void result.current.addPantryIngredient("Pepper").then((id) => answers.push(`pepper ${id}`));
    });
    // The household already kept salt: the server answers with that item's id.
    await act(async () => first.resolve("kept-salt"));
    await act(async () => second.resolve((sent.add.mock.calls[1]![0] as { id: string }).id));
    await settled();

    expect(answers).toEqual(["salt kept-salt", expect.stringMatching(/^pepper /)]);
    // The tentative salt row went, as its answer said; pepper's stays.
    expect(
      queryClient.getQueryData<PantryIngredientDto[]>(["pantry", "list"])?.map((row) => row.name)
    ).toEqual(["Pepper"]);
  });

  it("keeps an add Queued in the Outbox on the list, under the id it was sent with", async () => {
    queryClient.setQueryData(["pantry", "list"], []);
    const { result } = render();

    // Unreachable and admitted to the Outbox: the Queued signal.
    sent.add.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    let answer: string | undefined;

    await act(async () => {
      answer = await result.current.addPantryIngredient("Salt");
    });
    await settled();

    const rows = queryClient.getQueryData<PantryIngredientDto[]>(["pantry", "list"]);

    expect(rows?.map(({ id, name }) => ({ id, name }))).toEqual([{ id: answer, name: "Salt" }]);
    expect(queryClient.getQueryState(["pantry", "list"])?.isInvalidated).toBe(false);
  });

  it("says a refused add failed, naming the food where the caller named it, and resolves null", async () => {
    queryClient.setQueryData(["pantry", "list"], []);
    const platform = fakePlatformAdapter();
    const { result } = renderHook(() => usePantryMutations(), {
      wrapper: createTestWrapper(queryClient, platform),
    });
    const answers: (string | null)[] = [];

    sent.add.mockRejectedValueOnce(new Error("forbidden"));
    sent.add.mockRejectedValueOnce(new Error("forbidden"));
    await act(async () => {
      answers.push(await result.current.addPantryIngredient("Salt", "Sea salt"));
      answers.push(await result.current.addPantryIngredient("Pepper"));
    });

    expect(answers).toEqual([null, null]);
    expect(platform.toast.show).toHaveBeenNthCalledWith(1, {
      severity: "danger",
      title: "groceries.pantry.keepFailed",
    });
    expect(platform.toast.show).toHaveBeenNthCalledWith(2, {
      severity: "danger",
      title: "groceries.panel.keepFailed",
    });
    expect(queryClient.getQueryState(["pantry", "list"])?.isInvalidated).toBe(true);
  });

  it("says nothing of an add Queued in the Outbox", async () => {
    queryClient.setQueryData(["pantry", "list"], []);
    const platform = fakePlatformAdapter();
    const { result } = renderHook(() => usePantryMutations(), {
      wrapper: createTestWrapper(queryClient, platform),
    });

    sent.add.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(async () => {
      await result.current.addPantryIngredient("Salt", "Salt");
    });

    expect(platform.toast.show).not.toHaveBeenCalled();
  });

  it("reads the Pantry again when the earlier of two removals that overlap fails", async () => {
    queryClient.setQueryData(["pantry", "list"], [SALT]);
    const { result } = render();
    const first = answerLater(sent.remove);
    const second = answerLater(sent.remove);

    act(() => result.current.removePantryIngredient("salt"));
    act(() => result.current.removePantryIngredient("pepper"));
    await act(async () => second.resolve(undefined));
    await act(async () => first.reject(new Error("Version conflict")));
    await settled();

    expect(queryClient.getQueryState(["pantry", "list"])?.isInvalidated).toBe(true);
  });
});
