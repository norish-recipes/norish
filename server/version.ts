/**
 * Version utilities for checking installed vs latest available version.
 * Uses Redis for caching GitHub API responses.
 */

import { getPublisherClient } from "@/server/redis/client";
import { createLogger } from "@/server/logger";

const log = createLogger("version");

const GITHUB_TAGS_URL = "https://api.github.com/repos/norish-recipes/norish/tags";
const CACHE_KEY_LATEST = "norish:cache:latest_version";
const CACHE_KEY_CURRENT = "norish:cache:current_version";
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

export interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
}

/**
 * Get current installed version from package.json.
 * Cached in Redis to avoid repeated requires across workers.
 */
async function getCurrentVersion(): Promise<string> {
  const redis = await getPublisherClient();

  // Check cache first
  const cached = await redis.get(CACHE_KEY_CURRENT);

  if (cached) {
    return cached;
  }

  // Read from package.json

  const packageJson = require("../package.json") as { version: string };
  const version = packageJson.version;

  // Cache in Redis (long TTL - version only changes on deploy)
  await redis.setex(CACHE_KEY_CURRENT, CACHE_TTL_SECONDS, version);

  return version;
}

/**
 * Fetch latest version from GitHub tags with Redis caching.
 * Returns null if unable to fetch (network error, rate limit, etc.)
 */
async function fetchLatestVersion(): Promise<string | null> {
  const redis = await getPublisherClient();

  // Check cache first
  const cached = await redis.get(CACHE_KEY_LATEST);

  if (cached) {
    log.trace({ version: cached }, "Returning cached latest version");

    return cached;
  }

  // Fetch from GitHub
  try {
    log.debug("Fetching latest version from GitHub");

    const response = await fetch(GITHUB_TAGS_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "norish-version-check",
      },
    });

    if (!response.ok) {
      log.warn({ status: response.status }, "Failed to fetch GitHub tags");

      return null;
    }

    const tags = (await response.json()) as Array<{ name: string }>;

    if (tags.length === 0) {
      log.warn("No tags found in GitHub response");

      return null;
    }

    // Tags are returned newest first, strip 'v' prefix
    const latestVersion = tags[0].name.replace(/^v/, "");

    // Cache in Redis
    await redis.setex(CACHE_KEY_LATEST, CACHE_TTL_SECONDS, latestVersion);
    log.debug({ version: latestVersion }, "Cached latest version from GitHub");

    return latestVersion;
  } catch (err) {
    log.warn({ err }, "Error fetching latest version from GitHub");

    return null;
  }
}

/**
 * Compare versions to determine if update is available.
 * Handles semver format with optional suffix (e.g., 0.15.1-beta).
 */
function compareVersions(current: string, latest: string | null): boolean {
  if (!latest) return false;

  // Normalize: extract major.minor.patch as numbers
  const normalize = (v: string): [number, number, number] => {
    const base = v.replace(/-.*$/, ""); // Strip suffix like -beta
    const parts = base.split(".").map(Number);

    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };

  const [cMaj, cMin, cPatch] = normalize(current);
  const [lMaj, lMin, lPatch] = normalize(latest);

  // Compare major.minor.patch
  if (lMaj > cMaj) return true;
  if (lMaj < cMaj) return false;
  if (lMin > cMin) return true;
  if (lMin < cMin) return false;
  if (lPatch > cPatch) return true;

  return false;
}

/**
 * Get complete version info including current, latest, and update status.
 * Fetches both versions in parallel and compares them.
 */
export async function getVersionInfo(): Promise<VersionInfo> {
  const [current, latest] = await Promise.all([getCurrentVersion(), fetchLatestVersion()]);

  const updateAvailable = compareVersions(current, latest);

  return {
    current,
    latest,
    updateAvailable,
    releaseUrl: latest ? `https://github.com/norish-recipes/norish/releases/tag/v${latest}` : null,
  };
}
