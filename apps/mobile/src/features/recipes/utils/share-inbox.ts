import { z } from "zod";

import type { ImportSettled } from "@norish/shared-react/recipes";
import { isUnauthorizedTRPCError } from "@norish/shared-react/trpc";
import { MAX_OCR_FILES } from "@norish/shared/contracts/uploads";
import { createClientLogger } from "@norish/shared/lib/logger";
import { isBackendUnreachableError, isQueuedOutboxSignal } from "@norish/shared/lib/trpc-errors";

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

const settled = (start: (onSettled: ImportSettled) => void) =>
  new Promise<unknown>((resolve) => start(resolve));

async function importItem(
  inbox: ShareInbox,
  id: string,
  serverAddress: string,
  imports: ShareImports
) {
  const raw = await inbox.read(id);
  let parsed: unknown = null;

  try {
    parsed = raw === null ? null : JSON.parse(raw);
  } catch {
    // Unparseable, as a missing file: dropped below.
  }
  const item = savedShareSchema.safeParse(parsed);

  if (!item.success) return { id, error: "corrupt" as const };
  // Saved for another server: the share is not this one's to import.
  if (item.data.serverAddress !== serverAddress) return { id, error: "elsewhere" as const };

  const { data } = item;

  if (data.kind === "url")
    return { id, error: await settled((done) => imports.url(data.url, done)) };
  if (data.kind === "text")
    return { id, error: await settled((done) => imports.text(data.text, done)) };

  const files = data.images.map(inbox.image);

  if (files.some((file) => file === null)) return { id, error: "corrupt" as const };

  return {
    id,
    error: await settled((done) =>
      imports.images(
        files.filter((file) => file !== null),
        done
      )
    ),
  };
}

async function drain(inbox: ShareInbox, serverAddress: string, imports: ShareImports) {
  for (const id of inbox.ids()) {
    const { error } = await importItem(inbox, id, serverAddress, imports);

    // Signed out, or unreachable and not durably queued: this item and the rest wait for next time.
    if (
      error !== "corrupt" &&
      error !== "elsewhere" &&
      (isUnauthorizedTRPCError(error) ||
        (isBackendUnreachableError(error) && !isQueuedOutboxSignal(error)))
    ) {
      return;
    }
    // Imported, durably in the Outbox, refused for good (its toast said so), or unusable.
    if (error !== null && !isQueuedOutboxSignal(error)) {
      log.warn({ id, error }, "Dropped a saved share that could not be imported");
    }
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
