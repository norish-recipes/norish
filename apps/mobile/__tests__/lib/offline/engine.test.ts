import { offlineEngine, subscribeDeviceHints } from "@/lib/offline/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The wiring builds the engine at import; its native and transport modules stay out of node.
vi.mock("react-native-mmkv", () => ({ createMMKV: () => ({ getString: () => undefined }) }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { version: "0.0.0-test" } } }));
vi.mock("expo-file-system", () => ({}));
vi.mock("@/lib/auth/auth-client", () => ({}));
vi.mock("@/lib/network/server-address", () => ({
  subscribeServerAddressChange: (listener: () => void) => serverAddressListeners.add(listener),
}));
vi.mock("@norish/shared-react/trpc", () => ({}));

const serverAddressListeners = vi.hoisted(() => new Set<() => void>());
const native = vi.hoisted(() => ({
  network: new Set<(event: { isConnected: boolean }) => void>(),
  appState: new Set<(state: string) => void>(),
}));

vi.mock("expo-network", () => ({
  addNetworkStateListener: (listener: (event: { isConnected: boolean }) => void) => {
    native.network.add(listener);

    return { remove: () => native.network.delete(listener) };
  },
}));

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_type: "change", listener: (state: string) => void) => {
      native.appState.add(listener);

      return { remove: () => native.appState.delete(listener) };
    },
  },
}));

const networkChanges = (isConnected: boolean) => {
  for (const listener of native.network) listener({ isConnected });
};
const appBecomes = (state: string) => {
  for (const listener of native.appState) listener(state);
};

describe("subscribeDeviceHints", () => {
  beforeEach(() => {
    native.network.clear();
    native.appState.clear();
  });

  it("asks for a probe whenever the device's network changes, either way", () => {
    const probeNow = vi.fn();

    subscribeDeviceHints(probeNow);
    networkChanges(false);
    networkChanges(true);

    expect(probeNow).toHaveBeenCalledTimes(2);
  });

  it("asks for a probe when the app comes back to the foreground", () => {
    const probeNow = vi.fn();

    subscribeDeviceHints(probeNow);
    appBecomes("background");
    appBecomes("active");

    expect(probeNow).toHaveBeenCalledTimes(1);
  });

  it("stops asking once unsubscribed", () => {
    const probeNow = vi.fn();

    subscribeDeviceHints(probeNow)();
    networkChanges(true);
    appBecomes("active");

    expect(probeNow).not.toHaveBeenCalled();
  });
});

describe("a Server Address change", () => {
  it("drops every cached answer, so one server's is never shown for another", () => {
    offlineEngine.queryClient.setQueryData([["config", "authProviders"], { type: "query" }], {
      providers: [],
    });

    for (const listener of serverAddressListeners) listener();

    expect(offlineEngine.queryClient.getQueryCache().getAll()).toEqual([]);
  });
});
