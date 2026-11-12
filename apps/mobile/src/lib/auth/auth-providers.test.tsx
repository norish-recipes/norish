// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeaveReason, PlatformSession } from "@norish/shared-react/platform";

type SessionState = {
  data: { user: object } | null;
  isPending: boolean;
  error: { status: number } | null;
};

// SecureStore in memory, so the auth client's chunked writes read back as written.
const secureStore = vi.hoisted(() => {
  const items = new Map<string, string>();

  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    setItemAsync: async (key: string, value: string) => void items.set(key, value),
    deleteItemAsync: async (key: string) => void items.delete(key),
  };
});
// Each client's session store starts pending, as better-auth's does; nothing answers it here.
const clients = vi.hoisted(
  () => [] as { session: { get: () => SessionState; set: (value: SessionState) => void } }[]
);
const seen = vi.hoisted(() => ({
  sessions: [] as PlatformSession[],
  endSession: null as ((reason: LeaveReason) => Promise<void>) | null,
}));

vi.mock("expo-secure-store", () => secureStore);
vi.mock("expo-constants", () => ({ default: {} }));
vi.mock("expo-linking", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, AppState: {} }));
vi.mock("@better-auth/expo/client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  expoClient: () => ({}),
}));
vi.mock("better-auth/react", () => ({
  createAuthClient: () => {
    let value: SessionState = { data: null, isPending: true, error: null };
    const listeners = new Set<(value: SessionState) => void>();
    const session = {
      get: () => value,
      listen: (listener: (value: SessionState) => void) => {
        listeners.add(listener);

        return () => void listeners.delete(listener);
      },
      set: (next: SessionState) => {
        value = next;
        for (const listener of listeners) listener(value);
      },
    };
    // Offline: the server never answers, so the store keeps the user.
    clients.push({ session });

    return { $store: { atoms: { session } }, signOut: () => Promise.reject(new Error("offline")) };
  },
}));
vi.mock("@/lib/trpc/trpc-provider", () => ({ closeMobileTrpcConnections: async () => {} }));
vi.mock("@norish/shared-react/offline/react", () => ({
  useConnectivity: () => ({ isOffline: false }),
}));
vi.mock("@/lib/i18n/mobile-i18n-context", () => ({
  MobileIntlProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/platform/platform-provider", () => ({
  MobilePlatformProvider: (props: {
    children: ReactNode;
    session: PlatformSession;
    endSession: (reason: LeaveReason) => Promise<void>;
  }) => {
    seen.sessions.push(props.session);
    seen.endSession = props.endSession;

    return props.children;
  },
}));

const { AuthProviders } = await import("@/lib/auth/auth-providers");
const { subscribeAuthClientReset } = await import("@/lib/auth/auth-client");
const { getAuthTransportSnapshot } = await import("@/lib/auth/auth-session-sync");
const { AUTH_COOKIE_KEY, authStorage } = await import("@/lib/auth/auth-storage");
const { saveBackendBaseUrl } = await import("@/lib/network/backend-base-url");

const USER = { id: "reader-1", email: "reader@norish.test", name: "Reader" };

describe("AuthProviders", () => {
  beforeEach(async () => {
    secureStore.items.clear();
    await saveBackendBaseUrl("https://norish.test");
    clients.length = 0;
    seen.sessions.length = 0;
    // The persisted session an Offline launch falls back on.
    await authStorage.setItemAsync(AUTH_COOKIE_KEY, JSON.stringify({ token: { value: "t" } }));
    await authStorage.setItemAsync("norish_session_data", JSON.stringify({ user: USER }));
  });

  it.each<LeaveReason>(["sign-out", "expiry"])(
    "on %s, with the old session store still holding the user, never reads signed in again",
    async (reason) => {
      render(<AuthProviders>{null}</AuthProviders>);
      // A launch opens on the persisted session until the server answers.
      await waitFor(() => expect(seen.sessions.at(-1)?.user?.id).toBe(USER.id));
      act(() => clients[0]?.session.set({ data: { user: USER }, isPending: false, error: null }));
      await waitFor(() => expect(getAuthTransportSnapshot().hasActiveSession).toBe(true));

      let resetAt = -1;
      const unsubscribe = subscribeAuthClientReset(() => (resetAt = seen.sessions.length));

      await act(() => seen.endSession?.(reason));
      unsubscribe();

      await waitFor(() => expect(seen.sessions.at(-1)).toEqual({ user: null, isPending: false }));
      expect(resetAt).toBeGreaterThan(0);
      expect(seen.sessions.slice(resetAt).filter((session) => session.user)).toEqual([]);
      // The old client's store still holds the user; nothing reads it any more.
      expect(clients[0]?.session.get().data).toEqual({ user: USER });
      // The route guard's signal: the tRPC re-key and RootStack go to (auth).
      expect(getAuthTransportSnapshot().hasActiveSession).toBe(false);
    }
  );

  it("reads a 401 as signed out, not as a reason to fall back on the persisted session", async () => {
    render(<AuthProviders>{null}</AuthProviders>);
    act(() => clients[0]?.session.set({ data: null, isPending: false, error: { status: 401 } }));

    await waitFor(() => expect(seen.sessions.at(-1)).toEqual({ user: null, isPending: false }));
    expect(seen.sessions.filter((session) => session.user)).toEqual([]);
  });
});
