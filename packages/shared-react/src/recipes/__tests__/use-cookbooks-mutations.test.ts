import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import { createTestQueryClient, createTestWrapper } from "../../groceries/__tests__/test-utils";
import { useCookbooksMutations } from "../use-cookbooks-mutations";

const sendCreate = vi.hoisted(() => vi.fn());

vi.mock("../../trpc", () => {
  const key =
    (...path: string[]) =>
    (input?: unknown) => [path, ...(input === undefined ? [] : [{ input }])];
  const procedure = (mutationFn: (input: unknown) => unknown) => ({
    mutationOptions: (options?: object) => ({ ...options, mutationFn }),
  });

  return {
    useTRPC: () => ({
      cookbooks: {
        list: { queryKey: key("cookbooks", "list") },
        editable: { queryKey: key("cookbooks", "editable") },
        get: { queryKey: key("cookbooks", "get") },
        forRecipe: { queryKey: key("cookbooks", "forRecipe") },
        recipes: { queryKey: key("cookbooks", "recipes") },
        memberIds: { queryKey: key("cookbooks", "memberIds") },
        create: procedure(sendCreate),
        update: procedure(vi.fn()),
        remove: procedure(vi.fn()),
        setMembership: procedure(vi.fn()),
        uploadImage: procedure(vi.fn()),
      },
      library: { list: { queryKey: key("library", "list") } },
    }),
  };
});

vi.mock("../../reader", () => ({ useReader: () => ({ user: { id: "user-1" } }) }));

describe("useCookbooksMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    sendCreate.mockReset();
  });

  it("settles both of two creates that overlap, each cookbook's page seeded", async () => {
    const answers = [Promise.withResolvers<unknown>(), Promise.withResolvers<unknown>()];

    sendCreate
      .mockImplementationOnce(() => answers[0]!.promise)
      .mockImplementationOnce(() => answers[1]!.promise);

    const { result } = renderHook(() => useCookbooksMutations(), {
      wrapper: createTestWrapper(queryClient),
    });
    const ids: string[] = [];

    act(() => {
      void result.current.createCookbook({ title: "Soups" }).then((id) => ids.push(id));
    });
    act(() => {
      void result.current.createCookbook({ title: "Stews" }).then((id) => ids.push(id));
    });
    await act(async () => answers[0]!.resolve(undefined));
    await act(async () => answers[1]!.resolve(undefined));
    await act(async () => {
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });

    expect(ids).toHaveLength(2);
    expect(
      ids.map(
        (id) =>
          queryClient.getQueryData<CookbookSummaryDTO>([["cookbooks", "get"], { input: { id } }])
            ?.title
      )
    ).toEqual(["Soups", "Stews"]);
  });
});
