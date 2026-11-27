// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BRING_HANDOFF_TTL_SECONDS,
  createHandoff,
  deleteHandoff,
  handoffImageFor,
  readHandoff,
} from "@norish/shared-server/bring/handoff-store";

const store = new Map<string, { value: string; ttl: number | null }>();
const fakeValkey = {
  set: vi.fn(async (key: string, value: string, mode?: string, ttl?: number) => {
    store.set(key, { value, ttl: mode === "EX" ? (ttl ?? null) : null });

    return "OK";
  }),
  get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
  del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
};

vi.mock("@norish/shared-server/valkey/client", () => ({
  getPublisherClient: async () => fakeValkey,
}));

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("the Bring Handoff store", () => {
  it("keeps the lines under a 32-character url-safe token for an hour", async () => {
    const token = await createHandoff({ title: "Pasta", servings: 4, lines: ["2 Eier"] });

    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(BRING_HANDOFF_TTL_SECONDS).toBe(3600);
    expect(store.get(`norish:bring:handoff:${token}`)?.ttl).toBe(3600);
  });

  it("stores the title, servings, lines, picture and creation time only", async () => {
    const token = await createHandoff({ title: "Pasta", servings: 4, lines: ["2 Eier"] });
    const stored = JSON.parse(store.get(`norish:bring:handoff:${token}`)?.value ?? "{}");

    expect(Object.keys(stored).sort()).toEqual([
      "createdAt",
      "image",
      "lines",
      "servings",
      "title",
    ]);
    expect(stored.image).toBeNull();
  });

  it("gives every handoff its own token", async () => {
    const input = { title: "Pasta", servings: 1, lines: ["x"] };

    expect(await createHandoff(input)).not.toBe(await createHandoff(input));
  });

  it("reads a handoff back, again and again", async () => {
    const token = await createHandoff({ title: "Pasta", servings: 4, lines: ["2 Eier"] });
    const expected = {
      title: "Pasta",
      servings: 4,
      lines: ["2 Eier"],
      image: null,
      createdAt: expect.any(Number),
    };

    await expect(readHandoff(token)).resolves.toEqual(expected);
    await expect(readHandoff(token)).resolves.toEqual(expected);
    expect(fakeValkey.del).not.toHaveBeenCalled();
  });

  it("takes a handoff that was never handed over away at once", async () => {
    const token = await createHandoff({ title: "Pasta", servings: 4, lines: ["2 Eier"] });

    await deleteHandoff(token);

    expect(fakeValkey.del).toHaveBeenCalledWith(`norish:bring:handoff:${token}`);
    await expect(readHandoff(token)).resolves.toBeNull();
  });

  it("answers null for an unknown token and for a record that is not a handoff", async () => {
    store.set("norish:bring:handoff:junk", { value: "{not json", ttl: 1 });
    store.set("norish:bring:handoff:odd", { value: JSON.stringify({ title: 1 }), ttl: 1 });

    await expect(readHandoff("missing")).resolves.toBeNull();
    await expect(readHandoff("junk")).resolves.toBeNull();
    await expect(readHandoff("odd")).resolves.toBeNull();
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
    const token = await createHandoff({ title: "Pasta", servings: 4, lines: ["x"], image });

    await expect(readHandoff(token)).resolves.toMatchObject({ image });
  });
});
