import { IMAGE_CACHE_NAME } from "@/lib/offline/cache-names";
import { warmPrimaryImages } from "@/lib/offline/warm-images";
import { afterEach, describe, expect, it, vi } from "vitest";

const expirationMetadata = vi.hoisted(() => ({
  updateTimestamp: vi.fn(async (_url: string) => {}),
  expireEntries: vi.fn(async () => {}),
}));

vi.mock("serwist", () => ({
  CacheExpiration: class {
    updateTimestamp(url: string) {
      return expirationMetadata.updateTimestamp(url);
    }

    expireEntries() {
      return expirationMetadata.expireEntries();
    }
  },
}));

describe("warmPrimaryImages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores warmed recipes' same-origin primary images", async () => {
    const put = vi.fn(async () => {});
    const open = vi.fn(async () => ({ match: vi.fn(async () => undefined), put }));

    vi.stubGlobal("caches", { open });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("image", { status: 200 }))
    );

    await expect(warmPrimaryImages([{ id: "r1", image: "/uploads/r1.jpg" }])).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith(IMAGE_CACHE_NAME);
    expect(put).toHaveBeenCalledWith(
      new URL("/uploads/r1.jpg", window.location.href).toString(),
      expect.any(Response)
    );
    expect(expirationMetadata.expireEntries).toHaveBeenCalled();
  });

  it("reports an image it could not keep", async () => {
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ match: vi.fn(async () => undefined), put: vi.fn() })),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 }))
    );

    await expect(warmPrimaryImages([{ id: "r1", image: "/uploads/r1.jpg" }])).resolves.toBe(false);
  });
});
