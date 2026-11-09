import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { usePantryMutations } from "@norish/shared-react/groceries";

import { createTestQueryClient, createTestWrapper } from "./test-utils";

/** What each procedure is sent; a test answers or refuses it by its implementation. */
const sent = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }));

vi.mock("../trpc", () => {
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
