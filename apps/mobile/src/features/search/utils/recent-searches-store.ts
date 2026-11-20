import { offlineEngine } from "@/lib/offline/engine";

import { addRecent, parseRecents } from "./recent-searches";

const STORED_NAME = "recent-searches";
const { cache } = offlineEngine;

// Module scope: the tRPC provider remounts the tree when the session settles or ends.
let recents: string[] = [];
let loadedFor: string | null = null;
const listeners = new Set<() => void>();

function publish(next: string[]) {
  recents = next;
  listeners.forEach((listener) => listener());
}

/** Follows the signed-in account: its list is read from the device, and none is shown without one. */
function followOwner() {
  const owner = cache.owner();

  if (owner === loadedFor) return;

  loadedFor = owner;
  publish([]);

  if (!owner) return;

  void cache.ownerData.read<unknown>(STORED_NAME).then((stored) => {
    if (loadedFor === owner) publish(parseRecents(stored));
  });
}

// A sign-out or account switch empties the Offline Cache's owner data and applies a new owner.
cache.subscribe(followOwner);
followOwner();

const save = () => void cache.ownerData.write(STORED_NAME, recents);

/** Keeps a confirmed text, newest first. */
export function addRecentSearch(text: string) {
  publish(addRecent(recents, text));
  save();
}

export function clearRecentSearches() {
  publish([]);
  save();
}

export const getRecentSearches = () => recents;

export function subscribeRecentSearches(listener: () => void) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}
