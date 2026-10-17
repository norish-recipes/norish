/**
 * The service worker's own fetch of a document says so: the browser sends it as
 * `Sec-Fetch-Dest: empty`, like any script's fetch. Navigation preload keeps `document`.
 */
export const WORKER_DOCUMENT_HEADER = "norish-document";

/**
 * A full load of a page, from the browser or through the service worker. Next's own RSC
 * navigations and prefetches are neither.
 */
export function isDocumentRequest(headers: Pick<Headers, "get">): boolean {
  return (
    headers.get("sec-fetch-dest") === "document" || headers.get(WORKER_DOCUMENT_HEADER) === "1"
  );
}
