// @vitest-environment jsdom
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformSession, SessionScope } from "@norish/shared-react/platform";

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
  endSession: null as ((scope: SessionScope) => Promise<void>) | null,
  releaseSignOut: () => {},
  leave: () => {},
  // How many sessions the platform had been handed when the offline clear and the leave ran.
  clearedAt: [] as { discardQueue: boolean; at: number }[],
  leftAt: -1,
}));

vi.mock("expo-file-system", () => ({ Paths: { appleSharedContainers: {} } }));
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
vi.mock("@/lib/platform/platform-provider", async () => {
  const { PlatformProvider } = await import("@norish/shared-react/platform");
  const { fakePlatformAdapter } = await import("@norish/shared-react/platform/testing");

  return {
    MobilePlatformProvider: (props: {
      children: ReactNode;
      session: PlatformSession;
      endSession: (scope: SessionScope) => Promise<void>;
    }) => {
      seen.sessions.push(props.session);
      seen.endSession = props.endSession;

      // The real adapter's sequence steps: the offline clear, and leave as publishSignedOut.
      const adapter = {
        ...fakePlatformAdapter(),
        session: props.session,
        endSession: props.endSession,
        leave: () => {
          seen.leftAt = seen.sessions.length;
          seen.leave();
        },
        offlineEngine: {
          clearForSignOut: async ({ discardQueue }: { discardQueue: boolean }) =>
            void seen.clearedAt.push({ discardQueue, at: seen.sessions.length }),
        },
      };

      return <PlatformProvider adapter={adapter}>{props.children}</PlatformProvider>;
    },
  };
});

const { AuthProviders } = await import("@/lib/auth/auth-providers");
const { getAuthTransportSnapshot, publishSignedOut, SESSION_END_FADE_MS, subscribeAuthTransport } =
  await import("@/lib/auth/auth-session-sync");
const { AUTH_COOKIE_KEY, authStorage } = await import("@/lib/auth/auth-storage");
const { ServerAddressContext } = await import("@/lib/network/server-address");
const { resetAuthClientStorage } = await import("@/lib/auth/auth-client");

seen.leave = () => publishSignedOut("https://norish.test");

const USER = { id: "reader-1", email: "reader@norish.test", name: "Reader" };
const PENDING = { user: null, isPending: true };
const SIGNED_OUT = { user: null, isPending: false };

/** Remounts on each re-key, as the `TrpcProvider` key does. */
function ReKeyed() {
  const { version } = useSyncExternalStore(subscribeAuthTransport, getAuthTransportSnapshot);

  return (
    <ServerAddressContext value="https://norish.test">
      <AuthProviders key={version}>{null}</AuthProviders>
    </ServerAddressContext>
  );
}

