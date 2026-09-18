// @vitest-environment node

import { GET } from "@/app/(app)/ingredient-images/[filename]/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: readFileMock,
  },
}));

const FILE = "7d5b3c1e-2a4f-4c6d-8e9f-0a1b2c3d4e5f-mf0abc12ff.webp";

function get(filename: string) {
  return GET(new Request(`http://localhost/ingredient-images/${filename}`), {
    params: Promise.resolve({ filename }),
  });
}

describe("ingredient images route (ADR-0037)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves a picture as immutable WebP a shared page may cache", async () => {
    readFileMock.mockResolvedValueOnce(Buffer.from("webp-bytes"));

    const response = await get(FILE);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  it.each(["../secrets.webp", "not-a-picture.png", "..%2F..%2Fetc.webp"])(
    "refuses a filename that is not a stored picture's: %s",
    async (filename) => {
      const response = await get(filename);

      expect(response.status).toBe(400);
      expect(readFileMock).not.toHaveBeenCalled();
    }
  );

  it("does not cache a missing picture", async () => {
    readFileMock.mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    const response = await get(FILE);

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
