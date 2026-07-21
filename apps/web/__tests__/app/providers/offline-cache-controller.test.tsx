import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const resolveCacheOwner = vi.hoisted(() => vi.fn<() => Promise<void>>(() => Promise.resolve()));
const activeCacheOwner = vi.hoisted(() => vi.fn<() => string | null>(() => null));
const warmCache = vi.hoisted(() => vi.fn<() => Promise<void>>(() => Promise.resolve()));

let user: { id: string } | null = null;
let connectivity = { isLive: true, isOffline: false };

vi.mock("@/context/user-context", () => ({ useUserContext: () => ({ user }) }));
vi.mock("@/app/providers/connectivity-provider", () => ({ useConnectivity: () => connectivity }));
vi.mock("@/app/providers/trpc-provider", () => ({ useTRPC: () => ({}) }));
vi.mock("@/lib/query-cache", () => ({ resolveCacheOwner, activeCacheOwner, warmCache }));

import { OfflineCacheController } from "@/app/providers/offline-cache-controller";

function renderController() {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <OfflineCacheController>
        <div>child</div>
      </OfflineCacheController>
    </QueryClientProvider>
  );
}

describe("OfflineCacheController", () => {
  beforeEach(() => {
    resolveCacheOwner.mockClear();
    activeCacheOwner.mockReset().mockReturnValue(null);
    warmCache.mockClear();
    user = null;
    connectivity = { isLive: true, isOffline: false };
  });

  afterEach(() => cleanup());

  it("reconciles the cache owner from the current identity and connectivity", async () => {
    user = { id: "u1" };
    activeCacheOwner.mockReturnValue("u1");

    renderController();

    await waitFor(() =>
      expect(resolveCacheOwner).toHaveBeenCalledWith({ sessionUserId: "u1", isOffline: false })
    );
  });

  it("warms the Warm Set once an owner is settled while Live", async () => {
    user = { id: "u1" };
    activeCacheOwner.mockReturnValue("u1");

    renderController();

    await waitFor(() => expect(warmCache).toHaveBeenCalledTimes(1));
  });

  it("does not warm while Offline", async () => {
    user = { id: "u1" };
    connectivity = { isLive: false, isOffline: true };
    activeCacheOwner.mockReturnValue("u1");

    renderController();

    await waitFor(() =>
      expect(resolveCacheOwner).toHaveBeenCalledWith({ sessionUserId: "u1", isOffline: true })
    );
    expect(warmCache).not.toHaveBeenCalled();
  });

  it("does not warm before an owner is known (session unresolved)", async () => {
    user = null;
    activeCacheOwner.mockReturnValue(null);

    renderController();

    await waitFor(() =>
      expect(resolveCacheOwner).toHaveBeenCalledWith({ sessionUserId: null, isOffline: false })
    );
    expect(warmCache).not.toHaveBeenCalled();
  });
});
