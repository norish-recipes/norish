"use client";

import type { ArchiveDownloadHandoff } from "./archive-download-protocol";
import {
  ARCHIVE_DOWNLOAD_HANDOFF_TIMEOUT_MS,
  ARCHIVE_DOWNLOAD_MESSAGE,
  ARCHIVE_PROBE_PARAM,
  ARCHIVE_PROBE_VALUE,
  archiveDownloadUrl,
} from "./archive-download-protocol";

/**
 * Start a Recipe Archive download and report on it honestly.
 *
 * Two paths, chosen by what the browser can actually do:
 *
 * - **Streamed.** The response body is handed to the service worker, which
 *   answers a hidden frame's navigation with it. The archive never collects
 *   in memory, the caller sees bytes go past, and the promise settles when
 *   the transfer really ends.
 * - **Handed to the browser.** No worker to hand to, so a cheap probe
 *   authorises first and then the browser downloads the URL itself. The
 *   caller learns that it started, never that it finished.
 *
 * Either way the authorisation answer arrives as a value, so an expired
 * session shows an error in place instead of replacing the app with a
 * plain-text error page.
 */

/**
 * Why a download could not be started, for the caller to phrase.
 *
 * The HTTP code is `httpStatus`, not `status`: these are spread into an
 * outcome that carries its own `status`, and a second field of that name
 * would silently overwrite it.
 */
export type ArchiveDownloadFailure =
  | { reason: "unauthorized" }
  | { reason: "forbidden" }
  | { reason: "failed"; httpStatus?: number; error?: unknown };

export type ArchiveDownloadOutcome =
  | { status: "streamed"; bytes: number }
  | { status: "handedOff" }
  | ({ status: "failed" } & ArchiveDownloadFailure);

export type ArchiveDownloadRequest = {
  /** The export URL, already carrying its scope */
  url: string;
  /** Used only if the response declines to name the file itself */
  fallbackFileName: string;
  /** Called as bytes arrive; only fires on the streamed path */
  onProgress?: (bytes: number) => void;
};

/**
 * The name the export chose for itself. The route already declares it, so the
 * server stays the one place that decides — this side only needs a fallback
 * for a response that somehow arrives without the header.
 */
function fileNameFromResponse(response: Response, fallback: string): string {
  const header = response.headers.get("Content-Disposition");

  if (!header) return fallback;

  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(header);

  if (quoted?.[1]) return quoted[1];

  const bare = /filename\s*=\s*([^;]+)/i.exec(header);

  return bare?.[1]?.trim() || fallback;
}

