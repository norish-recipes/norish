import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useCookbooksMutations } from "../use-cookbooks-mutations";

const sendCreate = vi.hoisted(() => vi.fn());

vi.mock("../../trpc", () => {
  const key =
    (...path: string[]) =>
    (input?: unknown) => [path, ...(input === undefined ? [] : [{ input }])];
  const read = (...path: string[]) => ({ queryKey: key(...path), pathKey: () => [path] });
  const procedure = (mutationFn: (input: unknown) => unknown) => ({
    mutationOptions: (options?: object) => ({ ...options, mutationFn }),
  });

  return {
    useTRPC: () => ({
      cookbooks: {
        list: read("cookbooks", "list"),
        editable: read("cookbooks", "editable"),
        get: read("cookbooks", "get"),
        forRecipe: read("cookbooks", "forRecipe"),
        recipes: read("cookbooks", "recipes"),
        memberIds: read("cookbooks", "memberIds"),
        create: procedure(sendCreate),
        update: procedure(vi.fn()),
        remove: procedure(vi.fn()),
        setMembership: procedure(vi.fn()),
        uploadImage: procedure(vi.fn()),
      },
      library: { list: read("library", "list") },
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
