/**
 * iOS `apple-touch-startup-image` device matrix.
 *
 * iOS shows a splash ONLY on an exact match of device points x DPR x
 * orientation — it never synthesizes one, so a near-miss device silently gets
 * no splash at all. The matrix below must therefore cover every currently
 * sold iPhone/iPad shape plus the SE/Plus legacy shapes still in the wild.
 *
 * MAINTENANCE (September, every year): after Apple's fall hardware event,
 * check the new devices' point sizes and add any new shape here. Devices that
 * reuse an existing points x DPR pair need no entry (only a label update).
 *
 * RETESTING: iOS freezes the splash per install at add-to-home-screen time.
 * Any change here (or to the /images/splash route) is invisible to an
 * existing installation — remove the PWA from the home screen and re-add it
 * before judging a splash change.
 */
type Orientation = "portrait" | "landscape";

type AppleWebAppStartupImage = {
  media: string;
  url: string;
};

type AppleDeviceCategory = "iphone" | "ipad";

export type IOSSplashSpec = {
  category: AppleDeviceCategory;
  points: { width: number; height: number };
  dpr: 2 | 3;
  px: { width: number; height: number };
  label?: string;
  released?: string;
};

const spec = (
  category: AppleDeviceCategory,
  widthPoints: number,
  heightPoints: number,
  dpr: 2 | 3,
  meta?: Omit<IOSSplashSpec, "category" | "points" | "dpr" | "px">
): IOSSplashSpec => ({
  category,
  points: { width: widthPoints, height: heightPoints },
  dpr,
  px: { width: widthPoints * dpr, height: heightPoints * dpr },
  ...meta,
});

export const iosSplashSchema: readonly IOSSplashSpec[] = [
  spec("iphone", 440, 956, 3, { label: "iPhone 16/17 Pro Max class", released: "2024-09-09" }),
  spec("iphone", 430, 932, 3, { label: "iPhone Plus / Pro Max class", released: "2022-09-16" }),
  spec("iphone", 420, 912, 3, { label: "iPhone Air", released: "2025-09-09" }),
  spec("iphone", 414, 896, 3, { label: "iPhone 11 Pro Max", released: "2019-09-20" }),
  spec("iphone", 414, 896, 2, { label: "iPhone 11", released: "2019-09-20" }),
  spec("iphone", 414, 736, 3, { label: "iPhone 6/7/8 Plus class", released: "2014-09-19" }),
  spec("iphone", 402, 874, 3, { label: "iPhone 16 Pro / 17 class", released: "2024-09-09" }),
  spec("iphone", 393, 852, 3, { label: "iPhone 15/16 Pro class", released: "2022-09-16" }),
  spec("iphone", 390, 844, 3, {
    label: "iPhone 12/13/14 / 16e / 17e class",
    released: "2020-10-13",
  }),
  spec("iphone", 375, 812, 3, { label: "iPhone 11 Pro / mini class", released: "2019-09-20" }),
  spec("iphone", 375, 667, 2, { label: "iPhone SE / 6/7/8 class", released: "2014-09-19" }),

  spec("ipad", 1032, 1376, 2, { label: "iPad Pro 13", released: "2024-05-15" }),
  spec("ipad", 1024, 1366, 2, { label: "iPad Pro 12.9 class", released: "2015-11-11" }),
  spec("ipad", 834, 1210, 2, { label: "iPad Pro 11 M4", released: "2024-05-15" }),
  spec("ipad", 834, 1194, 2, { label: "iPad Pro 11 (2018-2022)", released: "2018-11-07" }),
  spec("ipad", 834, 1112, 2, { label: "iPad Air 10.9", released: "2020-10-23" }),
  spec("ipad", 820, 1180, 2, { label: "iPad Air 11", released: "2024-05-15" }),
  spec("ipad", 810, 1080, 2, { label: "iPad 10.2", released: "2019-09-30" }),
  spec("ipad", 768, 1024, 2, { label: "iPad 9.7 class", released: "2010-04-03" }),
  spec("ipad", 744, 1133, 2, { label: "iPad mini 8.3", released: "2021-09-24" }),
];

type ColorScheme = "light" | "dark";

export const mediaQuery = (specification: IOSSplashSpec, orientation: Orientation) =>
  [
    `(device-width: ${specification.points.width}px)`,
    `(device-height: ${specification.points.height}px)`,
    `(-webkit-device-pixel-ratio: ${specification.dpr})`,
    `(orientation: ${orientation})`,
  ].join(" and ");

export const generateAppleWebAppSplashScreenConfigs = (): AppleWebAppStartupImage[] => {
  return iosSplashSchema.flatMap((specification) => {
    const orientations: Orientation[] = ["portrait", "landscape"];
    // Startup images are static link tags, so the OS scheme is the only theme
    // signal they can ever follow. Best-effort: no primary source confirms iOS
    // evaluates prefers-color-scheme at launch, so keep emitting both schemes
    // but never rely on the dark variant being picked. Both schemes are
    // explicit: exactly one entry matches per device, orientation, and scheme.
    const schemes: ColorScheme[] = ["light", "dark"];

    return orientations.flatMap((orientation) => {
      const isPortrait = orientation === "portrait";
      const width = isPortrait ? specification.px.width : specification.px.height;
      const height = isPortrait ? specification.px.height : specification.px.width;

      return schemes.map((scheme) => ({
        media: `screen and (prefers-color-scheme: ${scheme}) and ${mediaQuery(specification, orientation)}`,
        url: `/images/splash?width=${width}&height=${height}&scheme=${scheme}`,
      }));
    });
  });
};
