import { act, renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PendingRecipeDTO } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useImportMutations } from "../use-import-mutations";

const server = vi.hoisted(() => ({
  importFromUrl: vi.fn(),
  importFromPaste: vi.fn(),
  importFromImages: vi.fn(),
}));

vi.mock("../../trpc", () => {
  const key =
    (...path: string[]) =>
    (input?: unknown) => [path, ...(input === undefined ? [] : [{ input }])];
  const procedure = (name: string) => ({ mutationKey: () => [["recipes", name]] });
  // The client's `mutate(input, options)`, as the import mutations call it.
  const client = (send: (input: unknown, options?: unknown) => unknown) => ({ mutate: send });

  return {
    useTRPCClient: () => ({
      recipes: {
        importFromUrl: client(server.importFromUrl),
        importFromImages: client(server.importFromImages),
        importFromPaste: client(server.importFromPaste),
      },
    }),
    useTRPC: () => ({
      recipes: {
        list: { queryKey: key("recipes", "list"), pathKey: key("recipes", "list") },
        get: { queryKey: key("recipes", "get") },
        getPending: { queryKey: key("recipes", "getPending") },
        importFromUrl: procedure("importFromUrl"),
        importFromImages: procedure("importFromImages"),
        importFromPaste: procedure("importFromPaste"),
      },
      library: { list: { queryKey: key("library", "list"), pathKey: key("library", "list") } },
      cookbooks: { recipes: { pathKey: key("cookbooks", "recipes") } },
    }),
  };
});

const PENDING_KEY = [["recipes", "getPending"]];

