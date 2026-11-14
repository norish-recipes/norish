import { act, renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CookbookSummaryDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { useCookbooksMutations } from "../use-cookbooks-mutations";

const sends = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  setMembership: vi.fn(),
}));
const sendCreate = sends.create;

vi.mock("../../trpc", () => {
  const key =
    (...path: string[]) =>
    (input?: unknown) => [path, ...(input === undefined ? [] : [{ input }])];
  const read = (...path: string[]) => ({
    queryKey: key(...path),
    pathKey: () => [path],
    infiniteQueryKey: (input?: unknown) => [path, { input }, "infinite"],
  });
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
        update: procedure(sends.update),
        remove: procedure(sends.remove),
        setMembership: procedure(sends.setMembership),
        uploadImage: procedure(vi.fn()),
      },
      library: { list: read("library", "list") },
      recipes: { list: read("recipes", "list") },
    }),
  };
});

vi.mock("../../reader", () => ({ useReader: () => ({ user: { id: "user-1" } }) }));

describe("useCookbooksMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    for (const send of Object.values(sends)) send.mockReset();
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
  describe("a write the server refuses", () => {
    const refusal = new Error("refused");
    const cookbook = {
      id: "c1",
      userId: "user-1",
      title: "Soups",
      version: 1,
      memberCount: 0,
    } as CookbookSummaryDTO;

    const setup = () => {
      const adapter = fakePlatformAdapter();
      const view = renderHook(() => useCookbooksMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      return { adapter, ...view };
    };
    const failure = {
      severity: "default",
      title: "common.errors.operationFailed",
      description: "common.errors.technicalDetails",
    };

    it("shows a failure toast for a create and resolves without rejecting", async () => {
      sendCreate.mockRejectedValue(refusal);
      const { adapter, result } = setup();
      let id: string | undefined = "unset";

      await act(async () => {
        id = await result.current.createCookbook({ title: "Soups", recipeIds: ["r1"] });
      });

      expect(id).toBeUndefined();
      expect(adapter.toast.show).toHaveBeenCalledExactlyOnceWith(failure);
    });

    it.each([
      [
        "rename",
        sends.update,
        (m: ReturnType<typeof useCookbooksMutations>) =>
          m.updateCookbook({ id: "c1", title: "Stews", version: 1 }),
      ],
      [
        "delete",
        sends.remove,
        (m: ReturnType<typeof useCookbooksMutations>) => m.deleteCookbook({ id: "c1", version: 1 }),
      ],
      [
        "add or remove",
        sends.setMembership,
        (m: ReturnType<typeof useCookbooksMutations>) =>
          m.setMembership({ cookbookId: "c1", recipeIds: ["r1"], isMember: true, cookbook }),
      ],
    ])("shows a failure toast for %s", async (_name, send, run) => {
      send.mockRejectedValue(refusal);
      const { adapter, result } = setup();

      act(() => run(result.current));
      await vi.waitFor(() => expect(adapter.toast.show).toHaveBeenCalledExactlyOnceWith(failure));
    });

    it("shows nothing for a create the Outbox queued", async () => {
      sendCreate.mockRejectedValue(new TRPCClientError("Failed to fetch"));
      const { adapter, result } = setup();

      await act(async () => {
        await result.current.createCookbook({ title: "Soups" });
      });

      expect(adapter.toast.show).not.toHaveBeenCalled();
    });
  });

  it("seeds a create queued Offline with the recipes picked, so its page lists them", async () => {
    sendCreate.mockRejectedValue(new TRPCClientError("Failed to fetch"));
    const dto = (id: string) => ({ id, name: id }) as RecipeDashboardDTO;

    queryClient.setQueryData([["recipes", "list"], { input: {} }], {
      pages: [{ recipes: [dto("r1"), dto("r2"), dto("r3")], total: 3, nextCursor: null }],
      pageParams: [0],
    });

    const { result } = renderHook(() => useCookbooksMutations(), {
      wrapper: createTestWrapper(queryClient),
    });
    let id = "";

    await act(async () => {
      id = await result.current.createCookbook({ title: "Soups", recipeIds: ["r3", "r1"] });
    });

    const [[, members]] = queryClient.getQueriesData<{
      pages: { recipes: { id: string }[]; total: number }[];
    }>({ queryKey: [["cookbooks", "recipes"]] });
    const card = queryClient.getQueryData<CookbookSummaryDTO>([
      ["cookbooks", "get"],
      { input: { id } },
    ]);

    expect(card?.memberCount).toBe(2);
    expect(members?.pages[0]?.recipes.map((recipe) => recipe.id)).toEqual(["r3", "r1"]);
    expect(members?.pages[0]?.total).toBe(2);
  });
});
