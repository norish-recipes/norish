// The offline engine's storage in one MMKV instance (superjson values, so a Date stays a Date);
// uploads are copied into app storage and referenced by path until their entry goes.

import type { MMKV } from "react-native-mmkv";
import superjson from "superjson";

import type { OfflineStorage, OutboxEntry } from "@norish/shared-react/offline";
import { isEncodedFormData } from "@norish/shared-react/offline";

export type MmkvLike = Pick<MMKV, "getString" | "getNumber" | "set" | "remove" | "getAllKeys">;

/** The upload copies in the app's own storage (expo-file-system at runtime), by file name. */
export interface UploadFileStore {
  /** Copy the file at `from` into app storage as `name`. */
  copy(from: string, name: string): Promise<void>;
  /** The copy's current uri: iOS moves the app's container on update, so only names are stored. */
  uri(name: string): string;
  /** Delete a copy; a missing file is not an error. */
  delete(name: string): void | Promise<void>;
}

/** A React Native FormData upload part. */
type Upload = { uri: string; name?: string; type?: string };

const LAST_OWNER_KEY = "last-owner";
const NEXT_SEQ_KEY = "outbox-next-seq";
const OUTBOX_PREFIX = "outbox:";
const KEYVAL_PREFIX = "keyval:";

const isUpload = (value: unknown): value is Upload =>
  typeof value === "object" && value !== null && typeof (value as Upload).uri === "string";

const fileName = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

/** Rewrite every upload part's uri, leaving any other input as it is. */
function mapUploads(input: unknown, map: (uri: string) => string): unknown {
  if (!isEncodedFormData(input)) {
    return input;
  }

  return {
    ...input,
    entries: input.entries.map(([key, value]: [string, unknown]) => [
      key,
      isUpload(value) ? { ...value, uri: map(value.uri) } : value,
    ]),
  };
}

function storedNames(input: unknown): string[] {
  return isEncodedFormData(input)
    ? input.entries.flatMap(([, value]) => (isUpload(value) ? [value.uri] : []))
    : [];
}

export function createMmkvStorage({
  mmkv,
  files,
}: {
  mmkv: MmkvLike;
  files: UploadFileStore;
}): OfflineStorage {
  const read = <T>(key: string): T | undefined => {
    const raw = mmkv.getString(key);

    return raw === undefined ? undefined : superjson.parse<T>(raw);
  };
  const write = (key: string, value: unknown) => mmkv.set(key, superjson.stringify(value));
  const keysWith = (prefix: string) => mmkv.getAllKeys().filter((key) => key.startsWith(prefix));
  // Async, so a delete that throws synchronously settles like one that rejects.
  const deleteCopies = (names: string[]) =>
    Promise.allSettled(names.map(async (name) => files.delete(name)));

  // Stored entries name their copies; the engine sees them with the copies' current uris.
  const readEntry = (key: string): OutboxEntry | undefined => {
    const entry = read<OutboxEntry>(key);

    return entry && { ...entry, input: mapUploads(entry.input, files.uri) };
  };
  const writeEntry = (entry: OutboxEntry) =>
    write(OUTBOX_PREFIX + entry.seq, { ...entry, input: mapUploads(entry.input, fileName) });

  /** Copy every upload into app storage; rejects, leaving no copy behind, if one can't be. */
  async function copyUploads(input: unknown, seq: number) {
    const names: string[] = [];

    if (!isEncodedFormData(input)) {
      return { input, names };
    }

    const entries: [string, unknown][] = [];

    try {
      for (const [index, [key, value]] of input.entries.entries()) {
        if (typeof value === "string") {
          entries.push([key, value]);
          continue;
        }

        if (!isUpload(value)) {
          throw new Error(`Outbox upload "${key}" has no file uri to copy`);
        }

        const name = `${seq}-${index}${/\.\w+$/.exec(value.uri)?.[0] ?? ""}`;

        await files.copy(value.uri, name);
        names.push(name);
        // Read field by field: a native File's fields are getters, which a spread would drop.
        entries.push([key, { uri: name, name: value.name, type: value.type }]);
      }
    } catch (error) {
      await deleteCopies(names);
      throw error;
    }

    return { input: { ...input, entries }, names };
  }

  async function store(entry: Omit<OutboxEntry, "seq">, seq: number) {
    const { input, names } = await copyUploads(entry.input, seq);

    try {
      write(OUTBOX_PREFIX + seq, { ...entry, input, seq });
    } catch (error) {
      await deleteCopies(names);
      throw error;
    }

    return seq;
  }

  // Each add lands after the one before it, so a slow upload copy can't let a later entry replay
  // first (IndexedDB gets this from its single transaction).
  let adding: Promise<unknown> = Promise.resolve();

  return {
    lastOwner: {
      get: () => mmkv.getString(LAST_OWNER_KEY) || null,
      set: (ownerId) => {
        if (ownerId) {
          mmkv.set(LAST_OWNER_KEY, ownerId);
        } else {
          mmkv.remove(LAST_OWNER_KEY);
        }
      },
    },
    keyval: {
      get: async (key) => read(KEYVAL_PREFIX + key),
      set: async (key, value) => write(KEYVAL_PREFIX + key, value),
      del: async (key) => {
        mmkv.remove(KEYVAL_PREFIX + key);
      },
      keys: async () => keysWith(KEYVAL_PREFIX).map((key) => key.slice(KEYVAL_PREFIX.length)),
    },
    outbox: {
      add(entry) {
        // Reserved before any await so concurrent adds never share a seq; a failed add burns it.
        const seq = mmkv.getNumber(NEXT_SEQ_KEY) ?? 1;

        mmkv.set(NEXT_SEQ_KEY, seq + 1);

        const added = adding.then(() => store(entry, seq));

        adding = added.catch(() => undefined);

        return added;
      },
      all: async () =>
        keysWith(OUTBOX_PREFIX)
          .map((key) => readEntry(key)!)
          .sort((a, b) => a.seq - b.seq),
      get: async (seq) => readEntry(OUTBOX_PREFIX + seq),
      put: async (entry) => writeEntry(entry),
      async remove(seq) {
        const names = storedNames(read<OutboxEntry>(OUTBOX_PREFIX + seq)?.input);

        mmkv.remove(OUTBOX_PREFIX + seq);
        // Best effort: the entry is already gone, and a stray copy must not fail a Replay.
        await deleteCopies(names);
      },
    },
  };
}
