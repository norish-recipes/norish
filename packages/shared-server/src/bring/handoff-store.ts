import { randomBytes } from "node:crypto";
import { z } from "zod";

import { getPublisherClient } from "@norish/shared-server/valkey/client";

/**
 * A Bring Handoff lives an hour from when it is prepared; a change to its lines keeps that
 * deadline. Bring!'s servers may read the page again after the first fetch, so reading it does
 * not delete it.
 */
export const BRING_HANDOFF_TTL_SECONDS = 3600;

const KEY_PREFIX = "norish:bring:handoff:";

/**
 * The recipe's picture, for Bring! to show beside the items: a file this instance stores, which
 * the page serves at its own `/image` address so the recipe id never leaves the server, or the
 * address an imported recipe's picture already has on the web.
 */
const HandoffImageSchema = z.union([
  z.object({ recipeId: z.string(), file: z.string() }),
  z.object({ url: z.string() }),
]);

/** What the public page shows, and nothing else: no user, household or recipe id. */
const HandoffSchema = z.object({
  title: z.string(),
  servings: z.number(),
  lines: z.array(z.string()),
  image: HandoffImageSchema.nullable().catch(null).default(null),
  createdAt: z.number(),
});

/** What is stored: the page, and the user who prepared it, the only one who may change it. */
const StoredHandoffSchema = HandoffSchema.extend({ ownerId: z.string() });

export type BringHandoff = z.infer<typeof HandoffSchema>;

/** What a handoff is made of when it is prepared or changed. */
export type BringHandoffContent = Pick<BringHandoff, "title" | "servings" | "lines"> & {
  image?: BringHandoffImage | null;
};
export type BringHandoffImage = z.infer<typeof HandoffImageSchema>;

/** A stored media file's name, as the recipe media route serves it. */
const MEDIA_FILE = /^[\w-]+\.[a-z\d]+$/i;

/**
 * The picture a handoff carries for a recipe's primary image: a file this instance stores under
 * `/recipes/<id>/`, or an https address on the web. Anything else, such as a file of another
 * recipe or a plain-http address Bring! may not fetch, carries none.
 */
export function handoffImageFor(recipeId: string, image: string | null): BringHandoffImage | null {
  if (!image) return null;

  const storedPrefix = `/recipes/${recipeId}/`;

  if (image.startsWith(storedPrefix)) {
    const file = image.slice(storedPrefix.length);

    return MEDIA_FILE.test(file) ? { recipeId, file } : null;
  }

  return image.startsWith("https://") ? { url: image } : null;
}

async function readStored(token: string) {
  const valkey = await getPublisherClient();
  const raw = await valkey.get(`${KEY_PREFIX}${token}`);

  if (!raw) return null;

  try {
    const parsed = StoredHandoffSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function recordOf(content: BringHandoffContent, ownerId: string, createdAt: number) {
  return JSON.stringify({
    title: content.title,
    servings: content.servings,
    lines: content.lines,
    image: content.image ?? null,
    createdAt,
    ownerId,
  });
}

/** Stores the lines under an unguessable token for `ownerId` and returns the token. */
export async function createHandoff(
  content: BringHandoffContent,
  ownerId: string
): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const valkey = await getPublisherClient();

  await valkey.set(
    `${KEY_PREFIX}${token}`,
    recordOf(content, ownerId, Date.now()),
    "EX",
    BRING_HANDOFF_TTL_SECONDS
  );

  return token;
}

/**
 * Replaces the lines of `ownerId`'s handoff and keeps its deadline. False when the handoff is gone
 * or is someone else's: the caller prepares a new one.
 */
export async function updateHandoff(
  token: string,
  ownerId: string,
  content: BringHandoffContent
): Promise<boolean> {
  const stored = await readStored(token);

  if (stored?.ownerId !== ownerId) return false;

  const valkey = await getPublisherClient();
  // XX: a handoff that expired between the read and this write is not brought back.
  const written = await valkey.set(
    `${KEY_PREFIX}${token}`,
    recordOf(content, ownerId, stored.createdAt),
    "KEEPTTL",
    "XX"
  );

  return written === "OK";
}

/**
 * Removes a handoff Bring! will not read: one whose check failed, or one `ownerId` prepared and
 * left without sending, so its page does not stay up for the hour. Another user's is left alone.
 */
export async function deleteHandoff(token: string, ownerId: string): Promise<void> {
  const stored = await readStored(token);

  if (stored?.ownerId !== ownerId) return;

  const valkey = await getPublisherClient();

  await valkey.del(`${KEY_PREFIX}${token}`);
}

/** The stored handoff's page, or null when the token is unknown or expired. */
export async function readHandoff(token: string): Promise<BringHandoff | null> {
  const stored = await readStored(token);

  // Parsed again without the owner, which the page never shows.
  return stored ? HandoffSchema.parse(stored) : null;
}
