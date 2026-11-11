import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useCaldavSyncStatusQuery } from "../use-caldav-query";
import { createMockSyncStatusData, createMockSyncStatusView } from "./test-utils";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

describe("useCaldavSyncStatusQuery paging", () => {
  beforeEach(() => {
    resetTRPCFake();
    // The first page answers; any other stays loading.
    serveTRPC((_path, input) =>
      (input as { page: number }).page === 1
        ? Promise.resolve(createMockSyncStatusData([createMockSyncStatusView({ id: "s1" })], 40))
        : new Promise(() => {})
    );
  });

  it("keeps the page on screen while the next one loads", async () => {
    const { result, rerender } = renderHook(
      ({ page }) => useCaldavSyncStatusQuery({ page, pageSize: 20 }),
      {
        initialProps: { page: 1 },
        wrapper: createTestWrapper(createTestQueryClient()),
      }
    );

    await waitFor(() => expect(result.current.total).toBe(40));
    rerender({ page: 2 });

    expect(result.current.total).toBe(40);
    expect(result.current.statuses.map((status) => status.id)).toEqual(["s1"]);
  });
});
