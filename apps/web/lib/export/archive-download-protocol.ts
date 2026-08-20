/**
 * The contract between the page and the service worker for a streamed
 * Recipe Archive download.
 *
 * A `.norishrecipes` export is generated straight into the response and never
 * exists on the server (ADR-0022), so the page cannot ask how big it will be
 * or when it finished — the browser's own download UI owns both. Handing the
 * response body to the service worker and letting *it* answer the download
 * navigation puts the page back in the loop: it sees every chunk go past
 * without ever holding the archive in memory.
 *
 * Both sides import this module, so the path and the message name can never
 * drift apart.
 */

/**
 * Where the service worker answers a handed-off download. Deliberately
 * outside `/export/` so it cannot be shadowed by that route's NetworkOnly
 * rule, and nothing behind it is ever a real network path — a request here
 * with no worker to answer it is expected to fail.
 */
export const SW_ARCHIVE_DOWNLOAD_PATH = "/sw-archive-download/";

/** The `postMessage` discriminator carrying a stream to the worker. */
export const ARCHIVE_DOWNLOAD_MESSAGE = "norish-archive-download";

/**
 * How long a handed-off stream waits to be claimed before the worker drops
 * it. Only covers the gap between `postMessage` and the download navigation,
 * which is immediate — a download already underway is never cut short by it.
 */
export const ARCHIVE_DOWNLOAD_HANDOFF_TIMEOUT_MS = 30_000;

export type ArchiveDownloadHandoff = {
  type: typeof ARCHIVE_DOWNLOAD_MESSAGE;
  /** One-shot key matching this handoff to the download request that claims it */
  token: string;
  /** The name the browser should save the archive under */
  fileName: string;
  /** The export response's body, transferred rather than copied */
  stream: ReadableStream<Uint8Array>;
};

/**
 * Marks a request that should be answered with this route's authorisation
 * verdict alone — no household lookup, no archive. Lets a client that is
 * about to hand the download to the browser learn about an expired session
 * while it can still report it in place.
 */
export const ARCHIVE_PROBE_PARAM = "probe";
export const ARCHIVE_PROBE_VALUE = "1";

/** The URL that claims a handoff. */
export function archiveDownloadUrl(token: string): string {
  return `${SW_ARCHIVE_DOWNLOAD_PATH}${encodeURIComponent(token)}`;
}

/** The token a claim URL is for, or null when the path is not a claim. */
export function archiveDownloadToken(pathname: string): string | null {
  if (!pathname.startsWith(SW_ARCHIVE_DOWNLOAD_PATH)) return null;

  const token = pathname.slice(SW_ARCHIVE_DOWNLOAD_PATH.length);

  return token ? decodeURIComponent(token) : null;
}
