import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { useSiteAuthTokenMutations } from "..";
import { readUnderWay } from "../../offline/testing";
import { answerCall, keyOf, resetTRPCFake, sentCall } from "../../trpc/testing";

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

  it("drop a removed token, sending its version", async () => {
    queryClient.setQueryData(TOKENS_KEY, [token]);
    const result = render(() => useSiteAuthTokenMutations());

    act(() => void result.current.removeToken("t1"));
    expect((await sentCall("siteAuthTokens.remove")).input).toEqual({ id: "t1", version: 2 });
    await answerCall("siteAuthTokens.remove", { success: true, stale: false });

    expect(queryClient.getQueryData(TOKENS_KEY)).toEqual([]);
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
