/** Deleting the Account Offline fails outright: the Outbox never holds a delete to replay later. */

import { act, renderHook, waitFor } from "@testing-library/react";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import type { OutboxStore } from "../../offline/outbox-store";
import { createOutboxLink } from "../../offline/outbox-link";
import { useDeleteAccountMutation } from "../use-account-mutations";

const proxy = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("../../trpc", () => ({ useTRPC: () => proxy.current }));

describe("deleting the Account while Offline", () => {
  it("shows the failure and queues nothing", async () => {
    const enqueue = vi.fn(async () => ({}));
    const queryClient = createTestQueryClient();
    const adapter = fakePlatformAdapter();

    proxy.current = createTRPCOptionsProxy<AppRouter>({
      client: createTRPCClient<AppRouter>({
        links: [
          createOutboxLink<AppRouter>({
            store: { enqueue } as unknown as OutboxStore,
            owner: () => "reader-1",
            replayHeaderValue: "test-outbox",
          }),
          // The server cannot be reached.
          () => () => observable((observer) => observer.error(new TypeError("Failed to fetch"))),
        ],
      }),
      queryClient,
    });

    const { result } = renderHook(() => useDeleteAccountMutation(), {
      wrapper: createTestWrapper(queryClient, adapter),
    });

    act(() => result.current.deleteAccount());

    await waitFor(() => expect(adapter.showError).toHaveBeenCalledOnce());
    expect(enqueue).not.toHaveBeenCalled();
    expect(adapter.leave).not.toHaveBeenCalled();
  });
});
