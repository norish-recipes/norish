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
  skipNodeModulesBundle: true,

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

    // Playwright must be external to avoid esbuild __name transpilation issues with page.evaluate()
    "playwright-core",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
  ],
});
