import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["server.ts"],
  format: ["cjs"],
  outDir: "dist-server",
  tsconfig: "tsconfig.server.json",
  clean: true,
  treeshake: true,
  minify: true,
  platform: "node",

  // Externalize packages that cannot be bundled
  external: [
    // Native bindings
    "pg",

    // Next.js runtime
    "next",
    "react",
    "react-dom",

    // Packages with subpath exports (can't be bundled)
    "drizzle-orm",
    "drizzle-zod",
    "zod",

    // Image processing with native/WASM binaries
    "sharp",
    "heic-convert",

    "yt-dlp-wrap",

    "server-only",
  ],

  // Bundle everything else
  noExternal: [
    // Auth
    "better-auth",
    "jose",

    // Web scraping/parsing
    "cheerio",
    "@mozilla/readability",
    "microdata-node",

    // Playwright
    "playwright-core",

    // File handling
    "jszip",

    // AI
    "openai",

    // Utilities
    "uuid",
    "mime",
    "array-flatten",
    "parse-ingredient",
    "jsonrepair",
    "ws",

    // Cron scheduling
    "node-cron",
  ],
});
