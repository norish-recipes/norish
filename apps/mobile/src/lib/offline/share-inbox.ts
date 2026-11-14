import { z } from "zod";

import type { ImportSettled } from "@norish/shared-react/recipes";
import { classifyReplayError } from "@norish/shared-react/offline";
import { MAX_OCR_FILES } from "@norish/shared/contracts/uploads";
import { createClientLogger } from "@norish/shared/lib/logger";
import { isQueuedOutboxSignal } from "@norish/shared/lib/trpc-errors";

const log = createClientLogger("share-inbox");

// The signed-in user who shared it, the id the Outbox's entries carry as their owner.
const owner = { ownerId: z.string().min(1) };

/** What the Share Extension saved while the server was unreachable (`ShareInbox.swift`). */
const savedShareSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.string().min(1), ...owner }),
  z.object({ kind: z.literal("text"), text: z.string().min(1), ...owner }),
  z.object({
    kind: z.literal("images"),
    // Bare names in the inbox folder, never a path out of it.
    images: z
      .array(z.string().regex(/^[\w-]+\.jpg$/))
      .min(1)
      .max(MAX_OCR_FILES),
    ...owner,
  }),
]);

/** The App Group's `share-inbox` folder. */
export type ShareInbox = {
  /** The saved items' ids, oldest first. */
  ids: () => string[];
  /** The item's JSON, or null when it cannot be read. */
  read: (id: string) => Promise<string | null>;
  /** A saved image, or null when it is missing. */
  image: (name: string) => Blob | null;
  /** Deletes the item's JSON and its images. */
  remove: (id: string) => void;
};

/** How the drain runs one import: told how it ended, under the share's id as its operation id. */
export type ShareImportOptions = { onSettled: ImportSettled; operationId: string };

/** The shared imports the Add recipe sheets use. */
export type ShareImports = {
  url: (url: string, options: ShareImportOptions) => void;
  text: (text: string, options: ShareImportOptions) => void;
  images: (files: Blob[], options: ShareImportOptions) => void;
};

type SavedShare = z.infer<typeof savedShareSchema>;
type Start = (options: ShareImportOptions) => void;

/** The item's import; null when a saved image is gone. */
function startOf(item: SavedShare, inbox: ShareInbox, imports: ShareImports): Start | null {
  switch (item.kind) {
    case "url":
      return (options) => imports.url(item.url, options);
    case "text":
      return (options) => imports.text(item.text, options);
    case "images": {
      const files = item.images.map(inbox.image).filter((file) => file !== null);

      return files.length === item.images.length ? (options) => imports.images(files, options) : null;
    }
  }
}

/**
 * Starts an import and resolves with how it ended: null once the server took it, else the error.
 * The share's id is the one the extension sent, so a repeat after a kill or a timeout runs once.
 */
const outcomeOf = (start: Start, id: string) =>
  new Promise<unknown>((resolve) => start({ onSettled: resolve, operationId: id }));

/** Why the item cannot be imported here, or how its import ended. */
type ItemOutcome = "corrupt" | "elsewhere" | { error: unknown };

/** The saved item, or null when it is missing, unparseable or not a share. */
async function readItem(inbox: ShareInbox, id: string): Promise<SavedShare | null> {
  const raw = await inbox.read(id);

  try {
    return savedShareSchema.safeParse(raw === null ? null : JSON.parse(raw)).data ?? null;
  } catch {
    return null;
  }
}

async function importItem(
  inbox: ShareInbox,
  id: string,
  ownerId: string,
  imports: ShareImports
): Promise<ItemOutcome> {
  const item = await readItem(inbox, id);

  if (!item) return "corrupt";
  // Another account's, kept for it as its Outbox is (Session Expiry).
  if (item.ownerId !== ownerId) return "elsewhere";
  const start = startOf(item, inbox, imports);

  return start ? { error: await outcomeOf(start, id) } : "corrupt";
}

/** What the drain does next with an item: done with it, drop it, keep it, or stop with the rest waiting. */
function nextStep(outcome: ItemOutcome): "done" | "drop" | "keep" | "stop" {
  if (outcome === "corrupt") return "drop";
  if (outcome === "elsewhere") return "keep";
  const { error } = outcome;

  if (error === null || isQueuedOutboxSignal(error)) return "done";
  // Replay's rule: signed out or not durably queued stops; a 5xx, 408 or 429 waits; the rest is final.
  switch (classifyReplayError(error)) {
    case "unreachable":
    case "unauthorized":
      return "stop";
    case "ambiguous":
      // ponytail: no attempt cap, so a share the server always fails is retried on each foreground.
      return "keep";
    case "deterministic":
      return "drop";
  }
}

async function drain(inbox: ShareInbox, ownerId: string, imports: ShareImports) {
  for (const id of inbox.ids()) {
    const outcome = await importItem(inbox, id, ownerId, imports);
    const step = nextStep(outcome);

    if (step === "stop") return;
    if (step === "keep") continue;
    // Refused for good (its toast said so), or unusable.
    if (step === "drop")
      log.warn({ id, outcome }, "Dropped a saved share that could not be imported");
    inbox.remove(id);
  }
}

// Module scope: one drain at a time across remounts, so an item is never imported twice.
let draining: Promise<void> | null = null;

/** Imports `ownerId`'s saved items one by one; each leaves the inbox once it is safe. */
export function drainShareInbox(
  inbox: ShareInbox,
  ownerId: string,
  imports: ShareImports
): Promise<void> {
  draining ??= drain(inbox, ownerId, imports).finally(() => {
    draining = null;
  });

  return draining;
}

/** The part of the offline engine a session end goes through. */
type SessionEndEngine = {
  cache: { owner: () => string | null };
  unsyncedChanges: () => Promise<number>;
  clearForSignOut: (options: { discardQueue: boolean }) => Promise<void>;
};

/** The owner's saved shares are part of its Outbox: counted before a Sign-out and discarded with it. */
export function withSavedShares<Engine extends SessionEndEngine>(
  engine: Engine,
  inbox: () => ShareInbox | null
): Engine {
  const ownersShares = async () => {
    const folder = inbox();
    const ownerId = engine.cache.owner();
    const ids: string[] = [];

    if (!folder || !ownerId) return { folder, ids };
    for (const id of folder.ids()) {
      if ((await readItem(folder, id))?.ownerId === ownerId) ids.push(id);
    }

    return { folder, ids };
  };

  return {
    ...engine,
    unsyncedChanges: async () =>
      (await engine.unsyncedChanges()) + (await ownersShares()).ids.length,
    clearForSignOut: async (options) => {
      try {
        if (options.discardQueue) {
          const { folder, ids } = await ownersShares();

          for (const id of ids) folder?.remove(id);
        }
      } finally {
        await engine.clearForSignOut(options);
      }
    },
  };
}
