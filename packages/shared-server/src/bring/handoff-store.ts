import { randomBytes } from "node:crypto";
import { z } from "zod";

import { getPublisherClient } from "@norish/shared-server/valkey/client";

/**
 * A Bring Handoff lives an hour. Bring!'s servers may read the page again after the
 * first fetch, so reading it does not delete it.
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

export type BringHandoff = z.infer<typeof HandoffSchema>;
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

/** Stores the lines under an unguessable token and returns the token. */
export async function createHandoff(
  handoff: Pick<BringHandoff, "title" | "servings" | "lines"> & { image?: BringHandoffImage | null }
): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const record: BringHandoff = {
    title: handoff.title,
    servings: handoff.servings,
    lines: handoff.lines,
    image: handoff.image ?? null,
    createdAt: Date.now(),
  };
  const valkey = await getPublisherClient();

  await valkey.set(
    `${KEY_PREFIX}${token}`,
    JSON.stringify(record),
    "EX",
    BRING_HANDOFF_TTL_SECONDS
  );

  return token;
}

/** Removes a handoff that was never handed to Bring!, so its page does not outlive the failed send. */
export async function deleteHandoff(token: string): Promise<void> {
  const valkey = await getPublisherClient();

  await valkey.del(`${KEY_PREFIX}${token}`);
}

/** The stored handoff, or null when the token is unknown or expired. */
export async function readHandoff(token: string): Promise<BringHandoff | null> {
  const valkey = await getPublisherClient();
  const raw = await valkey.get(`${KEY_PREFIX}${token}`);

  if (!raw) return null;

  try {
    const parsed = HandoffSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
