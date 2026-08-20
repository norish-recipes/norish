// @vitest-environment node

import {
  ARCHIVE_DOWNLOAD_MESSAGE,
  archiveDownloadUrl,
  SW_ARCHIVE_DOWNLOAD_PATH,
} from "@/lib/export/archive-download-protocol";
import {
  acceptArchiveDownload,
  pendingArchiveDownloadCount,
  respondWithArchiveDownload,
} from "@/lib/export/sw-archive-download";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function streamOf(...chunks: string[]) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function handoff(token: string, fileName = "recipes.norishrecipes", ...chunks: string[]) {
  return {
    type: ARCHIVE_DOWNLOAD_MESSAGE,
    token,
    fileName,
    stream: streamOf(...(chunks.length ? chunks : ["PK"])),
  };
}

/** Drain a response body so the test asserts on bytes that really arrived. */
async function bodyText(response: Response): Promise<string> {
  return new TextDecoder().decode(new Uint8Array(await response.arrayBuffer()));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Clear anything a test left waiting, so the registry cannot leak across tests.
  vi.runAllTimers();
  vi.useRealTimers();
});

describe("service worker archive download handoff", () => {
  it("ignores messages that are not a handoff", () => {
    for (const data of [null, undefined, 42, "hello", {}, { type: "something-else" }]) {
      expect(acceptArchiveDownload(data)).toBe(false);
    }

    expect(pendingArchiveDownloadCount()).toBe(0);
  });

  it("rejects a handoff whose stream is missing or the wrong shape", () => {
    expect(
      acceptArchiveDownload({ type: ARCHIVE_DOWNLOAD_MESSAGE, token: "t", fileName: "f" })
    ).toBe(false);
    expect(
      acceptArchiveDownload({
        type: ARCHIVE_DOWNLOAD_MESSAGE,
        token: "t",
        fileName: "f",
        stream: "not a stream",
      })
    ).toBe(false);
    expect(
      acceptArchiveDownload({
        type: ARCHIVE_DOWNLOAD_MESSAGE,
        token: "",
        fileName: "f",
        stream: streamOf("x"),
      })
    ).toBe(false);
  });

  it("answers the claim URL with the handed-over bytes", async () => {
    expect(acceptArchiveDownload(handoff("token-1", "my-recipes.norishrecipes", "PK"))).toBe(true);

    const response = respondWithArchiveDownload(archiveDownloadUrl("token-1"));

    expect(response).toBeDefined();
    expect(response!.status).toBe(200);
    expect(response!.headers.get("Content-Type")).toBe("application/zip");
    expect(response!.headers.get("Content-Disposition")).toBe(
      'attachment; filename="my-recipes.norishrecipes"'
    );
    expect(response!.headers.get("Cache-Control")).toBe("no-store");
    expect(await bodyText(response!)).toBe("PK");
  });

  it("hands a token out only once", async () => {
    acceptArchiveDownload(handoff("token-2"));

    const first = respondWithArchiveDownload(archiveDownloadUrl("token-2"));
    const second = respondWithArchiveDownload(archiveDownloadUrl("token-2"));

    expect(first!.status).toBe(200);
    expect(second!.status).toBe(409);
    expect(pendingArchiveDownloadCount()).toBe(0);
    await first!.arrayBuffer();
  });

  it("reports a claim with nothing waiting as a conflict, never a throw", () => {
    const response = respondWithArchiveDownload(archiveDownloadUrl("never-handed-over"));

    expect(response!.status).toBe(409);
  });

  it("declines paths that are not a claim", () => {
    expect(respondWithArchiveDownload("/export/recipes")).toBeUndefined();
    expect(respondWithArchiveDownload("/")).toBeUndefined();
    // The bare prefix carries no token.
    expect(respondWithArchiveDownload(SW_ARCHIVE_DOWNLOAD_PATH)).toBeUndefined();
  });

  it("drops a handoff nobody claimed, cancelling its stream", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const stream = streamOf("PK");

    stream.cancel = cancel;

    acceptArchiveDownload({
      type: ARCHIVE_DOWNLOAD_MESSAGE,
      token: "abandoned",
      fileName: "f.norishrecipes",
      stream,
    });

    expect(pendingArchiveDownloadCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(pendingArchiveDownloadCount()).toBe(0);
    expect(cancel).toHaveBeenCalled();
    // Once expired, the claim is a conflict rather than a stalled download.
    expect(respondWithArchiveDownload(archiveDownloadUrl("abandoned"))!.status).toBe(409);
  });

  it("does not expire a download that was already claimed", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const stream = streamOf("PK");

    stream.cancel = cancel;

    acceptArchiveDownload({
      type: ARCHIVE_DOWNLOAD_MESSAGE,
      token: "claimed",
      fileName: "f.norishrecipes",
      stream,
    });

    const response = respondWithArchiveDownload(archiveDownloadUrl("claimed"));

    await vi.advanceTimersByTimeAsync(60_000);

    expect(cancel).not.toHaveBeenCalled();
    expect(await bodyText(response!)).toBe("PK");
  });

  it("replaces a same-token handoff instead of leaking the first stream", () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const first = streamOf("first");

    first.cancel = cancel;

    acceptArchiveDownload({
      type: ARCHIVE_DOWNLOAD_MESSAGE,
      token: "dup",
      fileName: "a.norishrecipes",
      stream: first,
    });
    acceptArchiveDownload(handoff("dup", "b.norishrecipes", "second"));

    expect(cancel).toHaveBeenCalled();
    expect(pendingArchiveDownloadCount()).toBe(1);
    expect(
      respondWithArchiveDownload(archiveDownloadUrl("dup"))!.headers.get("Content-Disposition")
    ).toBe('attachment; filename="b.norishrecipes"');
  });

  it("strips quoting characters out of the file name", () => {
    acceptArchiveDownload(handoff('ev"il', 'a"b\\c\r\nd.norishrecipes'));

    const response = respondWithArchiveDownload(archiveDownloadUrl('ev"il'));

    expect(response!.headers.get("Content-Disposition")).toBe(
      'attachment; filename="abcd.norishrecipes"'
    );
  });

  it("falls back to a name when the handoff carries an empty one", () => {
    acceptArchiveDownload(handoff("empty-name", "   "));

    expect(
      respondWithArchiveDownload(archiveDownloadUrl("empty-name"))!.headers.get(
        "Content-Disposition"
      )
    ).toBe('attachment; filename="recipes.norishrecipes"');
  });
});
