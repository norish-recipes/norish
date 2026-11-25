/** Only the server saying NOT_FOUND reads as a missing cookbook; any other failure keeps the page loading. */
import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestWrapper } from "@norish/shared-react/platform/testing";

import { createOfflineQueryClient } from "../../offline/cache-manager";
import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useCookbookQuery } from "../use-cookbook-query";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const trpcError = (code: string, httpStatus: number) =>
  TRPCClientError.from({ error: { message: code, code: -32000, data: { code, httpStatus } } });

/** Every read fails with `error`; the hook's own retry runs with no delay. */
const render = (error: unknown) => {
  let reads = 0;

  serveTRPC(() => {
    reads++;

    return Promise.reject(error);
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const { result } = renderHook(() => useCookbookQuery("cookbook-1"), {
    wrapper: createTestWrapper(queryClient),
  });

  return { result, reads: () => reads };
};

describe("useCookbookQuery", () => {
  beforeEach(() => resetTRPCFake());

  it("reads a NOT_FOUND answer as not found, without a retry", async () => {
    const { result, reads } = render(trpcError("NOT_FOUND", 404));

    await waitFor(() => expect(result.current.isNotFound).toBe(true));
    expect(reads()).toBe(1);
  });

  it.each([
    ["a 431", trpcError("INTERNAL_SERVER_ERROR", 431)],
    ["a network failure", new Error("offline")],
  ])("does not read %s as not found", async (_, error) => {
    const { result, reads } = render(error);

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(reads()).toBe(2);
    expect(result.current.isNotFound).toBe(false);
  });

  it("drops a cookbook whose reread is refused after the view narrows, and shows it when it widens", async () => {
    const cookbook = { id: "cookbook-1", name: "Soups" };
    let answer: () => Promise<unknown> = async () => cookbook;

    serveTRPC(() => answer());
    const queryClient = createOfflineQueryClient();
    const { result } = renderHook(() => useCookbookQuery("cookbook-1"), {
      wrapper: createTestWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.cookbook).toEqual(cookbook));

    answer = () => Promise.reject(trpcError("NOT_FOUND", 404));
    await queryClient.invalidateQueries();
    await waitFor(() => expect(result.current.isNotFound).toBe(true));
    expect(result.current.cookbook).toBeUndefined();

    answer = async () => cookbook;
    await queryClient.invalidateQueries();
    await waitFor(() => expect(result.current.cookbook).toEqual(cookbook));
    expect(result.current.isNotFound).toBe(false);
  });
});
