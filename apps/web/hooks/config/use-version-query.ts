"use client";

import { useQuery } from "@tanstack/react-query";

import { isUpdateAvailable } from "@norish/shared/lib/version";

const GITHUB_TAGS_URL = "https://api.github.com/repos/norish-recipes/norish/tags";

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(GITHUB_TAGS_URL, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) return null;

    const tags = (await response.json()) as Array<{ name: string }>;

    if (tags.length === 0) return null;

    // Tags are returned newest first, strip 'v' prefix
    return tags[0].name.replace(/^v/, "");
  } catch {
    return null;
  }
}

/**
 * Hook to fetch version information for update checking.
 * Current version from build-time env var, latest from GitHub.
 * Caches for 1 hour.
 */
export function useVersionQuery() {
  const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";

  const { data: latestVersion, isLoading } = useQuery({
    queryKey: ["version", "latest"],
    queryFn: fetchLatestVersion,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });

  const updateAvailable = isUpdateAvailable(currentVersion, latestVersion ?? null);

  return {
    currentVersion,
    latestVersion: latestVersion ?? null,
    updateAvailable,
    releaseUrl: latestVersion
      ? `https://github.com/norish-recipes/norish/releases/tag/v${latestVersion}`
      : null,
    isLoading,
  };
}
