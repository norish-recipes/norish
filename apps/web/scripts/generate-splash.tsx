/** @jsxRuntime automatic */
/**
 * Renders the iOS splash screens into public/brand/splash, one PNG per
 * startup image in @norish/shared/lib/pwa/ios-startup-images. Rerun after a
 * device shape is added there or public/logo.svg changes:
 *
 *   pnpm --filter @norish/web generate:splash
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

import { iosSplashImages } from "@norish/shared/lib/pwa/ios-startup-images";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../public");

// Splash and app must agree on first paint: each scheme pairs the app's
// --background token (see tooling/tailwind/heroui-theme.css) with the
// wordmark green on light and the cream the brand uses on dark.
const SCHEME_COLORS = {
  light: { background: "#F8F3E7", wordmark: "#336640" },
  dark: { background: "#14110D", wordmark: "#FFFEF7" },
} as const;

async function main() {
  const logo = await readFile(path.join(PUBLIC_DIR, "logo.svg"), "utf8");
  const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(logo);

  if (!viewBox) throw new Error("public/logo.svg has no viewBox");

  const viewBoxWidth = Number(viewBox[1]);
  const viewBoxHeight = Number(viewBox[2]);
  const wordmarkPaths = [...logo.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]);
  const images = iosSplashImages();

  await mkdir(path.join(PUBLIC_DIR, "brand/splash"), { recursive: true });

  for (const { scheme, width, height, url } of images) {
    const colors = SCHEME_COLORS[scheme];
    const wordmarkHeight = Math.max(72, Math.round(Math.min(width, height) * 0.12));
    const wordmarkWidth = Math.round((wordmarkHeight * viewBoxWidth) / viewBoxHeight);

    const image = new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.background,
        }}
      >
        <svg
          height={wordmarkHeight}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          width={wordmarkWidth}
          xmlns="http://www.w3.org/2000/svg"
        >
          {wordmarkPaths.map((d) => (
            <path key={d} d={d} fill={colors.wordmark} />
          ))}
        </svg>
      </div>,
      { width, height }
    );

    await writeFile(path.join(PUBLIC_DIR, url), Buffer.from(await image.arrayBuffer()));
  }

  process.stdout.write(`Wrote ${images.length} splash screens to public/brand/splash\n`);
}

await main();
