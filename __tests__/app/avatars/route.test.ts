// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";

const readFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: readFileMock,
  },
}));

import { GET } from "@/app/(app)/avatars/[id]/route";

describe("avatars route caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves avatar responses without immutable cache policy", async () => {
    readFileMock.mockResolvedValueOnce(Buffer.from("image-bytes"));

    const response = await GET(new Request("http://localhost/app/avatars/test-user.png"), {
      params: Promise.resolve({ id: "test-user.png" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
