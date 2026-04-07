// @vitest-environment node

import { GET as getSharedRecipeMedia } from "@/app/share/[token]/media/[filename]/route";
import { GET as getSharedStepMedia } from "@/app/share/[token]/steps/[filename]/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const statMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());
const getActiveRecipeShareByTokenMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
  default: {
    stat: statMock,
    readFile: readFileMock,
  },
}));

vi.mock("@norish/db/repositories/recipe-shares", () => ({
  getActiveRecipeShareByToken: getActiveRecipeShareByTokenMock,
}));

describe("recipe media share access", () => {
  const recipeId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
    statMock.mockResolvedValue({ size: 12 });
    readFileMock.mockResolvedValue(Buffer.from("file-bytes"));
  });

  it("serves shared recipe media anonymously with no-store cache headers", async () => {
    getActiveRecipeShareByTokenMock.mockResolvedValue({ id: "share-1", recipeId });

    const response = await getSharedRecipeMedia(
      new Request("http://localhost/share/public-token/media/cover.jpg"),
      { params: Promise.resolve({ token: "public-token", filename: "cover.jpg" }) }
    );

    expect(response.status).toBe(200);
    expect(getActiveRecipeShareByTokenMock).toHaveBeenCalledWith("public-token", {
      touchLastAccessedAt: true,
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns not found for invalid shared media tokens", async () => {
    getActiveRecipeShareByTokenMock.mockResolvedValue(null);

    const response = await getSharedRecipeMedia(
      new Request("http://localhost/share/bad-token/media/cover.jpg"),
      {
        params: Promise.resolve({ token: "bad-token", filename: "cover.jpg" }),
      }
    );

    expect(response.status).toBe(404);
  });

  it("serves shared step media anonymously with no-store cache headers", async () => {
    getActiveRecipeShareByTokenMock.mockResolvedValue({ id: "share-1", recipeId });

    const response = await getSharedStepMedia(
      new Request("http://localhost/share/public-token/steps/step.jpg"),
      { params: Promise.resolve({ token: "public-token", filename: "step.jpg" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
