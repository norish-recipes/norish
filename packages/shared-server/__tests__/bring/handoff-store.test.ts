// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BRING_HANDOFF_TTL_SECONDS,
  createHandoff,
  deleteHandoff,
  handoffImageFor,
  readHandoff,
  updateHandoff,
} from "@norish/shared-server/bring/handoff-store";

const store = new Map<string, { value: string; ttl: number | null }>();
/** Valkey's SET as the store uses it: EX sets a deadline, KEEPTTL keeps it, XX needs the key. */
const fakeValkey = {
  set: vi.fn(async (key: string, value: string, ...options: (string | number)[]) => {
    const existing = store.get(key);

    if (options.includes("XX") && !existing) return null;

    const ex = options.indexOf("EX");
    const ttl =
      ex >= 0
        ? Number(options[ex + 1])
        : options.includes("KEEPTTL")
          ? (existing?.ttl ?? null)
          : null;

    store.set(key, { value, ttl });

    return "OK";
  }),
  get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
  del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
};

vi.mock("@norish/shared-server/valkey/client", () => ({
  getPublisherClient: async () => fakeValkey,
}));

const OWNER = "user-1";
const OTHER = "user-2";
const content = { title: "Pasta", servings: 4, lines: ["2 Eier"] };
const keyOf = (token: string) => `norish:bring:handoff:${token}`;

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("the Bring Handoff store", () => {
  it("keeps the lines under a 32-character url-safe token for an hour", async () => {
    const token = await createHandoff(content, OWNER);

    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(BRING_HANDOFF_TTL_SECONDS).toBe(3600);
    expect(store.get(keyOf(token))?.ttl).toBe(3600);
  });

  it("stores the title, servings, lines, picture, creation time and owner only", async () => {
    const token = await createHandoff(content, OWNER);
    const stored = JSON.parse(store.get(keyOf(token))?.value ?? "{}");

    expect(Object.keys(stored).sort()).toEqual([
      "createdAt",
      "image",
      "lines",
      "ownerId",
      "servings",
      "title",
    ]);
    expect(stored.image).toBeNull();
    expect(stored.ownerId).toBe(OWNER);
  });

  it("gives every handoff its own token", async () => {
    expect(await createHandoff(content, OWNER)).not.toBe(await createHandoff(content, OWNER));
  });

  it("reads a handoff's page back, again and again, without its owner", async () => {
    const token = await createHandoff(content, OWNER);
    const expected = {
      title: "Pasta",
      servings: 4,
      lines: ["2 Eier"],
      image: null,
      createdAt: expect.any(Number),
    };

    await expect(readHandoff(token)).resolves.toStrictEqual(expected);
    await expect(readHandoff(token)).resolves.toStrictEqual(expected);
    expect(fakeValkey.del).not.toHaveBeenCalled();
  });

  it("answers null for an unknown token and for a record that is not a handoff", async () => {
    store.set(keyOf("junk"), { value: "{not json", ttl: 1 });
    store.set(keyOf("odd"), { value: JSON.stringify({ title: 1 }), ttl: 1 });

    await expect(readHandoff("missing")).resolves.toBeNull();
    await expect(readHandoff("junk")).resolves.toBeNull();
    await expect(readHandoff("odd")).resolves.toBeNull();
  });

  it("answers null for a record stored without an owner", async () => {
    store.set(keyOf("ownerless"), {
      value: JSON.stringify({ ...content, image: null, createdAt: 1 }),
      ttl: 1,
    });

    await expect(readHandoff("ownerless")).resolves.toBeNull();
  });
});

