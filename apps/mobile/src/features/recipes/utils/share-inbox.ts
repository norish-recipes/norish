import { z } from "zod";

import type { ImportSettled } from "@norish/shared-react/recipes";
import { isUnauthorizedTRPCError } from "@norish/shared-react/trpc";
import { MAX_OCR_FILES } from "@norish/shared/contracts/uploads";
import { createClientLogger } from "@norish/shared/lib/logger";
import {
  httpStatusOf,
  isBackendUnreachableError,
  isQueuedOutboxSignal,
} from "@norish/shared/lib/trpc-errors";

const log = createClientLogger("share-inbox");

/** What the Share Extension saved while the server was unreachable (`ShareInbox.swift`). */
const savedShareSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.string().min(1), serverAddress: z.string() }),
  z.object({ kind: z.literal("text"), text: z.string().min(1), serverAddress: z.string() }),
  z.object({
    kind: z.literal("images"),
    // Bare names in the inbox folder, never a path out of it.
    images: z
      .array(z.string().regex(/^[\w-]+\.jpg$/))
      .min(1)
      .max(MAX_OCR_FILES),
    serverAddress: z.string(),
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

/** The shared imports the Add recipe sheets use; each tells how it ended. */
export type ShareImports = {
  url: (url: string, onSettled: ImportSettled) => void;
  text: (text: string, onSettled: ImportSettled) => void;
  images: (files: Blob[], onSettled: ImportSettled) => void;
};

type SavedShare = z.infer<typeof savedShareSchema>;
type SavedShareOf = { [Share in SavedShare as Share["kind"]]: Share };
type Start = (onSettled: ImportSettled) => void;

/** Each kind's import over its saved item; null when a saved image is gone. */
const IMPORTS: {
  [Kind in keyof SavedShareOf]: (
    item: SavedShareOf[Kind],
    inbox: ShareInbox,
    imports: ShareImports
  ) => Start | null;
} = {
  url: (item, _inbox, imports) => (done) => imports.url(item.url, done),
  text: (item, _inbox, imports) => (done) => imports.text(item.text, done),
  images: (item, inbox, imports) => {
    const files = item.images.map(inbox.image).filter((file) => file !== null);

    return files.length === item.images.length ? (done) => imports.images(files, done) : null;
  },
};

function startOf<Kind extends keyof SavedShareOf>(
  kind: Kind,
  item: SavedShareOf[Kind],
  inbox: ShareInbox,
  imports: ShareImports
): Start | null {
  return IMPORTS[kind](item, inbox, imports);
}

/** Starts an import and resolves with how it ended: null once the server took it, else the error. */
const outcomeOf = (start: Start) => new Promise<unknown>((resolve) => start(resolve));

/** Why the item cannot be imported here, or how its import ended. */
type ItemOutcome = "corrupt" | "elsewhere" | { error: unknown };

async function importItem(
  inbox: ShareInbox,
  id: string,
  serverAddress: string,
  imports: ShareImports
): Promise<ItemOutcome> {
  const raw = await inbox.read(id);
  let parsed: unknown = null;

  try {
    parsed = raw === null ? null : JSON.parse(raw);
  } catch {
    // Unparseable, as a missing file: dropped below.
  }
  const item = savedShareSchema.safeParse(parsed);

  if (!item.success) return "corrupt";
  // Saved for another server: the share is not this one's to import.
  if (item.data.serverAddress !== serverAddress) return "elsewhere";
  const start = startOf(item.data.kind, item.data, inbox, imports);

  return start ? { error: await outcomeOf(start) } : "corrupt";
}

/** What the drain does next with an item: done with it, drop it, keep it, or stop with the rest waiting. */
function nextStep(outcome: ItemOutcome): "done" | "drop" | "keep" | "stop" {
  if (typeof outcome === "string") return "drop";
  const { error } = outcome;

  // Signed out, or unreachable and not durably queued: this item and the rest wait for next time.
  if (
    isUnauthorizedTRPCError(error) ||
    (isBackendUnreachableError(error) && !isQueuedOutboxSignal(error))
  ) {
    return "stop";
  }
  if (error === null || isQueuedOutboxSignal(error)) return "done";
  const status = httpStatusOf(error);

  // Refused with a 4xx a retry gets again; 408 and 429 ask for the retry.
  if (status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return "drop";
  }

  // ponytail: an item the server always answers 5xx to is retried on every foreground, no attempt cap.
  return "keep";
}

async function drain(inbox: ShareInbox, serverAddress: string, imports: ShareImports) {
  for (const id of inbox.ids()) {
    const outcome = await importItem(inbox, id, serverAddress, imports);
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

/** Imports the Share Extension's saved items one by one; each leaves the inbox once it is safe. */
export function drainShareInbox(
  inbox: ShareInbox,
  serverAddress: string,
  imports: ShareImports
): Promise<void> {
  draining ??= drain(inbox, serverAddress, imports).finally(() => {
    draining = null;
  });

  return draining;
}
