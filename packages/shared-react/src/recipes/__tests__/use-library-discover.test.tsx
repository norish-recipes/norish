import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestWrapper } from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useLibraryDiscover } from "../use-library-discover";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

describe("useLibraryDiscover", () => {
  beforeEach(() => resetTRPCFake());

  it("reads the Categories and Tags the server offers", async () => {
    const discover = { categories: [{ name: "Dinner", image: null }], tags: ["vegan"] };

    serveTRPC(() => Promise.resolve(discover));

    const { result } = renderHook(() => useLibraryDiscover(), {
      wrapper: createTestWrapper(new QueryClient()),
    });

    await waitFor(() => expect(result.current.data).toEqual(discover));
  });
});
