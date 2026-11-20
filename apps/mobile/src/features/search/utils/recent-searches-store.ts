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

/** Follows the owner whose data is open: its list is read from the device, and none is shown
 * without one, so a switch, sign-out or wipe empties it the moment it starts. */
function followOwner() {
  const owner = cache.ownerData.owner();

  if (owner === loadedFor) return;

  loadedFor = owner;
  publish([]);

  if (!owner) return;

  void cache.ownerData.read<unknown>(owner, STORED_NAME).then((stored) => {
    if (loadedFor === owner) publish(parseRecents(stored));
  });
}

cache.ownerData.subscribe(followOwner);
followOwner();

// Only to the owner the list was loaded for; the manager drops it once that owner closes.
const save = () => {
  if (loadedFor) void cache.ownerData.write(loadedFor, STORED_NAME, recents);
};

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
