import { WebConnectivityRuntime } from "@/lib/connectivity/runtime";
import { createWebSocketConnectivityController } from "@/lib/connectivity/websocket";

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = FakeWebSocket.OPEN;
  close = vi.fn((code?: number, _reason?: string) => {
    if (code !== undefined && code !== 1000 && (code < 3000 || code > 4999)) {
      throw new DOMException("Invalid WebSocket close code", "InvalidAccessError");
    }

    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  });

  constructor(_url: string | URL, _protocols?: string | string[]) {
    super();
  }
}

describe("web WebSocket connectivity", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("disconnects while degraded and allows reconnect as soon as recovery starts", async () => {
    let resolveRecovery!: (value: boolean) => void;
    const runtime = new WebConnectivityRuntime("development", window.localStorage);
    const recovery = new Promise<boolean>((resolve) => {
      resolveRecovery = resolve;
    });
    const stop = runtime.start(() => recovery);

    runtime.reportHttpSuccess();

    const controller = createWebSocketConnectivityController(
      runtime,
      () => "ws://norish.test/trpc",
      () => FakeWebSocket as unknown as typeof WebSocket
    );
    const ControlledWebSocket = controller.getWebSocketImpl();

    if (!ControlledWebSocket) throw new Error("Expected a controlled WebSocket constructor");

    const socket = new ControlledWebSocket("ws://norish.test/trpc") as unknown as FakeWebSocket;

    await expect(runtime.setSimulatedBackendUnavailable(true)).resolves.toBe(true);
    expect(socket.close).toHaveBeenCalledWith(4000, "Backend unavailable");

    const pendingUrl = controller.getUrl();
    let urlResolved = false;

    void Promise.resolve(pendingUrl).then(() => {
      urlResolved = true;
    });

    const disabling = runtime.setSimulatedBackendUnavailable(false);

    await expect(pendingUrl).resolves.toBe("ws://norish.test/trpc");
    expect(urlResolved).toBe(true);
    expect(runtime.getSnapshot()).toMatchObject({
      recoveryInProgress: true,
      state: "backend-unreachable",
    });

    resolveRecovery(true);

    await expect(disabling).resolves.toBe(true);

    controller.dispose();
    stop();
  });

  it("suspends a parallel reconnect again when HTTP recovery fails", async () => {
    let resolveRecovery!: (value: boolean) => void;
    const runtime = new WebConnectivityRuntime("development", window.localStorage);
    const recovery = new Promise<boolean>((resolve) => {
      resolveRecovery = resolve;
    });
    const stop = runtime.start(() => recovery);

    runtime.reportHttpSuccess();

    const controller = createWebSocketConnectivityController(
      runtime,
      () => "ws://norish.test/trpc",
      () => FakeWebSocket as unknown as typeof WebSocket
    );
    const ControlledWebSocket = controller.getWebSocketImpl();

    await runtime.setSimulatedBackendUnavailable(true);
    const pendingUrl = controller.getUrl();
    const disabling = runtime.setSimulatedBackendUnavailable(false);

    await expect(pendingUrl).resolves.toBe("ws://norish.test/trpc");

    const reconnectingSocket = new ControlledWebSocket(
      "ws://norish.test/trpc"
    ) as unknown as FakeWebSocket;

    expect(reconnectingSocket.close).not.toHaveBeenCalled();
    resolveRecovery(false);

    await expect(disabling).resolves.toBe(false);
    expect(reconnectingSocket.close).toHaveBeenCalledWith(4000, "Backend unavailable");
    expect(runtime.getSnapshot()).toMatchObject({
      recoveryInProgress: false,
      state: "backend-unreachable",
    });

    controller.dispose();
    stop();
  });
});
