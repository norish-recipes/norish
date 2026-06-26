import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDirectory = dirname(fileURLToPath(import.meta.url));

// basePath/assetPrefix come from env so the same build works for a custom domain
// at the root (norish.dev → "") or a GitHub project-page subpath (e.g. "/norish").
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export", // emits ./out as fully static HTML/CSS/JS for GitHub Pages
  images: { unoptimized: true }, // no image optimizer in a static export
  trailingSlash: true, // /foo → /foo/index.html, served reliably by GitHub Pages
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  transpilePackages: ["@norish/tailwind-config"],
  turbopack: {
    root: resolve(configDirectory, "../.."),
  },
  devIndicators: false,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
