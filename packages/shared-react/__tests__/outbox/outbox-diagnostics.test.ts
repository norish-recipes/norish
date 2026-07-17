import {
  notifyWebOutboxChanged,
  subscribeToWebOutboxChanges,
  WEB_OUTBOX_CHANGE_EVENT,
} from "../../src/outbox/outbox-diagnostics";

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];

  onmessage: ((event: MessageEvent<{ sourceId?: string }>) => void) | null = null;
  readonly name: string;
  closed = false;
  posted: unknown[] = [];

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(value: unknown) {
    this.posted.push(value);
  }

  close() {
    this.closed = true;
  }
}

describe("web outbox change notifications", () => {
  beforeEach(() => {
    MockBroadcastChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes in the same tab and publishes a cross-tab message", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToWebOutboxChanges(listener);

    notifyWebOutboxChanged();

    expect(listener).toHaveBeenCalledOnce();
    expect(MockBroadcastChannel.instances).toHaveLength(2);
    expect(MockBroadcastChannel.instances[1]?.posted).toHaveLength(1);
    expect(MockBroadcastChannel.instances[1]?.closed).toBe(true);

    unsubscribe();
    expect(MockBroadcastChannel.instances[0]?.closed).toBe(true);
  });

  it("refreshes for a foreign-tab message and unsubscribes from the window fallback", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToWebOutboxChanges(listener);
    const subscriber = MockBroadcastChannel.instances[0];

    subscriber?.onmessage?.(new MessageEvent("message", { data: { sourceId: "different-tab" } }));
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    window.dispatchEvent(new Event(WEB_OUTBOX_CHANGE_EVENT));
    expect(listener).toHaveBeenCalledOnce();
  });
});
