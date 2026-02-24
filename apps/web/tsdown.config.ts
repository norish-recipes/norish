import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["server/index.ts"],
  format: ["cjs"],
  outDir: "../../dist-server",
  tsconfig: "./tsconfig.server.json",
  clean: true,
  treeshake: true,
  minify: true,
  platform: "node",
  skipNodeModulesBundle: true,
  external: [
    "pg",
    "next",
    "react",
    "react-dom",
    "drizzle-orm",
    "drizzle-zod",
    "zod",
    "sharp",
    "heic-convert",
    "yt-dlp-wrap",
    "server-only",
    "playwright-core",
  ],
});
