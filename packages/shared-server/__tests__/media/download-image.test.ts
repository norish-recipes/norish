// @vitest-environment node
/**
 * An image URL comes from an imported page, so downloading it reaches a private address only when
 * the administrator allows private addresses, as a page fetch does.
 */
import { mkdtempSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const uploadsDir = mkdtempSync(path.join(os.tmpdir(), "download-image-test-"));
const renderers = vi.hoisted(() => ({ allowPrivateAddresses: false }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { UPLOADS_DIR: uploadsDir, MAX_IMAGE_FILE_SIZE: 5 * 1024 * 1024 },
}));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getMaxVideoFileSize: vi.fn(),
  getPageRenderersConfig: async () => renderers,
}));
vi.mock("@norish/shared-server/logger", () => {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return { serverLogger: logger, createLogger: () => logger };
});

const { downloadImage } = await import("@norish/shared-server/media/storage");

const RECIPE_ID = "0c7fcd0e-4f1a-4f5f-9a5e-92b1a54d21aa";
let server: http.Server;
let url: string;

beforeAll(async () => {
  const jpeg = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#c33" },
  })
    .jpeg()
    .toBuffer();

  server = http.createServer((_request, response) => {
    response.setHeader("content-type", "image/jpeg");
    response.end(jpeg);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/dish.jpg`;
});

afterAll(() => server.close());

describe("downloadImage", () => {
  it("refuses an image on a private address", async () => {
    renderers.allowPrivateAddresses = false;

    await expect(downloadImage(url, RECIPE_ID)).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/private address/) },
    });
  });

  it("downloads it once the administrator allows private addresses", async () => {
    renderers.allowPrivateAddresses = true;

    await expect(downloadImage(url, RECIPE_ID)).resolves.toMatch(
      new RegExp(`/recipes/${RECIPE_ID}/.+\\.jpg$`)
    );
  });
});
