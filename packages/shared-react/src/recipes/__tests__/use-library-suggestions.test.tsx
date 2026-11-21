import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestWrapper } from "@norish/shared-react/platform/testing";
import { SUGGEST_TEXT_MAX } from "@norish/shared/contracts/zod";

import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useLibrarySuggestions } from "../use-library-suggestions";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const run = (text: string) => {
  const asked: unknown[] = [];

  serveTRPC((_, input) => {
    asked.push(input);

    return Promise.resolve({ ingredients: [], tags: [], categories: [] });
  });

  const { result } = renderHook(() => useLibrarySuggestions(text), {
    wrapper: createTestWrapper(new QueryClient()),
  });

  return { result, asked };
};

describe("useLibrarySuggestions", () => {
  beforeEach(() => resetTRPCFake());

  it("reads the text, up to the longest the server takes", async () => {
    const { result, asked } = run("a".repeat(SUGGEST_TEXT_MAX));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(asked).toHaveLength(1);
  });

  it("asks nothing for a longer text, and is not loading", async () => {
    const { result, asked } = run("a".repeat(SUGGEST_TEXT_MAX + 1));

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(asked).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});
