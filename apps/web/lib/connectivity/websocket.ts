import type { WebConnectivityRuntime } from "@/lib/connectivity/runtime";
import { webConnectivityRuntime } from "@/lib/connectivity/runtime";

import { defaultGetWsUrl } from "@norish/shared-react/providers";

const BACKEND_UNAVAILABLE_CLOSE_CODE = 4000;
const BACKEND_UNAVAILABLE_CLOSE_REASON = "Backend unavailable";
const WEBSOCKET_CLOSING = 2;

function getActiveSockets(): Set<WebSocket> {
  if (typeof window === "undefined") return new Set();

  const browserGlobal = globalThis as typeof globalThis & {
    __norishActiveWebSockets?: Set<WebSocket>;
  };

  return (browserGlobal.__norishActiveWebSockets ??= new Set());
}

function disconnectSocket(socket: WebSocket): void {
  if (socket.readyState >= WEBSOCKET_CLOSING) return;

  try {
    socket.close(BACKEND_UNAVAILABLE_CLOSE_CODE, BACKEND_UNAVAILABLE_CLOSE_REASON);
  } catch {
    // The browser may finish closing a connecting socket before this callback runs.
  }
}

export function createWebSocketConnectivityController(
  runtime: WebConnectivityRuntime,
  resolveUrl: () => string = defaultGetWsUrl,
  resolveWebSocket: () => typeof WebSocket | undefined = () => globalThis.WebSocket
) {
  const activeSockets = getActiveSockets();
  const disconnectAll = () => {
    for (const socket of activeSockets) disconnectSocket(socket);
  };
  const canConnect = () => !runtime.isDegraded() || runtime.getSnapshot().recoveryInProgress;
  let wasConnectable = canConnect();
  const reconnectWaiters = new Set<() => void>();
  const releaseReconnectWaiters = () => {
    if (!canConnect()) return;

    for (const resolve of reconnectWaiters) resolve();
    reconnectWaiters.clear();
  };
  const unsubscribeRuntime = runtime.subscribe(() => {
    const isConnectable = canConnect();

    if (!isConnectable && wasConnectable) disconnectAll();
    if (isConnectable && !wasConnectable) releaseReconnectWaiters();
    wasConnectable = isConnectable;
  });
  const getUrl = (): string | Promise<string> => {
    if (canConnect()) return resolveUrl();

    return new Promise((resolve) => {
      reconnectWaiters.add(() => {
        resolve(resolveUrl());
      });
    });
  };
  const getWebSocketImpl = (): typeof WebSocket => {
    const DeferredWebSocket = class {} as unknown as typeof WebSocket;

    Object.defineProperties(DeferredWebSocket, {
      CONNECTING: { value: 0 },
      OPEN: { value: 1 },
      CLOSING: { value: 2 },
      CLOSED: { value: 3 },
    });

    return new Proxy(DeferredWebSocket, {
      construct(_Target, argumentsList) {
        const NativeWebSocket = resolveWebSocket();

        if (!NativeWebSocket) {
          throw new Error("WebSocket is unavailable in this environment");
        }

        const socket = Reflect.construct(NativeWebSocket, argumentsList) as WebSocket;

        activeSockets.add(socket);
        socket.addEventListener("close", () => activeSockets.delete(socket), { once: true });
        if (!canConnect()) disconnectSocket(socket);

        return socket;
      },
    });
  };
  const dispose = (): void => {
    unsubscribeRuntime();
    reconnectWaiters.clear();
  };

  return { dispose, getUrl, getWebSocketImpl };
}

export const webSocketConnectivity = createWebSocketConnectivityController(webConnectivityRuntime);
