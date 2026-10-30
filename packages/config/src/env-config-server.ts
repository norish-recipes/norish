import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

import {
  DEFAULT_AI_TIMEOUT_MS,
  DEFAULT_YT_DLP_VERSION,
  TranscriptionProviderSchema,
} from "./zod/server-config";

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

const envFiles =
  process.env.NODE_ENV === "production" ? [".env.production", ".env.local"] : [".env.local"];

function findEnvPath(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    for (const envFile of envFiles) {
      const candidate = path.resolve(currentDir, envFile);

      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

const envPath = findEnvPath(process.cwd());

const defaultRuntimeRoot = path.resolve("./.runtime");
const defaultUploadsDir =
  process.env.NODE_ENV === "production" ? "/app/uploads" : path.join(defaultRuntimeRoot, "uploads");
const defaultYtDlpBinDir =
  process.env.NODE_ENV === "production" ? "/app/bin" : path.join(defaultRuntimeRoot, "bin");

if (envPath) {
  config({ path: envPath, quiet: true });
}

// ---------------------------------------------------------------------------
// Component-based DATABASE_URL fallback: if DATABASE_URL is not provided,
// assemble it from optional DATABASE_PORT, DATABASE, DATABASE_USER,
// DATABASE_PASSWORD values and sane defaults.
// ---------------------------------------------------------------------------
if (!process.env.DATABASE_URL) {
  const host = process.env.DATABASE_HOST ?? "localhost";
  const port = process.env.DATABASE_PORT ?? "5432";
  const db = process.env.DATABASE ?? "norish";
  const user = process.env.DATABASE_USER ?? "postgres";
  const password = process.env.DATABASE_PASSWORD ?? "norish";
  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;

  process.env.DATABASE_URL = `postgresql://${credentials}@${host}:${port}/${db}`;
}

// An install from before Valkey still names its server REDIS_URL.
if (!process.env.VALKEY_URL && process.env.REDIS_URL) {
  process.env.VALKEY_URL = process.env.REDIS_URL;
}

const isBuild =
  process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.VITEST === "true" ||
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-export";

/** A switch set as "true" or "1"; anything else is off. */
const envFlag = z
  .string()
  .transform((val) => val === "true" || val === "1")
  .pipe(z.boolean());

const commaSeparatedList = z
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
  .pipe(z.array(z.string()));

const ServerConfigFields = z.object({
  NODE_ENV: z.enum(["development", "production"]),

  // Local server binding
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().default(3000),
  // Public URL for auth callbacks etc.
  AUTH_URL: z.url().default("http://localhost:3000"),
  // The URL prefix the web app was built for; AUTH_URL must carry the same path.
  NEXT_PUBLIC_BASE_PATH: z.string().default(""),
  // Additional trusted origins (comma-separated URLs) for multi-domain access
  TRUSTED_ORIGINS: commaSeparatedList,
  // Reverse proxies (IPs or CIDR ranges, comma-separated) whose hops are
  // skipped in X-Forwarded-For, so the client behind several proxies is found
  TRUSTED_PROXIES: commaSeparatedList,
  UPLOADS_DIR: z.string().default(defaultUploadsDir),

  // Auth endpoint rate limiting. Defaults are the production values; they are
  // overridable so a harness driving many sessions against one server (the
  // browser E2E stack reuses a single server across a whole project) is not
  // throttled into failures that say nothing about the code under test.
  AUTH_RATE_LIMIT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  AUTH_RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(60),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // During build, allow placeholder DB URL so server-only modules can be imported
  // without requiring runtime secrets. Runtime still enforces a real URL.
  DATABASE_URL: isBuild
    ? z.url().default("postgresql://build:build@localhost:5432/build")
    : z.url(),

  ENABLE_REGISTRATION: envFlag.default(false),

  AI_ENABLED: envFlag.default(false),

  // Unset: on when no OAuth provider is configured in the environment.
  PASSWORD_AUTH_ENABLED: envFlag.optional(),

  OIDC_NAME: z.string().default("Nora ID"),
  OIDC_ISSUER: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_WELLKNOWN: z.string().optional(),
  // OIDC Claim Mapping
  OIDC_CLAIM_MAPPING_ENABLED: envFlag.default(false),
  OIDC_SCOPES: commaSeparatedList,
  OIDC_GROUPS_CLAIM: z.string().default("groups"),
  OIDC_ADMIN_GROUP: z.string().default("norish_admin"),
  OIDC_HOUSEHOLD_GROUP_PREFIX: z.string().default("norish_household_"),
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
  AI_MODEL: z.string().default("gpt-6-luna"),
  AI_API_KEY: z.string().optional(),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(1.0),
  AI_MAX_TOKENS: z.coerce.number().default(10000),
  AI_TIMEOUT_MS: z.coerce.number().default(DEFAULT_AI_TIMEOUT_MS),

  // Video Processing Configuration
  VIDEO_PARSING_ENABLED: envFlag.default(false),
  VIDEO_MAX_LENGTH_SECONDS: z.coerce.number().default(120),
  YT_DLP_PROXY: z.string().optional(),
  YT_DLP_VERSION: z.string().default(DEFAULT_YT_DLP_VERSION),
  YT_DLP_BIN_DIR: z.string().default(defaultYtDlpBinDir),

  // Ingredient catalogue seed (ADR-0038): the Open Food Facts ingredients
  // taxonomy, fetched nightly. Point it at a mirror on a server without
  // internet; empty turns the fetch off, and Norish works with no seed.
  INGREDIENT_CATALOGUE_URL: z
    .union([z.url(), z.literal("")])
    .default(
      "https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/food/ingredients.txt"
    ),

  // How many ingredients a round of Ask AI asks about at once. Higher is
  // faster on a hosted model; lower spares a self-hosted one.
  INGREDIENT_REVIEW_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(10),

  // Transcription Configuration (separate from AI_PROVIDER)
  TRANSCRIPTION_PROVIDER: TranscriptionProviderSchema.default("disabled"),
  TRANSCRIPTION_ENDPOINT: z.string().optional(), // Required for local providers
  TRANSCRIPTION_API_KEY: z.string().optional(), // Can use AI_API_KEY if not set
  TRANSCRIPTION_MODEL: z.string().default("whisper-1"),

  UNITS_JSON: z.string().optional(),
  CONTENT_INDICATORS: z.string().optional(),
  CONTENT_INGREDIENTS: z.string().optional(),

  // These seed the Page Renderers setting at first boot; admin settings own it after that.
  // An empty Obscura endpoint seeds Obscura switched off.
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- the shipped obscura service answers on the private compose network, without TLS
  OBSCURA_ENDPOINT: z.string().default("ws://obscura:9222"),
  // Sent as a bearer token. Obscura refuses to listen beyond loopback without
  // one, so the shipped `obscura` service sets the same value.
  OBSCURA_CDP_TOKEN: z.string().optional(),
  // Any Chromium's CDP endpoint, tried after Obscura. Set, it seeds the Chromium browser switched on.
  CHROMIUM_BROWSER_ENDPOINT: z.string().optional(),
  // A FlareSolverr-compatible solver's /v1 endpoint, tried after Obscura.
  PAGE_SOLVER_ENABLED: envFlag.default(false),
  PAGE_SOLVER_ENDPOINT: z.string().optional(),
  ALLOW_PRIVATE_ADDRESSES: envFlag.default(false),
  // How long a Page Renderer is given to load a page.
  PAGE_RENDERER_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),

  PARSER_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // Scheduler Configuration
  SCHEDULER_CLEANUP_MONTHS: z.coerce.number().default(3),

  // File Size Limits (in bytes)
  MAX_AVATAR_FILE_SIZE: z.coerce.number().default(5 * 1024 * 1024), // 5MB
  MAX_IMAGE_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024), // 10MB
  MAX_VIDEO_FILE_SIZE: z.coerce.number().default(100 * 1024 * 1024), // 100MB

  // valkey:// or redis:// (valkeys:// or rediss:// for TLS). Required at runtime, like DATABASE_URL
  VALKEY_URL: isBuild ? z.url().default("valkey://localhost:6379") : z.url(),

  // Internationalization
  // If invalid locale is specified, falls back to 'en'
  DEFAULT_LOCALE: z.string().default("en"),
  // If not set, all available locales are enabled
  // Can be overridden by admin UI settings stored in database
  ENABLED_LOCALES: commaSeparatedList,
});

