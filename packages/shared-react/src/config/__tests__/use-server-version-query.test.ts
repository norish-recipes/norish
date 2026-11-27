import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useServerVersionQuery } from "..";
import { answerRead, resetTRPCFake } from "../../trpc/testing";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

describe("the server version", () => {
  beforeEach(resetTRPCFake);

  it("is unknown until the health check answers, then the version it reports", async () => {
    const { result } = renderHook(() => useServerVersionQuery(), {
      wrapper: createTestWrapper(createTestQueryClient()),
    });

    expect(result.current).toBeUndefined();

    await waitFor(() => answerRead("config.healthReady", { status: "ok", version: "0.28.0" }));
    await waitFor(() => expect(result.current).toBe("0.28.0"));
  });
});
