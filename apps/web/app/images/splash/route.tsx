import type { NextRequest } from "next/server";
import { ImageResponse } from "next/og";

import { WORDMARK_PATHS, WORDMARK_VIEWBOX } from "./wordmark";

export const runtime = "edge";

const DEFAULT_WIDTH = 1170;
const DEFAULT_HEIGHT = 2532;

// Splash and app must agree on first paint: light pairs the brand cream with
// the wordmark green; dark pairs the app's dark --background token (see
// tooling/tailwind/heroui-theme.css) with the cream the brand uses on dark.
const SCHEME_COLORS = {
  light: { background: "#FFFEF7", wordmark: "#336640" },
  dark: { background: "#14110D", wordmark: "#FFFEF7" },
} as const;

const parseDimension = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 320 || parsed > 4000) {
    return fallback;
  }

  return parsed;
};

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const width = parseDimension(searchParams.get("width"), DEFAULT_WIDTH);
  const height = parseDimension(searchParams.get("height"), DEFAULT_HEIGHT);
  const scheme = searchParams.get("scheme") === "dark" ? "dark" : "light";
  const colors = SCHEME_COLORS[scheme];

  // Same visual weight the old text splash had: 12% of the shorter dimension.
  const wordmarkHeight = Math.max(72, Math.round(Math.min(width, height) * 0.12));
  const wordmarkWidth = Math.round(
    (wordmarkHeight * WORDMARK_VIEWBOX.width) / WORDMARK_VIEWBOX.height
  );

  return new ImageResponse(
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
        viewBox={`0 0 ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`}
        width={wordmarkWidth}
        xmlns="http://www.w3.org/2000/svg"
      >
        {WORDMARK_PATHS.map((d, index) => (
          <path key={index} d={d} fill={colors.wordmark} />
        ))}
      </svg>
    </div>,
    {
      width,
      height,
    }
  );
}