describe("changing a handoff", () => {
  it("replaces the owner's lines and keeps the creation time, the owner and the deadline", async () => {
    const token = await createHandoff(content, OWNER);
    const before = JSON.parse(store.get(keyOf(token))?.value ?? "{}");

    store.set(keyOf(token), { ...store.get(keyOf(token))!, ttl: 1200 });

    await expect(
      updateHandoff(token, OWNER, { title: "Lasagne", servings: 2, lines: ["1 Ei", "Salz"] })
    ).resolves.toBe(true);

    expect(fakeValkey.set).toHaveBeenLastCalledWith(
      keyOf(token),
      expect.any(String),
      "KEEPTTL",
      "XX"
    );
    expect(store.get(keyOf(token))?.ttl).toBe(1200);
    expect(JSON.parse(store.get(keyOf(token))?.value ?? "{}")).toMatchObject({
      ownerId: OWNER,
      createdAt: before.createdAt,
    });
    await expect(readHandoff(token)).resolves.toMatchObject({
      title: "Lasagne",
      servings: 2,
      lines: ["1 Ei", "Salz"],
      image: null,
    });
  });

  it("answers false, and changes nothing, for someone else's handoff", async () => {
    const token = await createHandoff(content, OWNER);

    await expect(updateHandoff(token, OTHER, { ...content, lines: ["Salz"] })).resolves.toBe(false);
    await expect(readHandoff(token)).resolves.toMatchObject({ lines: ["2 Eier"] });
  });

  it("answers false for a handoff that is gone, and does not bring it back", async () => {
    await expect(updateHandoff("missing", OWNER, content)).resolves.toBe(false);
    expect(store.has(keyOf("missing"))).toBe(false);
  });

  it("answers false when the handoff expires between the read and the write", async () => {
    const token = await createHandoff(content, OWNER);

    fakeValkey.set.mockImplementationOnce(async () => null);

    await expect(updateHandoff(token, OWNER, content)).resolves.toBe(false);
  });
});

describe("taking a handoff down", () => {
  it("removes the owner's handoff at once", async () => {
    const token = await createHandoff(content, OWNER);

    await deleteHandoff(token, OWNER);

    expect(fakeValkey.del).toHaveBeenCalledWith(keyOf(token));
    await expect(readHandoff(token)).resolves.toBeNull();
  });

  it("leaves someone else's handoff alone", async () => {
    const token = await createHandoff(content, OWNER);

    await deleteHandoff(token, OTHER);

    expect(fakeValkey.del).not.toHaveBeenCalled();
    await expect(readHandoff(token)).resolves.not.toBeNull();
  });

  it("does nothing for an unknown token", async () => {
    await deleteHandoff("missing", OWNER);

    expect(fakeValkey.del).not.toHaveBeenCalled();
  });
});

describe("a handoff's picture", () => {
  const RECIPE = "123e4567-e89b-42d3-a456-426614174000";

  it("keeps a file this instance stores for the recipe, by its name alone", () => {
    expect(handoffImageFor(RECIPE, `/recipes/${RECIPE}/gallery-abc_1.webp`)).toEqual({
      recipeId: RECIPE,
      file: "gallery-abc_1.webp",
    });
  });

  it("keeps an imported picture's https address", () => {
    expect(handoffImageFor(RECIPE, "https://cdn.example/pasta.jpg")).toEqual({
      url: "https://cdn.example/pasta.jpg",
    });
  });

  it.each([
    ["no picture", null],
    ["another recipe's file", "/recipes/00000000-0000-4000-8000-000000000000/a.jpg"],
    ["a step's file", `/recipes/${RECIPE}/steps/a.jpg`],
    ["a path that climbs out", `/recipes/${RECIPE}/../a.jpg`],
    ["plain http", "http://cdn.example/pasta.jpg"],
  ])("carries none for %s", (_, image) => {
    expect(handoffImageFor(RECIPE, image)).toBeNull();
  });

  it("is stored and read back with the handoff", async () => {
    const image = { recipeId: RECIPE, file: "a.jpg" };
    const token = await createHandoff({ title: "Pasta", servings: 4, lines: ["x"], image }, OWNER);

    await expect(readHandoff(token)).resolves.toMatchObject({ image });
  });
});