describe("useImportMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    for (const send of Object.values(server)) send.mockReset();
    queryClient = createTestQueryClient();
    queryClient.setQueryData<PendingRecipeDTO[]>(PENDING_KEY, []);
  });

  const render = (...args: Parameters<typeof useImportMutations>) =>
    renderHook(() => useImportMutations(...args), { wrapper: createTestWrapper(queryClient) })
      .result;
  const settled = () =>
    act(async () => {
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });
  const pendingIds = () =>
    queryClient.getQueryData<PendingRecipeDTO[]>(PENDING_KEY)?.map((p) => p.recipeId);

  it("tracks a queued import under the id the server gave it", async () => {
    server.importFromUrl.mockResolvedValue({ recipeId: "recipe-new", status: "queued" });
    const result = render();

    act(() => result.current.importRecipe("https://example.com/pasta"));
    await settled();

    expect(pendingIds()).toEqual(["recipe-new"]);
  });

  it("leaves no placeholder for a URL the household holds, and names that recipe", async () => {
    const alreadyExists = vi.fn();

    server.importFromUrl.mockResolvedValue({ recipeId: "recipe-held", status: "exists" });
    const result = render(undefined, alreadyExists);

    act(() => result.current.importRecipe("https://example.com/pasta"));
    await settled();

    expect(pendingIds()).toEqual([]);
    expect(alreadyExists).toHaveBeenCalledWith("recipe-held");
  });

  it("keeps the placeholder when the backend is unreachable and the import is queued", async () => {
    const onError = vi.fn();
    const unreachable = new TRPCClientError("Request failed");

    server.importFromUrl.mockRejectedValue(unreachable);
    const result = render(onError);

    act(() => result.current.importRecipe("https://example.com/pasta"));
    await settled();

    expect(pendingIds()).toEqual([expect.stringMatching(/^optimistic-pending-recipe:/)]);
    expect(onError).toHaveBeenCalledWith(unreachable, "importFromUrl");
  });

  it("reports each import's end to its caller: null once taken, else the error", async () => {
    const queued = new TRPCClientError("Request failed");
    const reports = vi.fn();

    server.importFromUrl.mockResolvedValue({ recipeId: "recipe-new", status: "queued" });
    server.importFromPaste.mockRejectedValue(queued);
    server.importFromImages.mockResolvedValue("recipe-pages");
    const result = render();

    act(() => result.current.importRecipe("https://example.com/pasta", { onSettled: reports }));
    act(() => result.current.importRecipeFromPaste("Soup", { onSettled: reports }));
    act(() => result.current.importRecipeFromImages([new Blob(["jpeg"])], { onSettled: reports }));
    await settled();

    await vi.waitFor(() => expect(reports).toHaveBeenCalledTimes(3));
    expect(reports.mock.calls.map(([error]: unknown[]) => error)).toEqual(
      expect.arrayContaining([null, null, queued])
    );
  });

  it("sends a caller's operation id in the mutation's context, and none otherwise", async () => {
    server.importFromUrl.mockResolvedValue({ recipeId: "recipe-new", status: "queued" });
    server.importFromPaste.mockResolvedValue({ recipeIds: ["recipe-1"] });
    server.importFromImages.mockResolvedValue("recipe-pages");
    const result = render();

    act(() => result.current.importRecipe("https://example.com/a", { operationId: "share-1" }));
    act(() => result.current.importRecipeFromPaste("Soup", { operationId: "share-2" }));
    act(() => result.current.importRecipeFromImages([new Blob(["a"])], { operationId: "share-3" }));
    act(() => result.current.importRecipe("https://example.com/b"));
    await settled();

    expect(server.importFromUrl.mock.calls[0]).toEqual([
      { url: "https://example.com/a" },
      { context: { operationId: "share-1" } },
    ]);
    expect(server.importFromPaste.mock.calls[0]![1]).toEqual({
      context: { operationId: "share-2" },
    });
    expect(server.importFromImages.mock.calls[0]![1]).toEqual({
      context: { operationId: "share-3" },
    });
    expect(server.importFromUrl.mock.calls[1]).toEqual([
      { url: "https://example.com/b" },
      undefined,
    ]);
  });

  it("drops the placeholder and tells the caller when an import fails", async () => {
    const onError = vi.fn();
    const failure = new Error("Bad recipe URL");

    server.importFromUrl.mockRejectedValue(failure);
    const result = render(onError);

    act(() => result.current.importRecipeWithAI("https://example.com/pasta"));
    await settled();

    expect(pendingIds()).toEqual([]);
    expect(onError).toHaveBeenCalledWith(failure, "importFromUrlWithAI");
  });

  it("tells its caller nothing of an error it keeps, and still drops the placeholder", async () => {
    const onError = vi.fn();
    const busy = { data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503 } };
    const refused = { data: { code: "BAD_REQUEST", httpStatus: 400 } };
    const keeps = (error: unknown) => error === busy;

    server.importFromUrl.mockRejectedValueOnce(busy).mockRejectedValueOnce(refused);
    const result = render(onError);

    act(() => result.current.importRecipe("https://example.com/a", { keeps }));
    await settled();
    act(() => result.current.importRecipe("https://example.com/b", { keeps }));
    await settled();

    expect(pendingIds()).toEqual([]);
    expect(onError).toHaveBeenCalledExactlyOnceWith(refused, "importFromUrl");
  });

  it("says when the server queued an import, not when the household already holds it", async () => {
    const onAccepted = vi.fn();

    server.importFromUrl
      .mockResolvedValueOnce({ recipeId: "recipe-held", status: "exists" })
      .mockResolvedValueOnce({ recipeId: "recipe-new", status: "queued" });
    server.importFromPaste.mockResolvedValue({ recipeIds: ["recipe-1", "recipe-2"] });
    const result = render();

    act(() => result.current.importRecipe("https://example.com/a", { onAccepted }));
    await settled();
    expect(onAccepted).not.toHaveBeenCalled();
    act(() => result.current.importRecipe("https://example.com/b", { onAccepted }));
    act(() => result.current.importRecipeFromPaste("two recipes", { onAccepted }));
    await settled();

    expect(onAccepted).toHaveBeenCalledTimes(2);
  });

  it("tracks every recipe a paste import found", async () => {
    server.importFromPaste.mockResolvedValue({ recipeIds: ["recipe-1", "recipe-2", "recipe-3"] });
    const result = render();

    act(() => result.current.importRecipeFromPaste("three recipes"));
    await settled();

    expect(pendingIds()).toEqual(["recipe-1", "recipe-2", "recipe-3"]);
  });

  it("sends each image as its own file field, any Blob accepted", async () => {
    server.importFromImages.mockResolvedValue("recipe-photo");
    const pages = [new Blob(["a"], { type: "image/png" }), new Blob(["b"], { type: "image/jpeg" })];
    const result = render();

    act(() => result.current.importRecipeFromImages(pages));
    await settled();

    const form = server.importFromImages.mock.calls[0]![0] as FormData;

    expect([...form.keys()]).toEqual(["file0", "file1"]);
    expect((form.get("file1") as Blob).type).toBe("image/jpeg");
    expect(pendingIds()).toEqual(["recipe-photo"]);
  });
});
