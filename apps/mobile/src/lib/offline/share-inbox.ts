import { z } from "zod";

import type { ImportOptions } from "@norish/shared-react/recipes";
import { classifyReplayError } from "@norish/shared-react/offline";
import { MAX_OCR_FILES } from "@norish/shared/contracts/uploads";
import { createClientLogger } from "@norish/shared/lib/logger";
import { isQueuedOutboxSignal } from "@norish/shared/lib/trpc-errors";

const log = createClientLogger("share-inbox");

/** Whose a saved share is: the Outbox's owner id on the Server Address it was shared to. */
export type ShareAccount = { ownerId: string; serverAddress: string };

const owner = { ownerId: z.string().min(1), serverAddress: z.string().min(1) };

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

/** How the drain runs one import: told how it ended, under the share's id, quiet on what it keeps. */
export type ShareImportOptions = Required<
  Pick<ImportOptions, "onSettled" | "operationId" | "keeps">
>;

/** The shared imports the Add recipe sheets use. */
export type ShareImports = {
  url: (url: string, options: ShareImportOptions) => void;
  text: (text: string, options: ShareImportOptions) => void;
  images: (files: Blob[], options: ShareImportOptions) => void;
  /** Rereads the pending imports: a repeat's stored answer may name a recipe already done. */
  reconcile: () => void;
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

      return files.length === item.images.length
        ? (options) => imports.images(files, options)
        : null;
    }
  }
}

// Null once the server took it, else the error; under the extension's id, so a repeat runs once.
const outcomeOf = (start: Start, id: string) =>
  new Promise<unknown>((resolve) => start({ onSettled: resolve, operationId: id, keeps: isKept }));

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

const sameAccount = (a: ShareAccount | null, b: ShareAccount | null) =>
  a !== null && b !== null && a.ownerId === b.ownerId && a.serverAddress === b.serverAddress;

async function importItem(
  inbox: ShareInbox,
  id: string,
  account: ShareAccount,
  imports: ShareImports
): Promise<ItemOutcome> {
  const item = await readItem(inbox, id);

  if (!item) return "corrupt";
  // Another account's or server's, kept for it as its Outbox is (Session Expiry).
  if (!sameAccount(item, account)) return "elsewhere";
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

/** An error the item stays in the inbox for: its import toasts nothing. */
function isKept(error: unknown): boolean {
  const step = nextStep({ error });

  return step === "keep" || step === "stop";
}

async function drain(inbox: ShareInbox, account: () => ShareAccount | null, imports: ShareImports) {
  const startedUnder = account();
  let taken = false;

  if (!startedUnder) return;
  for (const id of inbox.ids()) {
    // A session end while an import hung: the rest must not go out under the next account.
    if (!sameAccount(account(), startedUnder)) break;
    const outcome = await importItem(inbox, id, startedUnder, imports);
    const step = nextStep(outcome);

    if (typeof outcome === "object" && outcome.error === null) taken = true;
    if (step === "stop") break;
    if (step === "keep") continue;
    // Refused for good (its toast said so), or unusable.
    if (step === "drop")
      log.warn({ id, outcome }, "Dropped a saved share that could not be imported");
    inbox.remove(id);
  }
  if (taken) imports.reconcile();
}

// Module scope: one drain at a time across remounts, so an item is never imported twice.
let draining: Promise<void> | null = null;

/** Imports the current account's saved items one by one; each leaves the inbox once it is safe. */
export function drainShareInbox(
  inbox: ShareInbox,
  account: () => ShareAccount | null,
  imports: ShareImports
): Promise<void> {
  draining ??= drain(inbox, account, imports).finally(() => {
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
  inbox: () => ShareInbox | null,
  serverAddress: () => string
): Engine & { shareAccount: () => ShareAccount | null } {
  const shareAccount = () => {
    const ownerId = engine.cache.owner();

    return ownerId ? { ownerId, serverAddress: serverAddress() } : null;
  };
  const ownersShares = async () => {
    const folder = inbox();
    const account = shareAccount();
    const ids: string[] = [];

    if (!folder || !account) return { folder, ids };
    for (const id of folder.ids()) {
      if (sameAccount(await readItem(folder, id), account)) ids.push(id);
    }

    return { folder, ids };
  };

  return {
    ...engine,
    shareAccount,
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
