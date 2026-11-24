import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { useAllergiesMutation, useAllergiesQuery } from "..";
import { readUnderWay } from "../../offline/testing";
import {
  answerCall,
  answerRead,
  failCall,
  keyOf,
  resetTRPCFake,
  sentCall,
  trpcCalls,
} from "../../trpc/testing";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const ALLERGIES_KEY = keyOf("user.getAllergies");

describe("useAllergiesMutation", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  const render = <T>(hook: () => T) =>
    renderHook(hook, { wrapper: createTestWrapper(queryClient, fakePlatformAdapter()) }).result;

  beforeEach(() => {
    resetTRPCFake();
    queryClient = createTestQueryClient();
  });

  it("caches the allergies the server answers with", async () => {
    queryClient.setQueryData(ALLERGIES_KEY, { allergies: ["nuts"], version: 3 });
    const result = render(() => useAllergiesMutation());

    act(() => void result.current.setAllergies(["nuts", "gluten"]));
    expect((await sentCall("user.setAllergies")).input).toEqual({
      allergies: ["nuts", "gluten"],
      version: 3,
    });
    await answerCall("user.setAllergies", {
      success: true,
      allergies: ["gluten", "nuts"],
      version: 4,
    });

    expect(queryClient.getQueryData(ALLERGIES_KEY)).toEqual({
      allergies: ["gluten", "nuts"],
      version: 4,
    });
  });

  it("sends the version its own list was read at, never one the profile learned", async () => {
    queryClient.setQueryData(ALLERGIES_KEY, { allergies: ["nuts"], version: 3 });
    queryClient.setQueryData(keyOf("user.get"), { user: { version: 4 }, apiKeys: [] });
    const result = render(() => useAllergiesMutation());

    act(() => void result.current.setAllergies(["milk"]));

    expect((await sentCall("user.setAllergies")).input).toEqual({
      allergies: ["milk"],
      version: 3,
    });
  });

  it("rereads the list when the profile learns a newer version, and saves at the reread's", async () => {
    queryClient.setQueryData(ALLERGIES_KEY, { allergies: ["nuts"], version: 3 });
    const result = render(() => ({ read: useAllergiesQuery(), write: useAllergiesMutation() }));

    answerRead("user.getAllergies", { allergies: ["nuts"], version: 3 });
    act(() => queryClient.setQueryData(keyOf("user.get"), { user: { version: 4 }, apiKeys: [] }));
    await waitFor(() => expect(queryClient.isFetching({ queryKey: ALLERGIES_KEY })).toBe(1));
    await act(async () =>
      answerRead("user.getAllergies", { allergies: ["nuts", "soy"], version: 4 })
    );
    await waitFor(() => expect(result.current.read.allergies).toEqual(["nuts", "soy"]));

    act(() => void result.current.write.setAllergies(["milk"]));
    expect((await sentCall("user.setAllergies")).input).toEqual({
      allergies: ["milk"],
      version: 4,
    });
  });

  it("keeps a read begun before the answer from landing over it", async () => {
    const held = { allergies: ["nuts"], version: 3 };

    queryClient.setQueryData(ALLERGIES_KEY, held);
    const land = readUnderWay(queryClient, ALLERGIES_KEY, held);
    const result = render(() => useAllergiesMutation());

    act(() => void result.current.setAllergies(["nuts", "gluten"]));
    await answerCall("user.setAllergies", { success: true, allergies: ["gluten"], version: 4 });
    await act(land);

    expect(queryClient.getQueryData(ALLERGIES_KEY)).toEqual({ allergies: ["gluten"], version: 4 });
  });

  it("drops a reply older than the version both caches learned meanwhile", async () => {
    queryClient.setQueryData(ALLERGIES_KEY, { allergies: ["nuts"], version: 3 });
    queryClient.setQueryData(keyOf("user.get"), { user: { version: 3 }, apiKeys: [] });
    const result = render(() => useAllergiesMutation());

    act(() => void result.current.setAllergies(["milk"]));
    await sentCall("user.setAllergies");
    queryClient.setQueryData(ALLERGIES_KEY, { allergies: ["milk", "soy"], version: 5 });
    queryClient.setQueryData(keyOf("user.get"), { user: { version: 5 }, apiKeys: [] });
    await answerCall("user.setAllergies", { success: true, allergies: ["milk"], version: 4 });

    expect(queryClient.getQueryData(ALLERGIES_KEY)).toEqual({
      allergies: ["milk", "soy"],
      version: 5,
    });
    expect(queryClient.getQueryData(keyOf("user.get"))).toMatchObject({ user: { version: 5 } });
    expect(queryClient.getQueryState(ALLERGIES_KEY)?.isInvalidated).toBe(true);
  });

  it("resolves that a write the server took went through", async () => {
    queryClient.setQueryData(ALLERGIES_KEY, { allergies: [], version: 3 });
    const result = render(() => useAllergiesMutation());
    let outcome: boolean | undefined;

    act(() => void result.current.setAllergies(["nuts"]).then((took) => (outcome = took)));
    await answerCall("user.setAllergies", { success: true, allergies: ["nuts"], version: 4 });

    await waitFor(() => expect(outcome).toBe(true));
  });

  it("refuses a stale write as changed elsewhere and caches what the server holds", async () => {
    queryClient.setQueryData(ALLERGIES_KEY, { allergies: [], version: 3 });
    const adapter = fakePlatformAdapter();
    const result = renderHook(() => useAllergiesMutation(), {
      wrapper: createTestWrapper(queryClient, adapter),
    }).result;
    let outcome: boolean | undefined;

    act(() => void result.current.setAllergies(["nuts"]).then((took) => (outcome = took)));
    await answerCall("user.setAllergies", {
      success: true,
      stale: true,
      allergies: ["gluten"],
      version: 5,
    });

    await waitFor(() => expect(outcome).toBe(false));
    expect(adapter.showError).toHaveBeenCalledExactlyOnceWith(
      "common.changedElsewhere.title",
      expect.any(String)
    );
    expect(queryClient.getQueryData(ALLERGIES_KEY)).toEqual({ allergies: ["gluten"], version: 5 });
  });

  it("sends nothing before the allergies have been read, so the stored ones are never replaced", async () => {
    queryClient.setQueryData(keyOf("user.get"), { user: { version: 5 }, apiKeys: [] });
    const result = render(() => useAllergiesMutation());
    let outcome: boolean | undefined;

    act(() => void result.current.setAllergies(["milk"]).then((took) => (outcome = took)));

    await waitFor(() => expect(outcome).toBe(false));
    expect(trpcCalls["user.setAllergies"] ?? []).toHaveLength(0);
  });

  it("resolves false when the write fails", async () => {
    queryClient.setQueryData(ALLERGIES_KEY, { allergies: [], version: 3 });
    const result = render(() => useAllergiesMutation());
    let outcome: boolean | undefined;

    act(() => void result.current.setAllergies(["nuts"]).then((took) => (outcome = took)));
    await failCall("user.setAllergies");

    await waitFor(() => expect(outcome).toBe(false));
  });
});