describe("AuthProviders", () => {
  beforeEach(async () => {
    // A fresh client per test, as after a sign-out.
    await resetAuthClientStorage();
    secureStore.items.clear();
    clients.length = 0;
    seen.sessions.length = 0;
    seen.clearedAt.length = 0;
    seen.leftAt = -1;
    // The persisted session an Offline launch falls back on.
    await authStorage().setItemAsync(AUTH_COOKIE_KEY, JSON.stringify({ token: { value: "t" } }));
    await authStorage().setItemAsync("norish_session_data", JSON.stringify({ user: USER }));
  });

  it.each<SessionScope>(["everywhere", "device"])(
    "ending it %s, reads pending until it leaves, then signed out after one re-key",
    async (scope) => {
      render(<ReKeyed />);
      // A launch opens on the persisted session until the server answers.
      await waitFor(() => expect(seen.sessions.at(-1)?.user?.id).toBe(USER.id));
      act(() => clients[0]?.session.set({ data: { user: USER }, isPending: false, error: null }));
      await waitFor(() => expect(getAuthTransportSnapshot().hasActiveSession).toBe(true));

      const { version } = getAuthTransportSnapshot();
      const from = seen.sessions.length;
      let ending = Promise.resolve();

      act(() => void (ending = seen.endSession?.(scope) ?? ending));
      // The signed-in screen fades out first, still signed in.
      expect(seen.sessions.at(-1)?.user?.id).toBe(USER.id);
      // Once the signed-in screen has faded out, a sign-out waits on the server, with the old
      // client's store already empty.
      await act(() => new Promise((resolve) => setTimeout(resolve, SESSION_END_FADE_MS + 10)));
      expect(seen.sessions.length).toBeGreaterThan(from);
      expect(seen.sessions.slice(from)).toEqual(seen.sessions.slice(from).map(() => PENDING));

      seen.releaseSignOut();
      await act(() => ending);
      expect(seen.sessions.slice(from)).toEqual(seen.sessions.slice(from).map(() => PENDING));

      // The adapter's leave, after the offline clear.
      act(() => publishSignedOut("https://norish.test"));
      await waitFor(() => expect(seen.sessions.at(-1)).toEqual(SIGNED_OUT));
      expect(seen.sessions.slice(from).filter((session) => session.user)).toEqual([]);
      expect(getAuthTransportSnapshot()).toEqual({
        hasActiveSession: false,
        version: version + 1,
      });
      // The sequence in flight owns the clear: the emptied store starts no Session Expiry.
      expect(seen.clearedAt).toEqual([]);
    }
  );

  it.each([
    ["answers 401", { data: null, isPending: false, error: { status: 401 } }],
    ["answers with no session", { data: null, isPending: false, error: null }],
  ])(
    "when auth's own session read %s while signed in, runs Session Expiry before sign-in shows",
    async (_, ended) => {
      render(<ReKeyed />);
      act(() => clients[0]?.session.set({ data: { user: USER }, isPending: false, error: null }));
      await waitFor(() => expect(getAuthTransportSnapshot().hasActiveSession).toBe(true));

      const { version } = getAuthTransportSnapshot();
      const from = seen.sessions.length;

      // No tRPC request has been answered 401 yet.
      act(() => clients[0]?.session.set(ended));
      // The signed-in screen stays mounted through its fade-out, as on a Sign-out.
      expect(seen.sessions.at(-1)?.user?.id).toBe(USER.id);

      await waitFor(() => expect(seen.sessions.at(-1)).toEqual(SIGNED_OUT));
      expect(seen.clearedAt).toEqual([{ discardQueue: false, at: expect.any(Number) }]);

      const cleared = seen.clearedAt[0]?.at ?? 0;
      const ending = seen.sessions.slice(from, seen.leftAt);
      const firstPending = ending.findIndex((session) => session.isPending);

      expect(cleared).toBeLessThanOrEqual(seen.leftAt);
      // Signed in until the fade ends, then pending until leave; never signed in again.
      expect(firstPending).toBeGreaterThan(0);
      expect(ending.slice(0, firstPending).every((session) => session.user?.id === USER.id)).toBe(
        true
      );
      expect(ending.slice(firstPending)).toEqual(ending.slice(firstPending).map(() => PENDING));
      expect(getAuthTransportSnapshot()).toEqual({
        hasActiveSession: false,
        version: version + 1,
      });
    }
  );

  /** Signed in, then the session store moves to `next`; answers the sessions handed on since. */
  async function afterSignedIn(next: SessionState) {
    render(<ReKeyed />);
    act(() => clients[0]?.session.set({ data: { user: USER }, isPending: false, error: null }));
    await waitFor(() => expect(getAuthTransportSnapshot().hasActiveSession).toBe(true));

    const { version } = getAuthTransportSnapshot();
    const from = seen.sessions.length;

    act(() => clients[0]?.session.set(next));
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

    expect(seen.clearedAt).toEqual([]);
    expect(getAuthTransportSnapshot()).toEqual({
      hasActiveSession: true,
      version,
    });

    return seen.sessions.slice(from);
  }

  // better-auth keeps the last session through both.
  it.each([
    ["a non-401 error", { data: { user: USER }, isPending: false, error: { status: 500 } }],
    ["a pending re-read", { data: { user: USER }, isPending: false, error: null }],
  ])("leaves a signed-in session alone on %s", async (_, unsettled) => {
    const sessions = await afterSignedIn(unsettled);

    expect(sessions.every((session) => session.user?.id === USER.id && !session.isPending)).toBe(
      true
    );
  });

  // The detector reads only the server's answer, not what better-auth happens to keep.
  it.each([
    ["a non-401 error", { data: null, isPending: false, error: { status: 500 } }],
    ["a pending re-read", { data: null, isPending: true, error: null }],
  ])("starts no Session Expiry on %s without a kept session", async (_, unsettled) => {
    // Signed in on this launch: no persisted session to fall back on.
    secureStore.items.clear();
    await afterSignedIn(unsettled);
  });

  it("reads a 401 as signed out, not as a reason to fall back on the persisted session", async () => {
    render(<ReKeyed />);
    act(() => clients[0]?.session.set({ data: null, isPending: false, error: { status: 401 } }));

    await waitFor(() => expect(seen.sessions.at(-1)).toEqual(SIGNED_OUT));
    expect(seen.sessions.filter((session) => session.user)).toEqual([]);
  });
});
