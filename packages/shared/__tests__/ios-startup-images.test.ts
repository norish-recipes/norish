import { describe, expect, it } from "vitest";

import {
  generateAppleWebAppSplashScreenConfigs,
  iosSplashSchema,
} from "@norish/shared/lib/pwa/ios-startup-images";

const shape = (width: number, height: number, dpr: number) =>
  iosSplashSchema.find(
    (s) => s.points.width === width && s.points.height === height && s.dpr === dpr
  );

describe("iosSplashSchema device matrix", () => {
  it("covers every currently sold iPhone shape plus the SE/Plus legacy shapes", () => {
    // iOS only shows a splash on an exact device match, so each shape is load-bearing
    expect(shape(375, 667, 2), "iPhone SE class").toBeDefined();
    expect(shape(414, 736, 3), "iPhone 8 Plus class").toBeDefined();
    expect(shape(375, 812, 3), "iPhone 11 Pro / mini class").toBeDefined();
    expect(shape(390, 844, 3), "iPhone 12-14 / 16e / 17e class").toBeDefined();
    expect(shape(393, 852, 3), "iPhone 15 / 16 class").toBeDefined();
    expect(shape(402, 874, 3), "iPhone 16 Pro / 17 class").toBeDefined();
    expect(shape(414, 896, 2), "iPhone 11 / XR").toBeDefined();
    expect(shape(414, 896, 3), "iPhone 11 Pro Max").toBeDefined();
    expect(shape(420, 912, 3), "iPhone Air").toBeDefined();
    expect(shape(430, 932, 3), "iPhone Plus / Pro Max class").toBeDefined();
    expect(shape(440, 956, 3), "iPhone 16/17 Pro Max class").toBeDefined();
  });

  it("covers every currently sold iPad shape", () => {
    expect(shape(744, 1133, 2), "iPad mini").toBeDefined();
    expect(shape(768, 1024, 2), "iPad 9.7 class").toBeDefined();
    expect(shape(810, 1080, 2), "iPad 10.2").toBeDefined();
    expect(shape(820, 1180, 2), "iPad / iPad Air 11").toBeDefined();
    expect(shape(834, 1112, 2), "iPad Air 10.9").toBeDefined();
    expect(shape(834, 1194, 2), "iPad Pro 11 (2018-2022)").toBeDefined();
    expect(shape(834, 1210, 2), "iPad Pro 11 M4").toBeDefined();
    expect(shape(1024, 1366, 2), "iPad Pro 12.9 / Air 13").toBeDefined();
    expect(shape(1032, 1376, 2), "iPad Pro 13 M4").toBeDefined();
  });

  it("derives pixel dimensions exactly from points x dpr", () => {
    for (const s of iosSplashSchema) {
      expect(s.px.width).toBe(s.points.width * s.dpr);
      expect(s.px.height).toBe(s.points.height * s.dpr);
    }
  });

  it("has no duplicate device shapes", () => {
    const keys = iosSplashSchema.map((s) => `${s.points.width}x${s.points.height}@${s.dpr}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("emits portrait+landscape and light+dark entries with exact-match media queries", () => {
    const configs = generateAppleWebAppSplashScreenConfigs();

    expect(configs).toHaveLength(iosSplashSchema.length * 4);

    for (const config of configs) {
      expect(config.media).toMatch(/^screen and \(prefers-color-scheme: (light|dark)\) and /);
      expect(config.media).toContain("(device-width: ");
      expect(config.media).toContain("(device-height: ");
      expect(config.media).toContain("(-webkit-device-pixel-ratio: ");
      expect(config.media).toMatch(/\(orientation: (portrait|landscape)\)$/);
      expect(config.url).toMatch(/^\/images\/splash\?width=\d+&height=\d+&scheme=(light|dark)$/);
    }
  });
});
