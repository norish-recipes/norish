import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useMyRecipeSharesQuery } from "..";
import { answerRead, failRead, resetTRPCFake } from "../../trpc/testing";

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
});
