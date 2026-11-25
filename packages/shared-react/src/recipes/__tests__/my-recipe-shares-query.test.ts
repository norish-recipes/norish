import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useMyRecipeSharesQuery } from "..";
import { trackedEvent } from "../../../__tests__/realtime/tracked-event";
import { answerRead, failRead, keyOf, resetTRPCFake } from "../../trpc/testing";

const useSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock("@trpc/tanstack-react-query", async () => ({
  ...(await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  )),
  useSubscription: useSubscriptionMock,
}));
vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

describe("useMyRecipeSharesQuery", () => {
  const render = () =>
    renderHook(() => useMyRecipeSharesQuery(), {
      wrapper: createTestWrapper(createTestQueryClient()),
    }).result;

  it("tells a failed first read from an empty list", async () => {
    resetTRPCFake();
    const result = render();

    await act(async () => failRead("recipes.shareListMine"));
    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current).toMatchObject({ shares: [], answered: false });
  });

  it("answers with an empty list once the server says there are none", async () => {
    resetTRPCFake();
    const result = render();

    await act(async () => answerRead("recipes.shareListMine", []));

    await waitFor(() => expect(result.current.answered).toBe(true));
    expect(result.current.shares).toEqual([]);
  });

  it("rereads when the maker's own devices are told a link changed", async () => {
    resetTRPCFake();
    useSubscriptionMock.mockReset();
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useMyRecipeSharesQuery(), { wrapper: createTestWrapper(queryClient) });
    const options = useSubscriptionMock.mock.calls.at(-1)?.[0] as {
      path: string;
      onData: (event: unknown) => void;
    };

    expect(options.path).toBe("recipes.onMyShareEvent");
    options.onData(trackedEvent({ kind: "revoked", shareId: "share-1" }));

    await vi.waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: keyOf("recipes.shareListMine") })
    );
  });
});
