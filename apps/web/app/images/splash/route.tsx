import type { NextRequest } from "next/server";
import { ImageResponse } from "next/og";

import { siteConfig } from "@norish/web/config/site";

export const runtime = "edge";

const DEFAULT_WIDTH = 1170;
const DEFAULT_HEIGHT = 2532;

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

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FFFEF7",
        color: "#336640",
        fontSize: Math.max(72, Math.round(Math.min(width, height) * 0.12)),
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      {siteConfig.name}
    </div>,
    {
      width,
      height,
    }
  );
}
