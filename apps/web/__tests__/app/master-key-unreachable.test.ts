// @vitest-environment node
/**
 * The key file sits under the uploads every media route serves from; no route may hand it out,
 * whatever id or filename a signed-in reader who may view everything sends.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const uploads = vi.hoisted(() => ({ dir: "" }));
const recipeId = "123e4567-e89b-12d3-a456-426614174000";

vi.mock("@norish/config/env-config-server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@norish/config/env-config-server")>();

  return { ...original, SERVER_CONFIG: { ...original.SERVER_CONFIG, UPLOADS_DIR: uploads.dir } };
});
vi.mock("@norish/auth/session", () => ({
  readSessionPrincipal: async () => ({ userId: "user-1", token: "token" }),
}));
vi.mock("@norish/auth/permissions", () => ({ canAccessResource: async () => true }));
vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: async () => ({ id: "household-1", users: [] }),
}));
vi.mock("@norish/db/repositories/recipes", () => ({
  getRecipeHouseholdIds: async (ids: string[]) => new Map(ids.map((id) => [id, "household-1"])),
}));
vi.mock("@norish/db/repositories/cookbooks", () => ({
  getCookbookRow: async () => ({ householdId: "household-1" }),
}));
vi.mock("@norish/shared-server/media/pending-recipe-media", () => ({
  pendingRecipeMediaUploader: async () => null,
}));

// Before the routes load: the avatars route takes its folder at import.
uploads.dir = mkdtempSync(path.join(os.tmpdir(), "master-key-unreachable-"));
mkdirSync(path.join(uploads.dir, ".norish"));
writeFileSync(path.join(uploads.dir, ".norish", "master-key.json"), '{"current":"the-key"}');
mkdirSync(path.join(uploads.dir, "recipes", recipeId), { recursive: true });
writeFileSync(path.join(uploads.dir, "recipes", recipeId, "cover.jpg"), "cover-bytes");

const { GET: getAvatar } = await import("@/app/(app)/avatars/[id]/route");
const { GET: getRecipeMedia } = await import("@/app/(app)/recipes/[id]/[filename]/route");
const { GET: getStepMedia } = await import("@/app/(app)/recipes/[id]/steps/[filename]/route");
const { GET: getCookbookMedia } =
  await import("@/app/(app)/(library)/cookbooks/[id]/[filename]/route");

const request = () => new Request("http://localhost/media");

async function expectRefused(answer: Response) {
  expect(answer.status).not.toBe(200);
  expect(await answer.text()).not.toContain("the-key");
}

describe("the key file over HTTP", () => {
  it("is out of reach of a recipe's, a step's and a cookbook's media", async () => {
    for (const id of ["../.norish", "..", `${recipeId}/../../.norish`]) {
      const params = Promise.resolve({ id, filename: "master-key.json" });

      await expectRefused(await getRecipeMedia(request(), { params }));
      await expectRefused(await getStepMedia(request(), { params }));
      await expectRefused(await getCookbookMedia(request(), { params }));
    }
  });

  it("is out of reach of the avatars", async () => {
    for (const id of ["../.norish/master-key.json", "master-key.json"]) {
      await expectRefused(await getAvatar(request(), { params: Promise.resolve({ id }) }));
    }
  });

  it("while the same reader is served the recipe's own media", async () => {
    const answer = await getRecipeMedia(request(), {
      params: Promise.resolve({ id: recipeId, filename: "cover.jpg" }),
    });

    expect(answer.status).toBe(200);
    expect(await answer.text()).toBe("cover-bytes");
  });
});
