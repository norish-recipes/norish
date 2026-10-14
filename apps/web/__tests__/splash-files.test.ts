// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { iosSplashImages } from "@norish/shared/lib/pwa/ios-startup-images";

const publicDir = path.resolve(import.meta.dirname, "../public");

describe("iOS splash screens", () => {
  // iOS fetches a startup image once, at add-to-home-screen, and shows nothing
  // when it is missing; a new device shape needs `pnpm generate:splash`.
  it("ships a rendered file for every startup image", () => {
    const missing = iosSplashImages()
      .map(({ url }) => url)
      .filter((url) => !fs.existsSync(path.join(publicDir, url)));

    expect(missing).toEqual([]);
  });
});
