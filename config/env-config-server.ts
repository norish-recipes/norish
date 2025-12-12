// Import server-only to ensure this file is only used on the server
// Using dynamic import wrapped in IIFE for compatibility
(async () => {
  try {
    if (
      process.env.NEXT_RUNTIME ||
      process.env.__NEXT_PRIVATE_ORIGINAL_ENV ||
      process.env.NEXT_PHASE
    ) {
      await import("server-only");
    }
  } catch {
    // server-only import may fail during build or non-server contexts, this is expected
    // Silently ignore - this runs before logger is initialized
  }
})();

import fs from "fs";
import path from "path";

import { config } from "dotenv";
import { z } from "zod";

const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";

let envPath = path.resolve(process.cwd(), envFile);

if (!fs.existsSync(envPath)) {
  // If not found, try looking in parent directories
  const workspaceRoot = path.resolve(__dirname, "..");

  envPath = path.resolve(workspaceRoot, envFile);
}

if (fs.existsSync(envPath)) {
  config({ path: envPath, quiet: true });
}

const isBuild = process.env.SKIP_ENV_VALIDATION === "1";

const ServerConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]),

  // Local server binding
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().default(3000),
  // Public URL for auth callbacks etc.
  AUTH_URL: z.url().default("http://localhost:3000"),
  // Additional trusted origins (comma-separated URLs) for multi-domain access
  TRUSTED_ORIGINS: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    )
    .pipe(z.array(z.string())),
  UPLOADS_DIR: z.string().default(path.resolve("./uploads/")),

  DATABASE_URL: z.url(),

  ENABLE_REGISTRATION: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .pipe(z.boolean())
    .default(false),

  AI_ENABLED: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .pipe(z.boolean())
    .default(false),

  OIDC_NAME: z.string().default("Nora ID"),
  OIDC_ISSUER: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_WELLKNOWN: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // During build (SKIP_ENV_VALIDATION=1), use a placeholder key for Next.js compilation
  // At runtime, require a real 32+ char key - the placeholder is never persisted in the image
  MASTER_KEY: isBuild
    ? z.string().default("QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=")
    : z.string().min(32),

  // AI Provider Configuration
  AI_PROVIDER: z.enum(["openai", "ollama", "lm-studio", "generic-openai"]).default("openai"),
  AI_ENDPOINT: z.string().optional(),
  AI_MODEL: z.string().default("gpt-5-mini"),
  AI_API_KEY: z.string().optional(),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(1.0),
  AI_MAX_TOKENS: z.coerce.number().default(10000),

  // Video Processing Configuration
  VIDEO_PARSING_ENABLED: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .pipe(z.boolean())
    .default(false),
  VIDEO_MAX_LENGTH_SECONDS: z.coerce.number().default(120),
  YT_DLP_VERSION: z.string().default("2025.11.12"),
  YT_DLP_BIN_DIR: z
    .string()
    .default(process.env.NODE_ENV === "production" ? "/app/bin" : process.cwd()),

  // Transcription Configuration (separate from AI_PROVIDER)
  TRANSCRIPTION_PROVIDER: z
    .enum(["openai", "ollama", "lm-studio", "generic-openai", "disabled"])
    .default("disabled"),
  TRANSCRIPTION_ENDPOINT: z.string().optional(), // Required for local providers
  TRANSCRIPTION_API_KEY: z.string().optional(), // Can use AI_API_KEY if not set
  TRANSCRIPTION_MODEL: z.string().default("whisper-1"),

  UNITS_JSON: z.string().optional(),
  CONTENT_INDICATORS: z.string().optional(),
  CONTENT_INGREDIENTS: z.string().optional(),

  CHROME_WS_ENDPOINT: z
    .string()
    .min(1, "CHROME_WS_ENDPOINT is required for web scraping")
    .default("ws://chrome-headless:3000"),

  // Scheduler Configuration
  SCHEDULER_CLEANUP_MONTHS: z.coerce.number().default(3),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
let configInstance: ServerConfig | null = null;

export function initializeServerConfig(): ServerConfig {
  if (configInstance) return configInstance;
  configInstance = ServerConfigSchema.parse(process.env);

  return configInstance;
}

export const SERVER_CONFIG = initializeServerConfig();
