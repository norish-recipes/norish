import { createMark } from "@/lib/mark";
import { offlineEngine } from "@/lib/offline/engine";

import { addRecent, parseRecents } from "./recent-searches";

const STORED_NAME = "recent-searches";
const { cache } = offlineEngine;

// Module scope: the tRPC provider remounts the tree when the session settles or ends.
const recents = createMark<string[]>([]);
let loadedFor: string | null = null;

type Edit = (list: string[]) => string[];

// The edits made while the owner's stored list loads, replayed over it once it arrives.
let loading: Edit[] | null = null;

/** Follows the owner whose data is open: its list is read from the device, and none is shown
 * without one, so a switch, sign-out or wipe empties it the moment it starts. */
function followOwner() {
  const owner = cache.ownerData.owner();

  if (owner === loadedFor) return;

  loadedFor = owner;
  loading = null;
  recents.set([]);

  if (!owner) return;

  const edits: Edit[] = [];

  loading = edits;

  void cache.ownerData
    .read<unknown>(owner, STORED_NAME)
    .catch(() => undefined)
    .then((stored) => {
      if (loading !== edits) return;

      loading = null;
      recents.set(edits.reduce((list, edit) => edit(list), parseRecents(stored)));
      if (edits.length > 0) save();
    });
}

cache.ownerData.subscribe(followOwner);
followOwner();

// Only to the owner the list was loaded for; the manager drops it once that owner closes.
function save() {
  if (loadedFor) void cache.ownerData.write(loadedFor, STORED_NAME, recents.get());
}

// With no owner's data open a confirm changes nothing, so no list shows that is stored nowhere.
function change(edit: Edit) {
  if (!loadedFor) return;

  recents.update(edit);
  if (loading) loading.push(edit);
  else save();
}

/** Keeps a confirmed text, newest first; re-running a Recent Search moves it to the top. */
export const addRecentSearch = (text: string) => change((list) => addRecent(list, text));

export const clearRecentSearches = () => change(() => []);

export const getRecentSearches = recents.get;

export const useRecentSearchList = recents.use;
