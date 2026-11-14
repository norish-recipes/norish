import type { ShareImports, ShareInbox } from "@/features/recipes/utils/share-inbox";
import { drainShareInbox } from "@/features/recipes/utils/share-inbox";
import { describe, expect, it, vi } from "vitest";

import type { ImportSettled } from "@norish/shared-react/recipes";
import { markOutboxAdmissionFailed } from "@norish/shared/lib/trpc-errors";

const SERVER = "https://norish.test";

/** The Outbox link's Queued signal: unreachable, and durably admitted. */
const queued = () => new TypeError("Network request failed");
const unauthorized = () => ({ data: { code: "UNAUTHORIZED", httpStatus: 401 } });
const refused = () => ({ data: { code: "BAD_REQUEST", httpStatus: 400 } });

/** An App Group inbox in memory: item JSON by id, images by name. */
function fakeInbox(items: Record<string, object | string>, images: Record<string, Blob> = {}) {
  const json = new Map(
    Object.entries(items).map(([id, item]) => [
      id,
      typeof item === "string" ? item : JSON.stringify({ serverAddress: SERVER, ...item }),
    ])
  );
  const inbox: ShareInbox = {
    ids: () => [...json.keys()],
    read: async (id) => json.get(id) ?? null,
    image: (name) => images[name] ?? null,
    remove: (id) => {
      json.delete(id);
      for (const name of Object.keys(images)) if (name.startsWith(`${id}-`)) delete images[name];
    },
  };

  return { inbox, json, images };
}

/** Imports that settle as `answer` says, recording what they were given. */
function fakeImports(answer: (kind: string) => unknown = () => null) {
  const calls: [string, unknown][] = [];
  const run =
    (kind: string) =>
    (input: unknown, onSettled: ImportSettled): void => {
      calls.push([kind, input]);
      queueMicrotask(() => onSettled(answer(kind)));
    };
  const imports: ShareImports = { url: run("url"), text: run("text"), images: run("images") };

  return { imports, calls };
}

describe("drainShareInbox", () => {
  it("imports each saved item and removes it once imported or durably queued", async () => {
    const page = new Blob(["jpeg"], { type: "image/jpeg" });
    const { inbox, json, images } = fakeInbox(
      {
        a: { kind: "url", url: "https://example.com/pasta" },
        b: { kind: "text", text: "Pancakes. Flour, milk, eggs." },
        c: { kind: "images", images: ["c-0.jpg"] },
      },
      { "c-0.jpg": page }
    );
    const { imports, calls } = fakeImports((kind) => (kind === "text" ? queued() : null));

    await drainShareInbox(inbox, SERVER, imports);

    expect(calls).toEqual([
      ["url", "https://example.com/pasta"],
      ["text", "Pancakes. Flour, milk, eggs."],
      ["images", [page]],
    ]);
    expect(json.size).toBe(0);
    expect(Object.keys(images)).toEqual([]);
  });

  it("keeps an item's files until its import has settled", async () => {
    const { inbox, json } = fakeInbox({ a: { kind: "url", url: "https://example.com/pasta" } });
    const pending: { settle?: ImportSettled } = {};
    const imports: ShareImports = {
      url: (_url, onSettled) => {
        pending.settle = onSettled;
      },
      text: vi.fn(),
      images: vi.fn(),
    };

    const drained = drainShareInbox(inbox, SERVER, imports);

    await vi.waitFor(() => expect(pending.settle).toBeDefined());
    expect(json.has("a")).toBe(true);
    pending.settle?.(queued());
    await drained;
    expect(json.has("a")).toBe(false);
  });

  it("skips and removes a corrupt item, an item missing an image, and one saved for another server", async () => {
    const { inbox, json } = fakeInbox({
      broken: "{not json",
      wrong: { kind: "video", url: "https://example.com" },
      missing: { kind: "images", images: ["missing-0.jpg"] },
      escape: { kind: "images", images: ["../secrets.jpg"] },
      elsewhere: { kind: "url", url: "https://example.com/a", serverAddress: "https://other.test" },
      good: { kind: "url", url: "https://example.com/b" },
    });
    const { imports, calls } = fakeImports();

    await drainShareInbox(inbox, SERVER, imports);

    expect(calls).toEqual([["url", "https://example.com/b"]]);
    expect(json.size).toBe(0);
  });

  it("drops an item the server refused for good", async () => {
    const { inbox, json } = fakeInbox({ a: { kind: "url", url: "https://example.com/a" } });

    await drainShareInbox(inbox, SERVER, fakeImports(refused).imports);

    expect(json.size).toBe(0);
  });

  it("keeps everything while signed out, and items wait for the next drain", async () => {
    const { inbox, json } = fakeInbox({
      a: { kind: "url", url: "https://example.com/a" },
      b: { kind: "url", url: "https://example.com/b" },
    });
    const { imports, calls } = fakeImports(unauthorized);

    await drainShareInbox(inbox, SERVER, imports);

    expect(calls).toHaveLength(1);
    expect([...json.keys()]).toEqual(["a", "b"]);

    await drainShareInbox(inbox, SERVER, fakeImports().imports);
    expect(json.size).toBe(0);
  });

  it("keeps an item whose Outbox admission failed", async () => {
    const { inbox, json } = fakeInbox({ a: { kind: "url", url: "https://example.com/a" } });
    const lost = () => {
      const error = queued();

      markOutboxAdmissionFailed(error);

      return error;
    };

    await drainShareInbox(inbox, SERVER, fakeImports(lost).imports);

    expect(json.has("a")).toBe(true);
  });

  it("imports an item once when the drain runs twice", async () => {
    const { inbox } = fakeInbox({
      a: { kind: "url", url: "https://example.com/a" },
      b: { kind: "text", text: "Soup" },
    });
    const { imports, calls } = fakeImports();

    await Promise.all([
      drainShareInbox(inbox, SERVER, imports),
      drainShareInbox(inbox, SERVER, imports),
    ]);
    await drainShareInbox(inbox, SERVER, imports);

    expect(calls).toEqual([
      ["url", "https://example.com/a"],
      ["text", "Soup"],
    ]);
  });
});