function withProbe(url: string): string {
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}${ARCHIVE_PROBE_PARAM}=${ARCHIVE_PROBE_VALUE}`;
}

function failureFor(httpStatus: number): ArchiveDownloadFailure {
  if (httpStatus === 401) return { reason: "unauthorized" };
  if (httpStatus === 403) return { reason: "forbidden" };

  return { reason: "failed", httpStatus };
}

/**
 * Whether this browser can post a stream to another realm. Chromium, Firefox
 * and Safari all can now, but the check is cheap and the fallback is real, so
 * it is asked rather than assumed.
 */
export function supportsTransferableStreams(): boolean {
  try {
    const stream = new ReadableStream();
    const channel = new MessageChannel();

    channel.port1.postMessage(stream, [stream as unknown as Transferable]);
    channel.port1.close();
    channel.port2.close();

    return true;
  } catch {
    return false;
  }
}

/** The worker that would answer a handoff, or null when there is none. */
function activeWorker(): ServiceWorker | null {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return null;

  return navigator.serviceWorker.controller;
}

/**
 * Count bytes as they pass without holding on to them. The transform runs in
 * the page while the worker pulls from the far end, so backpressure still
 * reaches the server: a slow disk slows the export rather than buffering it.
 */
function countingStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (total: number) => void
): { stream: ReadableStream<Uint8Array>; finished: Promise<number> } {
  let total = 0;

  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      onChunk(total);
      controller.enqueue(chunk);
    },
  });

  /**
   * `pipeTo` rather than `pipeThrough`, for the promise: it resolves once the
   * whole response has gone downstream and rejects if the download is
   * cancelled or errors. A `Transformer`'s own `cancel` hook is a later
   * addition to the spec than the lib this builds against, so this is both the
   * portable signal and the typed one. Backpressure is unaffected — the
   * writable stops accepting until the far end pulls.
   */
  const finished = body.pipeTo(counter.writable).then(() => total);

  return { stream: counter.readable, finished };
}

/**
 * Navigate a hidden frame at the claim URL so the worker's response becomes a
 * download. The frame is torn down once the transfer settles — removing it
 * earlier would cancel a download still in flight.
 */
function claimInHiddenFrame(token: string): () => void {
  const frame = document.createElement("iframe");

  frame.hidden = true;
  frame.setAttribute("aria-hidden", "true");
  frame.style.display = "none";
  frame.src = archiveDownloadUrl(token);
  document.body.appendChild(frame);

  return () => frame.remove();
}

function newToken(): string {
  return crypto.randomUUID();
}

/**
 * Fail a handoff that was never picked up.
 *
 * The worker cancels its side after the same interval, which normally ends
 * the transfer for us — but a worker that died between the message and the
 * claim cancels nothing, and without this the caller would wait forever. The
 * guard only watches the gap before the first chunk: once bytes are moving,
 * a slow transfer is just a slow transfer.
 */
async function withHandoffGuard(finished: Promise<number>, sawBytes: () => boolean) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  // If the guard wins the race, `finished` may still reject later with nobody
  // listening; claim it here so that surfaces as a handled rejection.
  void finished.catch(() => undefined);

  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      if (!sawBytes()) reject(new Error("The archive download was never picked up"));
    }, ARCHIVE_DOWNLOAD_HANDOFF_TIMEOUT_MS);
  });

  try {
    return await Promise.race([finished, guard]);
  } finally {
    clearTimeout(timer);
  }
}

export async function startArchiveDownload(
  request: ArchiveDownloadRequest
): Promise<ArchiveDownloadOutcome> {
  const worker = activeWorker();

  if (!worker || !supportsTransferableStreams()) {
    return handToBrowser(request);
  }

  let response: Response;

  try {
    response = await fetch(request.url);
  } catch (error) {
    return { status: "failed", reason: "failed", error };
  }

  if (!response.ok) {
    return { status: "failed", ...failureFor(response.status) };
  }

  if (!response.body) {
    // Nothing to hand over; let the browser fetch it again itself.
    return handToBrowser(request);
  }

  const token = newToken();
  let sawBytes = false;
  const { stream, finished } = countingStream(response.body, (bytes) => {
    sawBytes = true;
    request.onProgress?.(bytes);
  });

  const handoff: ArchiveDownloadHandoff = {
    type: ARCHIVE_DOWNLOAD_MESSAGE,
    token,
    fileName: fileNameFromResponse(response, request.fallbackFileName),
    stream,
  };

  let releaseFrame: (() => void) | undefined;

  try {
    worker.postMessage(handoff, [stream as unknown as Transferable]);
    releaseFrame = claimInHiddenFrame(token);

    return {
      status: "streamed",
      bytes: await withHandoffGuard(finished, () => sawBytes),
    };
  } catch (error) {
    return { status: "failed", reason: "failed", error };
  } finally {
    releaseFrame?.();
  }
}

/**
 * Authorise with a probe the route answers without building anything, then
 * let the browser do the download. The busy state this leaves the caller with
 * is only a double-press guard — there is no signal for when it finished.
 */
async function handToBrowser(request: ArchiveDownloadRequest): Promise<ArchiveDownloadOutcome> {
  try {
    const probe = await fetch(withProbe(request.url));

    if (!probe.ok) {
      return { status: "failed", ...failureFor(probe.status) };
    }
  } catch (error) {
    return { status: "failed", reason: "failed", error };
  }

  window.location.assign(request.url);

  return { status: "handedOff" };
}
