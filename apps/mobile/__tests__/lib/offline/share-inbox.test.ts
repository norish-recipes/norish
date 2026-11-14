import type { ShareImportOptions, ShareImports, ShareInbox } from "@/lib/offline/share-inbox";
import { drainShareInbox, withSavedShares } from "@/lib/offline/share-inbox";
import { describe, expect, it, vi } from "vitest";

import type { ImportSettled } from "@norish/shared-react/recipes";
import { markOutboxAdmissionFailed } from "@norish/shared/lib/trpc-errors";

// The signed-in account, as the Outbox's owner id.
const OWNER = "user-a";
const owner = () => OWNER;

/** The Outbox link's Queued signal: unreachable, and durably admitted. */
const queued = () => new TypeError("Network request failed");
const unauthorized = () => ({ data: { code: "UNAUTHORIZED", httpStatus: 401 } });
const refused = () => ({ data: { code: "BAD_REQUEST", httpStatus: 400 } });

/** An App Group inbox in memory: item JSON by id, images by name. */
function fakeInbox(items: Record<string, object | string>, images: Record<string, Blob> = {}) {
  const json = new Map(
    Object.entries(items).map(([id, item]) => [
      id,
      typeof item === "string" ? item : JSON.stringify({ ownerId: OWNER, ...item }),
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

/** Imports that settle as `answer` says, recording what they were given and the operation ids. */
function fakeImports(answer: (kind: string) => unknown = () => null) {
  const calls: [string, unknown][] = [];
  const operationIds: unknown[] = [];
  const run =
    (kind: string) =>
    (input: unknown, { onSettled, operationId }: ShareImportOptions): void => {
      calls.push([kind, input]);
      operationIds.push(operationId);
      queueMicrotask(() => onSettled(answer(kind)));
    };
  const imports: ShareImports = { url: run("url"), text: run("text"), images: run("images") };

  return { imports, calls, operationIds };
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

    await drainShareInbox(inbox, owner, imports);

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
      url: (_url, { onSettled }) => {
        pending.settle = onSettled;
      },
      text: vi.fn(),
      images: vi.fn(),
    };

    const drained = drainShareInbox(inbox, owner, imports);

    await vi.waitFor(() => expect(pending.settle).toBeDefined());
    expect(json.has("a")).toBe(true);
    pending.settle?.(queued());
    await drained;
    expect(json.has("a")).toBe(false);
  });

  it("skips and removes a corrupt item and an item missing an image", async () => {
    const { inbox, json } = fakeInbox({
      broken: "{not json",
      wrong: { kind: "video", url: "https://example.com" },
      missing: { kind: "images", images: ["missing-0.jpg"] },
      escape: { kind: "images", images: ["../secrets.jpg"] },
      unowned: { kind: "url", url: "https://example.com/a", ownerId: "" },
      good: { kind: "url", url: "https://example.com/b" },
    });
    const { imports, calls } = fakeImports();

    await drainShareInbox(inbox, owner, imports);

    expect(calls).toEqual([["url", "https://example.com/b"]]);
    expect(json.size).toBe(0);
  });

  it("drops an item the server refused for good", async () => {
    const { inbox, json } = fakeInbox({ a: { kind: "url", url: "https://example.com/a" } });

    await drainShareInbox(inbox, owner, fakeImports(refused).imports);

    expect(json.size).toBe(0);
  });

  it("keeps an item the server may yet take and carries on with the next", async () => {
    const statuses = [500, 502, 503, 504, 408, 429];
    const { inbox, json } = fakeInbox({
      ...Object.fromEntries(
        statuses.map((status) => [`s${status}`, { kind: "text", text: String(status) }])
      ),
      gone: { kind: "url", url: "https://example.com/gone" },
    });
    const answer = (input: unknown) =>
      input === "https://example.com/gone"
        ? { data: { code: "NOT_FOUND", httpStatus: 404 } }
        : { data: { code: "ERROR", httpStatus: Number(input) } };
    const calls: unknown[] = [];
    const run = (input: unknown, { onSettled }: ShareImportOptions) => {
      calls.push(input);
      queueMicrotask(() => onSettled(answer(input)));
    };

    await drainShareInbox(inbox, owner, { url: run, text: run, images: run });

    expect(calls).toHaveLength(statuses.length + 1);
    expect([...json.keys()]).toEqual(statuses.map((status) => `s${status}`));
  });

  it("keeps everything while signed out, and items wait for the next drain", async () => {
    const { inbox, json } = fakeInbox({
      a: { kind: "url", url: "https://example.com/a" },
      b: { kind: "url", url: "https://example.com/b" },
    });
    const { imports, calls } = fakeImports(unauthorized);

    await drainShareInbox(inbox, owner, imports);

    expect(calls).toHaveLength(1);
    expect([...json.keys()]).toEqual(["a", "b"]);

    await drainShareInbox(inbox, owner, fakeImports().imports);
    expect(json.size).toBe(0);
  });

  it("keeps an item whose Outbox admission failed", async () => {
    const { inbox, json } = fakeInbox({ a: { kind: "url", url: "https://example.com/a" } });
    const lost = () => {
      const error = queued();

      markOutboxAdmissionFailed(error);

      return error;
    };

    await drainShareInbox(inbox, owner, fakeImports(lost).imports);

    expect(json.has("a")).toBe(true);
  });

  it("imports each item under its own id as the operation id, the same id again after a kill", async () => {
    const { inbox } = fakeInbox({
      "share-1": { kind: "url", url: "https://example.com/a" },
      "share-2": { kind: "text", text: "Soup" },
    });
    const { imports, operationIds } = fakeImports();
    // Killed after the server took the import, before the item left the inbox.
    const remove = inbox.remove;

    inbox.remove = () => undefined;
    await drainShareInbox(inbox, owner, imports);
    inbox.remove = remove;
    await drainShareInbox(inbox, owner, imports);

    expect(operationIds).toEqual(["share-1", "share-2", "share-1", "share-2"]);
  });

  it("stops when the session ends mid-drain: the next item is neither imported nor removed", async () => {
    const { inbox, json } = fakeInbox({
      a: { kind: "url", url: "https://example.com/a" },
      b: { kind: "url", url: "https://example.com/b" },
    });
    let current: string | null = OWNER;
    const calls: unknown[] = [];
    const run = (url: unknown, { onSettled }: ShareImportOptions) => {
      calls.push(url);
      // A's session expires and B signs in while A's first import is in flight.
      current = "user-b";
      queueMicrotask(() => onSettled(null));
    };

    await drainShareInbox(inbox, () => current, { url: run, text: run, images: run });

    expect(calls).toEqual(["https://example.com/a"]);
    expect([...json.keys()]).toEqual(["b"]);
  });

  it("imports an item once when the drain runs twice", async () => {
    const { inbox } = fakeInbox({
      a: { kind: "url", url: "https://example.com/a" },
      b: { kind: "text", text: "Soup" },
    });
    const { imports, calls } = fakeImports();

    await Promise.all([
      drainShareInbox(inbox, owner, imports),
      drainShareInbox(inbox, owner, imports),
    ]);
    await drainShareInbox(inbox, owner, imports);

    expect(calls).toEqual([
      ["url", "https://example.com/a"],
      ["text", "Soup"],
    ]);
  });
});

