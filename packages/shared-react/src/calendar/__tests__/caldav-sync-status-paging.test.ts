import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CaldavSyncStatus } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useCaldavSyncStatusQuery } from "../use-caldav-query";
import { createMockSyncStatusData, createMockSyncStatusView } from "./test-utils";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

type Input = { page: number; statusFilter?: CaldavSyncStatus };

describe("useCaldavSyncStatusQuery paging", () => {
  beforeEach(() => {
    resetTRPCFake();
    // The first unfiltered page answers; any other stays loading.
    serveTRPC((_path, input) => {
      const { page, statusFilter } = input as Input;

      return page === 1 && !statusFilter
        ? Promise.resolve(createMockSyncStatusData([createMockSyncStatusView({ id: "s1" })], 40))
        : new Promise(() => {});
    });
  });

  const render = () =>
    renderHook((input: Input) => useCaldavSyncStatusQuery({ ...input, pageSize: 20 }), {
      initialProps: { page: 1 },
      wrapper: createTestWrapper(createTestQueryClient()),
    });

  it("keeps the page on screen, marked as loading, while the next one loads", async () => {
    const { result, rerender } = render();

    await waitFor(() => expect(result.current.total).toBe(40));
    rerender({ page: 2 });

    expect(result.current.total).toBe(40);
    expect(result.current.statuses.map((status) => status.id)).toEqual(["s1"]);
    expect(result.current.isPlaceholderData).toBe(true);
  });

  it("shows no rows of another filter while the filtered list loads", async () => {
    const { result, rerender } = render();

    await waitFor(() => expect(result.current.total).toBe(40));
    rerender({ page: 1, statusFilter: "failed" });

    expect(result.current.statuses).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.isLoading).toBe(true);
  });
});
