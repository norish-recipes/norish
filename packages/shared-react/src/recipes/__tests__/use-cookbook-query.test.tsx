/** Only the server saying NOT_FOUND reads as a missing cookbook; any other failure keeps the page loading. */
import { act, renderHook, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { failRead, resetTRPCFake } from "../../trpc/testing";
import { useCookbookQuery } from "../use-cookbook-query";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const trpcError = (code: string, httpStatus: number) =>
  TRPCClientError.from({ error: { message: code, code: -32000, data: { code, httpStatus } } });

const render = () =>
  renderHook(() => useCookbookQuery("cookbook-1"), {
    wrapper: createTestWrapper(createTestQueryClient()),
  }).result;

describe("useCookbookQuery", () => {
  beforeEach(() => resetTRPCFake());

  it("reads a NOT_FOUND answer as not found", async () => {
    const result = render();

    await act(async () => failRead("cookbooks.get", trpcError("NOT_FOUND", 404)));

    await waitFor(() => expect(result.current.isNotFound).toBe(true));
  });

  it.each([
    ["a 431", trpcError("INTERNAL_SERVER_ERROR", 431)],
    ["a network failure", new Error("offline")],
  ])("does not read %s as not found", async (_, error) => {
    const result = render();

    // It is retried once, so fail that read too.
    await waitFor(
      () => {
        act(() => failRead("cookbooks.get", error));
        expect(result.current.error).not.toBeNull();
      },
      { timeout: 3_000 }
    );
    expect(result.current.isNotFound).toBe(false);
  });
});
