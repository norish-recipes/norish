import type { WebReadCacheChange } from "@/lib/offline-read-cache/types";

const CHANGE_EVENT = "norish:web-read-cache-changed";
const CHANGE_CHANNEL = "norish-web-read-cache";

type ChangeListener = (change: WebReadCacheChange) => void;

function dispatchSameTab(change: WebReadCacheChange): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent<WebReadCacheChange>(CHANGE_EVENT, { detail: change }));
}

export function notifyWebReadCacheChanged(change: WebReadCacheChange): void {
  dispatchSameTab(change);

  if (typeof BroadcastChannel === "undefined") return;

  const channel = new BroadcastChannel(CHANGE_CHANNEL);

  channel.postMessage(change);
  channel.close();
}

export function subscribeToWebReadCacheChanges(listener: ChangeListener): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onWindowChange = (event: Event) => {
    listener((event as CustomEvent<WebReadCacheChange>).detail);
  };
  const channel =
    typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANGE_CHANNEL);

  window.addEventListener(CHANGE_EVENT, onWindowChange);
  if (channel)
    channel.onmessage = (event: MessageEvent<WebReadCacheChange>) => listener(event.data);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onWindowChange);
    channel?.close();
  };
}
