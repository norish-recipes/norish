/** How the reader reads a recipe's lines outside their catalogue: loading, answered, or as stored. */
import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { answerRead, failRead, resetTRPCFake } from "../../trpc/testing";
import { useLineReadings } from "../use-line-readings";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const READING = {
  ingredientId: "mine",
  joined: null,
  foods: [{ ingredientId: "mine", name: "ui" }],
};

describe("useLineReadings", () => {
  const render = (ids: string[]) =>
    renderHook(() => useLineReadings(ids), {
      wrapper: createTestWrapper(createTestQueryClient()),
    }).result;

  beforeEach(() => resetTRPCFake());
  afterEach(() => onlineManager.setOnline(true));

  it("reads nothing for no recipe", () => {
    expect(render([]).current).toEqual({});
  });

  it("is undefined until the readings answer", async () => {
    const result = render(["r1"]);

    expect(result.current).toBeUndefined();
    await act(async () => answerRead("recipes.lineReadings", { l1: READING }));
    await waitFor(() => expect(result.current).toEqual({ l1: READING }));
  });

  it("reads the lines as stored when the read fails or waits for the network", async () => {
    const failed = render(["r1"]);

    await act(async () => failRead("recipes.lineReadings"));
    await waitFor(() => expect(failed.current).toEqual({}));

    onlineManager.setOnline(false);
    expect(render(["r2"]).current).toEqual({});
  });
});
