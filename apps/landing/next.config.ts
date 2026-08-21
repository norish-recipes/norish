import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDirectory = dirname(fileURLToPath(import.meta.url));

// basePath/assetPrefix come from env so the same build works at the root domain
// (norish.dev → "") or under a subpath (e.g. "/norish") if ever needed.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export", // emits ./out as fully static HTML/CSS/JS for Cloudflare Pages
  images: { unoptimized: true }, // no image optimizer in a static export
  trailingSlash: true, // /foo → /foo/index.html, served reliably as static files
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  transpilePackages: ["@norish/tailwind-config"],
  // Reaching `next dev` by machine name rather than localhost is a cross-origin
  // request, and Next refuses to serve dev resources to one by default. The
  // page still arrives, but its scripts do not, and every scroll reveal is left
  // hidden — a blank page. Dev only; the static export has no such check.
  allowedDevOrigins: ["*.local", "mac-mini.local"],
  turbopack: {
    root: resolve(configDirectory, "../.."),
  },
  devIndicators: false,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
