import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { useAllergiesMutation } from "..";
import { readUnderWay } from "../../offline/testing";
import {
  answerCall,
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

  it("sends the profile's newer version after an account write bumped it", async () => {
    queryClient.setQueryData(ALLERGIES_KEY, { allergies: ["nuts"], version: 3 });
    queryClient.setQueryData(keyOf("user.get"), { user: { version: 5 }, apiKeys: [] });
    const result = render(() => useAllergiesMutation());

    act(() => void result.current.setAllergies(["milk"]));

    expect((await sentCall("user.setAllergies")).input).toEqual({
      allergies: ["milk"],
      version: 5,
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
