// @vitest-environment jsdom

import { startArchiveDownload } from "@/lib/export/archive-download-client";
import { ARCHIVE_DOWNLOAD_MESSAGE } from "@/lib/export/archive-download-protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUEST = { url: "/export/recipes", fallbackFileName: "fallback.norishrecipes" };

function zipResponse(body: string, fileName?: string) {
  const headers = new Headers({ "Content-Type": "application/zip" });

  if (fileName) headers.set("Content-Disposition", `attachment; filename="${fileName}"`);

  return new Response(new TextEncoder().encode(body), { status: 200, headers });
}

/**
 * A controller whose postMessage records the handoff and then drains the
 * transferred stream, standing in for the browser's download manager pulling
 * the response through the worker.
 */
function controllingWorker({ drains = true } = {}) {
  const posted: { data: any; transfer: unknown[] }[] = [];

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      controller: {
        postMessage: (data: any, transfer: unknown[]) => {
          posted.push({ data, transfer });
          if (drains) void drain(data.stream);
        },
      },
    },
  });

  return posted;
}

/** Read a stream to completion, as the download manager would. */
async function drain(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();

  for (;;) {
    const { done } = await reader.read();

    if (done) break;
  }
}

function noWorker() {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { controller: null },
  });
}

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign, href: "http://localhost/settings" },
  });
  vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "fixed-token" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("startArchiveDownload — streamed through the worker", () => {
  it("hands the response body over and reports the bytes that went past", async () => {
    const posted = controllingWorker();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(zipResponse("PKzipbytes", "chosen.norishrecipes"))
    );

    const progress: number[] = [];
    const outcome = await startArchiveDownload({
      ...REQUEST,
      onProgress: (bytes) => progress.push(bytes),
    });

    expect(outcome).toEqual({ status: "streamed", bytes: 10 });
    expect(progress.at(-1)).toBe(10);

    // The stream was transferred, not copied, and named by the response.
    expect(posted).toHaveLength(1);
    expect(posted[0]!.data.type).toBe(ARCHIVE_DOWNLOAD_MESSAGE);
    expect(posted[0]!.data.fileName).toBe("chosen.norishrecipes");
    expect(posted[0]!.transfer).toHaveLength(1);

    // Nothing navigated: the SPA stays where it was.
    expect(assign).not.toHaveBeenCalled();
  });

  it("claims the handoff through a frame it cleans up afterwards", async () => {
    controllingWorker();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(zipResponse("PK", "a.norishrecipes")));

    await startArchiveDownload(REQUEST);

    // Removed once the transfer settled, so it cannot pile up per export.
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });

  it("falls back to the given name when the response does not declare one", async () => {
    const posted = controllingWorker();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(zipResponse("PK")));

    await startArchiveDownload(REQUEST);

    expect(posted[0]!.data.fileName).toBe("fallback.norishrecipes");
  });

  it("never probes on the streamed path — one request, not two", async () => {
    controllingWorker();
    const fetchMock = vi.fn().mockResolvedValue(zipResponse("PK", "a.norishrecipes"));

    vi.stubGlobal("fetch", fetchMock);

    await startArchiveDownload(REQUEST);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/export/recipes");
  });
});

describe("startArchiveDownload — reporting refusals in place", () => {
  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [500, "failed"],
  ])("maps %i to %s without navigating away", async (status, reason) => {
    controllingWorker();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status })));

    const outcome = await startArchiveDownload(REQUEST);

    expect(outcome.status).toBe("failed");
    expect(outcome).toMatchObject({ reason });
    expect(assign).not.toHaveBeenCalled();
  });

  it("keeps the HTTP code on its own field so it cannot shadow the outcome", async () => {
    controllingWorker();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 503 })));

    const outcome = await startArchiveDownload(REQUEST);

    expect(outcome).toEqual({ status: "failed", reason: "failed", httpStatus: 503 });
  });

  it("reports a network failure rather than throwing", async () => {
    controllingWorker();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const outcome = await startArchiveDownload(REQUEST);

    expect(outcome).toMatchObject({ status: "failed", reason: "failed" });
  });
});

describe("startArchiveDownload — a handoff nobody picks up", () => {
  it("gives up instead of staying busy forever", async () => {
    vi.useFakeTimers();
    // A worker that takes the message and never reads the stream, as one that
    // died between the message and the claim would leave things.
    controllingWorker({ drains: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(zipResponse("PK", "a.norishrecipes")));

    const pending = startArchiveDownload(REQUEST);

    await vi.advanceTimersByTimeAsync(30_000);

    await expect(pending).resolves.toMatchObject({ status: "failed", reason: "failed" });
    vi.useRealTimers();
  });
});

describe("startArchiveDownload — handed to the browser", () => {
  it("probes first, then lets the browser download it", async () => {
    noWorker();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    vi.stubGlobal("fetch", fetchMock);

    const outcome = await startArchiveDownload(REQUEST);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/export/recipes?probe=1");
    expect(outcome).toEqual({ status: "handedOff" });
    expect(assign).toHaveBeenCalledWith("/export/recipes");
  });

  it("appends the probe to a URL that already has a query", async () => {
    noWorker();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    vi.stubGlobal("fetch", fetchMock);

    await startArchiveDownload({ ...REQUEST, url: "/export/recipes?scope=instance" });

    expect(fetchMock.mock.calls[0]![0]).toBe("/export/recipes?scope=instance&probe=1");
    expect(assign).toHaveBeenCalledWith("/export/recipes?scope=instance");
  });

  it("does not navigate when the probe refuses", async () => {
    noWorker();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 401 })));

    const outcome = await startArchiveDownload(REQUEST);

    expect(outcome).toMatchObject({ status: "failed", reason: "unauthorized" });
    // The bug this replaces: a 401 used to replace the app with a text page.
    expect(assign).not.toHaveBeenCalled();
  });
});
