import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { useAllergiesMutation } from "..";
import { readUnderWay } from "../../offline/testing";
import { answerCall, keyOf, resetTRPCFake, sentCall } from "../../trpc/testing";

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

    act(() => result.current.setAllergies(["nuts", "gluten"]));
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

  it("keeps a read begun before the answer from landing over it", async () => {
    const held = { allergies: ["nuts"], version: 3 };

    queryClient.setQueryData(ALLERGIES_KEY, held);
    const land = readUnderWay(queryClient, ALLERGIES_KEY, held);
    const result = render(() => useAllergiesMutation());

    act(() => result.current.setAllergies(["nuts", "gluten"]));
    await answerCall("user.setAllergies", { success: true, allergies: ["gluten"], version: 4 });
    await act(land);

    expect(queryClient.getQueryData(ALLERGIES_KEY)).toEqual({ allergies: ["gluten"], version: 4 });
  });
});
