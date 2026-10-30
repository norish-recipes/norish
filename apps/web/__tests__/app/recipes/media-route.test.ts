// @vitest-environment node

import { GET as getRecipeMedia } from "@/app/(app)/recipes/[id]/[filename]/route";
import { GET as getSharedRecipeMedia } from "@/app/share/[token]/media/[filename]/route";
import { GET as getSharedStepMedia } from "@/app/share/[token]/steps/[filename]/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const statMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());
const getActiveRecipeShareByTokenMock = vi.hoisted(() => vi.fn());
const readSessionPrincipal = vi.hoisted(() => vi.fn());
const getRecipeOwnerId = vi.hoisted(() => vi.fn());
const canAccessResource = vi.hoisted(() => vi.fn());

vi.mock("@norish/auth/session", () => ({ readSessionPrincipal }));
vi.mock("@norish/auth/permissions", () => ({ canAccessResource }));
vi.mock("@norish/db", () => ({ isUserServerAdmin: async () => false }));
vi.mock("@norish/db/repositories/recipes", () => ({ getRecipeOwnerId }));
vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: async () => null,
}));

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

describe("a signed-in reader's recipe media", () => {
  const recipeId = "123e4567-e89b-12d3-a456-426614174000";
  const request = () =>
    getRecipeMedia(new Request(`http://localhost/recipes/${recipeId}/cover.jpg`), {
      params: Promise.resolve({ id: recipeId, filename: "cover.jpg" }),
    });

  beforeEach(() => {
    statMock.mockResolvedValue({ size: 12 });
    readFileMock.mockResolvedValue(Buffer.from("file-bytes"));
    getRecipeOwnerId.mockResolvedValue("owner-1");
  });

  it("is served, privately cached, to a reader who may open the recipe", async () => {
    readSessionPrincipal.mockResolvedValueOnce({ userId: "user-1", token: "token" });
    canAccessResource.mockResolvedValueOnce(true);

    const response = await request();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
  });

  it("is answered like a missing file to a signed-in reader who may not open the recipe", async () => {
    readSessionPrincipal.mockResolvedValueOnce({ userId: "user-2", token: "token" });
    canAccessResource.mockResolvedValueOnce(false);

    const response = await request();

    expect(response.status).toBe(404);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("is answered like a missing file without one, uncached, reading nothing", async () => {
    readSessionPrincipal.mockResolvedValueOnce(null);

    const response = await request();

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(readFileMock).not.toHaveBeenCalled();
  });
});
