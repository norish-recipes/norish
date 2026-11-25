// @vitest-environment node
/** Media for a recipe not stored yet belongs to the upload that wrote its first file, or no one. */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import {
  mayUsePendingRecipeId,
  pendingRecipeMediaUploader,
  releasePendingRecipeId,
} from "../../src/media/pending-recipe-media";
import { closeValkeyConnections, getPublisherClient } from "../../src/valkey/client";
import { startValkey, valkeyUrl } from "../helpers/valkey";

const config = vi.hoisted(() => ({ url: "", uploads: "" }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get VALKEY_URL() {
      return config.url;
    },
    get UPLOADS_DIR() {
      return config.uploads;
    },
  },
}));

let container: StartedValkeyContainer;

beforeAll(async () => {
  container = await startValkey();
  config.url = valkeyUrl(container);
  config.uploads = await mkdtemp(path.join(tmpdir(), "norish-pending-media-"));
});

afterAll(async () => {
  await closeValkeyConnections();
  await container?.stop();
  await rm(config.uploads, { recursive: true, force: true });
});

async function writeFirstFile(id: string): Promise<void> {
  await mkdir(path.join(config.uploads, "recipes", id), { recursive: true });
  await writeFile(path.join(config.uploads, "recipes", id, "a.jpg"), "bytes");
}

it("holds a pending id for its first uploader alone", async () => {
  const id = crypto.randomUUID();

  expect(await pendingRecipeMediaUploader(id)).toBeNull();
  expect(await mayUsePendingRecipeId(id, "uploader", "delete")).toBe(false);
  expect(await mayUsePendingRecipeId(id, "uploader", "upload")).toBe(true);
  await writeFirstFile(id);
  expect(await mayUsePendingRecipeId(id, "uploader", "upload")).toBe(true);
  expect(await mayUsePendingRecipeId(id, "uploader", "delete")).toBe(true);
  expect(await mayUsePendingRecipeId(id, "uploader", "create")).toBe(true);
  expect(await mayUsePendingRecipeId(id, "someone-else", "upload")).toBe(false);
  expect(await mayUsePendingRecipeId(id, "someone-else", "create")).toBe(false);
  expect(await pendingRecipeMediaUploader(id)).toBe("uploader");
});

it("gives files whose claim is lost to no one", async () => {
  const id = crypto.randomUUID();

  expect(await mayUsePendingRecipeId(id, "uploader", "upload")).toBe(true);
  await writeFirstFile(id);
  await (await getPublisherClient()).del(`norish:pending-recipe-media:${id}`);

  for (const account of ["uploader", "someone-else"]) {
    expect(await mayUsePendingRecipeId(id, account, "upload")).toBe(false);
    expect(await mayUsePendingRecipeId(id, account, "delete")).toBe(false);
    expect(await mayUsePendingRecipeId(id, account, "create")).toBe(false);
  }
  expect(await pendingRecipeMediaUploader(id)).toBeNull();
});

it("lets a create without files through without claiming the id", async () => {
  const id = crypto.randomUUID();

  expect(await mayUsePendingRecipeId(id, "creator", "create")).toBe(true);
  expect(await pendingRecipeMediaUploader(id)).toBeNull();
});

it("accepts only the database's spelling of an id", async () => {
  const id = crypto.randomUUID();

  expect(await mayUsePendingRecipeId(id.toUpperCase(), "uploader", "upload")).toBe(false);
  expect(await mayUsePendingRecipeId(id.toUpperCase(), "uploader", "create")).toBe(false);
});

it("gives back the claim of an upload that wrote no file, and keeps one that did", async () => {
  const rejected = crypto.randomUUID();
  const written = crypto.randomUUID();

  for (const id of [rejected, written]) {
    expect(await mayUsePendingRecipeId(id, "uploader", "upload")).toBe(true);
  }
  await writeFirstFile(written);
  await releasePendingRecipeId(rejected, "uploader");
  await releasePendingRecipeId(written, "uploader");
  await releasePendingRecipeId(written, "someone-else");

  expect(await pendingRecipeMediaUploader(rejected)).toBeNull();
  expect(await mayUsePendingRecipeId(rejected, "someone-else", "upload")).toBe(true);
  expect(await pendingRecipeMediaUploader(written)).toBe("uploader");
});
