// @vitest-environment jsdom
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
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
  releaseSignOut: () => {},
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
    clients.push({ session });

    // As better-auth's expo client: the store empties when the call starts, then the server is slow.
    const signOut = () => {
      session.set({ data: null, isPending: false, error: null });

      return new Promise((resolve) => (seen.releaseSignOut = () => resolve(null)));
    };

    return { $store: { atoms: { session } }, signOut };
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
const { getAuthTransportSnapshot, publishSignedOut, subscribeAuthTransport } =
  await import("@/lib/auth/auth-session-sync");
const { AUTH_COOKIE_KEY, authStorage } = await import("@/lib/auth/auth-storage");
const { BackendBaseUrlContext } = await import("@/lib/network/backend-base-url");
const { resetAuthClientStorage } = await import("@/lib/auth/auth-client");

const USER = { id: "reader-1", email: "reader@norish.test", name: "Reader" };
const PENDING = { user: null, isPending: true };
const SIGNED_OUT = { user: null, isPending: false };

/** Remounts on each re-key, as the `TrpcProvider` key does. */
function ReKeyed() {
  const { version } = useSyncExternalStore(subscribeAuthTransport, getAuthTransportSnapshot);

  return (
    <BackendBaseUrlContext value="https://norish.test">
      <AuthProviders key={version}>{null}</AuthProviders>
    </BackendBaseUrlContext>
  );
}

describe("AuthProviders", () => {
  beforeEach(async () => {
    // A fresh client per test, as after a sign-out.
    await resetAuthClientStorage();
    secureStore.items.clear();
    clients.length = 0;
    seen.sessions.length = 0;
    // The persisted session an Offline launch falls back on.
    await authStorage.setItemAsync(AUTH_COOKIE_KEY, JSON.stringify({ token: { value: "t" } }));
    await authStorage.setItemAsync("norish_session_data", JSON.stringify({ user: USER }));
  });

  it.each<LeaveReason>(["sign-out", "expiry"])(
    "on %s, reads pending until it leaves, then signed out after one re-key",
    async (reason) => {
      render(<ReKeyed />);
      // A launch opens on the persisted session until the server answers.
      await waitFor(() => expect(seen.sessions.at(-1)?.user?.id).toBe(USER.id));
      act(() => clients[0]?.session.set({ data: { user: USER }, isPending: false, error: null }));
      await waitFor(() => expect(getAuthTransportSnapshot().hasActiveSession).toBe(true));

      const { version } = getAuthTransportSnapshot();
      const from = seen.sessions.length;
      let ending = Promise.resolve();

      act(() => void (ending = seen.endSession?.(reason) ?? ending));
      // A sign-out now waits on the server, with the old client's store already empty.
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
      expect(seen.sessions.length).toBeGreaterThan(from);
      expect(seen.sessions.slice(from)).toEqual(seen.sessions.slice(from).map(() => PENDING));

      seen.releaseSignOut();
      await act(() => ending);
      expect(seen.sessions.slice(from)).toEqual(seen.sessions.slice(from).map(() => PENDING));

      // The adapter's leave, after the offline clear.
      act(() => publishSignedOut());
      await waitFor(() => expect(seen.sessions.at(-1)).toEqual(SIGNED_OUT));
      expect(seen.sessions.slice(from).filter((session) => session.user)).toEqual([]);
      expect(getAuthTransportSnapshot()).toEqual({ hasActiveSession: false, version: version + 1 });
    }
  );

  it("reads a 401 as signed out, not as a reason to fall back on the persisted session", async () => {
    render(<ReKeyed />);
    act(() => clients[0]?.session.set({ data: null, isPending: false, error: { status: 401 } }));

    await waitFor(() => expect(seen.sessions.at(-1)).toEqual(SIGNED_OUT));
    expect(seen.sessions.filter((session) => session.user)).toEqual([]);
  });
});