// A build has no AUTH_URL of its own, only the default, so the check waits for the server.
const ServerConfigSchema = ServerConfigFields.refine(
  ({ AUTH_URL, NEXT_PUBLIC_BASE_PATH }) =>
    process.env.NEXT_PHASE === "phase-production-build" ||
    new URL(AUTH_URL).pathname.replace(/\/$/, "") === NEXT_PUBLIC_BASE_PATH,
  {
    path: ["AUTH_URL"],
    message: "AUTH_URL's path must equal NEXT_PUBLIC_BASE_PATH, the prefix the app was built for",
  }
);

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export const INTERNAL_PARSER_API_HOST = "127.0.0.1";
// The browser E2E boots several servers side by side and gives each parser its
// own port; the parser's dev script reads the same variable.
export const INTERNAL_PARSER_API_PORT = Number(process.env.PARSER_API_PORT) || 8001;
export const INTERNAL_PARSER_API_URL = `http://${INTERNAL_PARSER_API_HOST}:${INTERNAL_PARSER_API_PORT}`;

export function buildInternalParserApiUrl(pathname: string): string {
  return new URL(pathname, INTERNAL_PARSER_API_URL).toString();
}

let configInstance: ServerConfig | null = null;

export function initializeServerConfig(): ServerConfig {
  if (configInstance) return configInstance;
  configInstance = ServerConfigSchema.parse(process.env);

  return configInstance;
}

export const SERVER_CONFIG = initializeServerConfig();
