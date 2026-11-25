// @vitest-environment node
/** Media for a recipe not stored yet belongs to the account that first uploaded for its id. */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import {
  claimPendingRecipeMedia,
  pendingRecipeMediaUploader,
} from "../../src/media/pending-recipe-media";
import { closeValkeyConnections } from "../../src/valkey/client";
import { startValkey, valkeyUrl } from "../helpers/valkey";

const config = vi.hoisted(() => ({ url: "" }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get VALKEY_URL() {
      return config.url;
    },
  },
}));

let container: StartedValkeyContainer;

beforeAll(async () => {
  container = await startValkey();
  config.url = valkeyUrl(container);
});

afterAll(async () => {
  await closeValkeyConnections();
  await container?.stop();
});

it("holds a pending id for its first uploader alone", async () => {
  const id = crypto.randomUUID();

  expect(await pendingRecipeMediaUploader(id)).toBeNull();
  expect(await claimPendingRecipeMedia(id, "uploader")).toBe(true);
  expect(await claimPendingRecipeMedia(id, "uploader")).toBe(true);
  expect(await claimPendingRecipeMedia(id, "someone-else")).toBe(false);
  expect(await pendingRecipeMediaUploader(id)).toBe("uploader");
});
