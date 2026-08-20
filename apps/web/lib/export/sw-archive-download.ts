import type { ArchiveDownloadHandoff } from "./archive-download-protocol";
import {
  ARCHIVE_DOWNLOAD_HANDOFF_TIMEOUT_MS,
  ARCHIVE_DOWNLOAD_MESSAGE,
  archiveDownloadToken,
} from "./archive-download-protocol";

/**
 * The worker half of the streamed Recipe Archive download.
 *
 * The page hands over an export response body and then navigates a hidden
 * frame at the matching claim URL; this answers that navigation with the same
 * stream plus the `Content-Disposition` that turns it into a download. The
 * bytes go network → page → worker → download manager without ever being
 * collected, so an instance export with video in it costs no memory anywhere.
 */

type PendingDownload = {
  stream: ReadableStream<Uint8Array>;
  fileName: string;
  expiry: ReturnType<typeof setTimeout>;
};

/**
 * Handoffs waiting to be claimed. A worker can be killed between the message
 * and the claim, which loses the entry — the page treats an unclaimed handoff
 * as a failed download rather than assuming this survives.
 */
const pending = new Map<string, PendingDownload>();

function isHandoff(data: unknown): data is ArchiveDownloadHandoff {
  if (!data || typeof data !== "object") return false;

  const candidate = data as Partial<ArchiveDownloadHandoff>;

  return (
    candidate.type === ARCHIVE_DOWNLOAD_MESSAGE &&
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    typeof candidate.fileName === "string" &&
    candidate.stream instanceof ReadableStream
  );
}

/**
 * Take a handoff off a `message` event. Returns whether the message was one —
 * so the caller can leave anything else to the other message listeners.
 */
export function acceptArchiveDownload(data: unknown): boolean {
  if (!isHandoff(data)) return false;

  // A replaced handoff would leak its stream, so drop any same-token entry.
  discard(data.token);

  pending.set(data.token, {
    stream: data.stream,
    fileName: data.fileName,
    expiry: setTimeout(() => discard(data.token), ARCHIVE_DOWNLOAD_HANDOFF_TIMEOUT_MS),
  });

  return true;
}

function discard(token: string): void {
  const entry = pending.get(token);

  if (!entry) return;

  clearTimeout(entry.expiry);
  pending.delete(token);
  // Cancelling releases the export response, which lets the server stop
  // generating an archive nobody is going to receive.
  void entry.stream.cancel().catch(() => undefined);
}

/**
 * Quoted per RFC 6266 with the quoting characters stripped from the value,
 * so a recipe-derived name can never break out of the header.
 */
function contentDisposition(fileName: string): string {
  const safe = fileName.replace(/["\\\r\n]/g, "").trim() || "recipes.norishrecipes";

  return `attachment; filename="${safe}"`;
}

/**
 * Answer a claim URL with the stream the page handed over, or a 409 when
 * there is nothing to claim — an expired handoff, or a worker that restarted
 * since the message. Never throws: the frame making this request is hidden,
 * so a thrown error would fail silently instead of being reported.
 */
export function respondWithArchiveDownload(pathname: string): Response | undefined {
  const token = archiveDownloadToken(pathname);

  if (!token) return undefined;

  const entry = pending.get(token);

  if (!entry) {
    return new Response("No archive download is waiting for this token", { status: 409 });
  }

  clearTimeout(entry.expiry);
  pending.delete(token);

  return new Response(entry.stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(entry.fileName),
      "Cache-Control": "no-store",
    },
  });
}

/** Test seam: how many handoffs are still waiting. */
export function pendingArchiveDownloadCount(): number {
  return pending.size;
}
