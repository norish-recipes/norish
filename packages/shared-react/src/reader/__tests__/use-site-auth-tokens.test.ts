import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { useSiteAuthTokenMutations, useSiteAuthTokensRead } from "..";
import { readUnderWay } from "../../offline/testing";
import { answerCall, failRead, keyOf, resetTRPCFake, sentCall } from "../../trpc/testing";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const TOKENS_KEY = keyOf("siteAuthTokens.list");

describe("useSiteAuthTokenMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  const render = <T>(hook: () => T) =>
    renderHook(hook, { wrapper: createTestWrapper(queryClient, fakePlatformAdapter()) }).result;

  beforeEach(() => {
    resetTRPCFake();
    queryClient = createTestQueryClient();
  });

  const token = { id: "t1", domain: "example.com", name: "Auth", type: "header", version: 2 };

  it("list an added token", async () => {
    queryClient.setQueryData(TOKENS_KEY, []);
    const result = render(() => useSiteAuthTokenMutations());
    let created: Promise<boolean> = Promise.resolve(false);

    act(() => {
      created = result.current.createToken({
        domain: "example.com",
        name: "Auth",
        value: "secret",
        type: "header",
      });
    });
    await answerCall("siteAuthTokens.create", token);

    await expect(created).resolves.toBe(true);
    expect(queryClient.getQueryData(TOKENS_KEY)).toEqual([token]);
  });

  it("reread, never seed, a list that was never read when a token is added", async () => {
    const result = render(() => useSiteAuthTokenMutations());
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    act(() => void result.current.createToken({ ...token, value: "secret" }));
    await answerCall("siteAuthTokens.create", token);

    expect(queryClient.getQueryData(TOKENS_KEY)).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: TOKENS_KEY });
  });

  it("drop a removed token, sending its version", async () => {
    queryClient.setQueryData(TOKENS_KEY, [token]);
    const result = render(() => useSiteAuthTokenMutations());

    act(() => void result.current.removeToken("t1"));
    expect((await sentCall("siteAuthTokens.remove")).input).toEqual({ id: "t1", version: 2 });
    await answerCall("siteAuthTokens.remove", { success: true, stale: false });

    expect(queryClient.getQueryData(TOKENS_KEY)).toEqual([]);
  });

  it("keep a token edited elsewhere, reread the list and say so when the delete was stale", async () => {
    const adapter = fakePlatformAdapter();
    queryClient.setQueryData(TOKENS_KEY, [token]);
    const result = renderHook(() => useSiteAuthTokenMutations(), {
      wrapper: createTestWrapper(queryClient, adapter),
    }).result;

    act(() => void result.current.removeToken("t1"));
    await answerCall("siteAuthTokens.remove", { success: true, stale: true });

    expect(queryClient.getQueryData(TOKENS_KEY)).toEqual([token]);
    expect(queryClient.getQueryState(TOKENS_KEY)?.isInvalidated).toBe(true);
    expect(adapter.showError).toHaveBeenCalledExactlyOnceWith(
      "common.changedElsewhere.title",
      expect.any(String)
    );
  });

  it("keep a read begun before an add or a removal from landing over it", async () => {
    queryClient.setQueryData(TOKENS_KEY, [token]);
    const result = render(() => useSiteAuthTokenMutations());
    const added = { ...token, id: "t2" };

    let land = readUnderWay(queryClient, TOKENS_KEY, [token]);

    act(() => void result.current.createToken({ ...added, value: "secret" }));
    await answerCall("siteAuthTokens.create", added);
    await act(land);
    expect(queryClient.getQueryData(TOKENS_KEY)).toEqual([token, added]);

    land = readUnderWay(queryClient, TOKENS_KEY, [token, added]);
    act(() => void result.current.removeToken("t1"));
    await answerCall("siteAuthTokens.remove", { success: true, stale: false });
    await act(land);
    expect(queryClient.getQueryData(TOKENS_KEY)).toEqual([added]);
  });
});

describe("useSiteAuthTokensRead", () => {
  it("tells a failed first read from an empty list, and keeps a cached list through a failed refetch", async () => {
    resetTRPCFake();
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useSiteAuthTokensRead(), {
      wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
    });

    await act(async () => failRead("siteAuthTokens.list"));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current).toMatchObject({ tokens: [], answered: false });

    act(() => queryClient.setQueryData(TOKENS_KEY, [{ id: "t1" }]));
    result.current.refetch();
    await act(async () => failRead("siteAuthTokens.list"));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current).toMatchObject({ tokens: [{ id: "t1" }], answered: true });
  });
});
