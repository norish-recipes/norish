// @vitest-environment node

import { GET } from "@/app/(app)/avatars/[id]/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: readFileMock,
  },
}));

describe("avatars route caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves avatars with a long-lived immutable cache policy (ADR-0021)", async () => {
    readFileMock.mockResolvedValueOnce(Buffer.from("image-bytes"));

    const response = await GET(
      new Request("http://localhost/app/avatars/test-user-1755000000000.png"),
      {
        params: Promise.resolve({ id: "test-user-1755000000000.png" }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
  });

  it("does not cache 404s for missing avatars", async () => {
    readFileMock.mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    const response = await GET(new Request("http://localhost/app/avatars/gone.png"), {
      params: Promise.resolve({ id: "gone.png" }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