describe("saved shares at a session end", () => {
  const engine = (owner: string | null) => ({
    cache: { owner: () => owner },
    unsyncedChanges: vi.fn(async () => 1),
    clearForSignOut: vi.fn(async (_options: { discardQueue: boolean }) => undefined),
  });

  it("keeps A's share for A alone: B on the same server imports nothing", async () => {
    // A shared offline; A's session expired, which keeps the Outbox, and B signed in.
    const { inbox, json } = fakeInbox({ a: { kind: "text", text: "A's soup" } });
    const expiry = withSavedShares(engine(OWNER), () => inbox);

    await expiry.clearForSignOut({ discardQueue: false });
    const { imports, calls } = fakeImports();

    await drainShareInbox(inbox, () => "user-b", imports);

    expect(calls).toEqual([]);
    expect(json.has("a")).toBe(true);

    await drainShareInbox(inbox, owner, imports);
    expect(calls).toEqual([["text", "A's soup"]]);
  });

  it("counts the owner's shares as unsynced and discards them, files included, with its Outbox", async () => {
    const page = new Blob(["jpeg"]);
    const { inbox, json, images } = fakeInbox(
      {
        a: { kind: "images", images: ["a-0.jpg"] },
        b: { kind: "url", url: "https://example.com/b" },
        other: { kind: "url", url: "https://example.com/c", ownerId: "user-b" },
      },
      { "a-0.jpg": page }
    );
    const base = engine(OWNER);
    const signOut = withSavedShares(base, () => inbox);

    expect(await signOut.unsyncedChanges()).toBe(3);

    await signOut.clearForSignOut({ discardQueue: true });

    expect([...json.keys()]).toEqual(["other"]);
    expect(images).toEqual({});
    expect(base.clearForSignOut).toHaveBeenCalledWith({ discardQueue: true });
  });

  it("clears the engine even when there is no inbox or owner", async () => {
    const base = engine(null);
    const signOut = withSavedShares(base, () => null);

    expect(await signOut.unsyncedChanges()).toBe(1);
    await signOut.clearForSignOut({ discardQueue: true });
    expect(base.clearForSignOut).toHaveBeenCalled();
  });
});
