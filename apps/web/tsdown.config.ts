import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["server/index.ts"],
  format: ["esm"],
  outDir: "../../dist-server",
  tsconfig: "./tsconfig.server.json",
  clean: true,
  treeshake: true,
  // Don't minify: i18n translation strings contain special chars that break the minifier
  minify: false,
  platform: "node",
  // Bundle workspace packages (@norish/*) — they export raw .ts files that
  // Node.js cannot load at runtime. All other npm packages remain external
  // and are resolved from node_modules at runtime.
  noExternal: [/^@norish\//],
  // Suppress warning for deps that are intentionally inlined from @norish/* packages.
  // Some lightweight transitive deps get pulled in — this is fine and expected.
  inlineOnly: false,
  external: [
    // --- Native / binary modules ---
    "pg",
    "pg-pool",
    "pg-types",
    "sharp",
    "heic-convert",
    "libheif-js",
    "yt-dlp-wrap",
    "ffmpeg-static",
    "playwright-core",
    "bullmq",
    "ioredis",
    // --- Frameworks ---
    "next",
    "next-intl",
    "react",
    "react-dom",
    "server-only",
    "hono",
    "@hono/node-server",
    // --- ORM / DB ---
    "drizzle-orm",
    "drizzle-zod",
    "kysely",
    // --- Auth ---
    "better-auth",
    "@better-auth/api-key",
    "@better-auth/core",
    "@better-auth/utils",
    "@better-auth/expo",
    "better-call",
    "jose",
    "cookie",
    // --- AI ---
    "openai",
    "ai",
    "@ai-sdk/openai",
    "@ai-sdk/anthropic",
    "@ai-sdk/azure",
    "@ai-sdk/deepseek",
    "@ai-sdk/google",
    "@ai-sdk/groq",
    "@ai-sdk/mistral",
    "@ai-sdk/openai-compatible",
    "@ai-sdk/perplexity",
    "@ai-sdk/provider",
    "@ai-sdk/provider-utils",
    "ollama-ai-provider-v2",
    // --- Logging ---
    "pino",
    "pino-pretty",
    // --- Utilities ---
    "zod",
    "date-fns",
    "superjson",
    "dotenv",
    "fuse.js",
    "cheerio",
    "tsdav",
    "ws",
    "mime",
    "nanostores",
    "ua-parser-js",
    "uuid",
    "jszip",
    "numeric-quantity",
    "parse-ingredient",
    "html-entities",
    "jsonrepair",
  ],
});
