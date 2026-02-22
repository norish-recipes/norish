import type { VideoPlatform } from "./types";

import { z } from "zod";

const urlSchema = z.url();

/**
 * Check if URL is from Instagram.
 */
export function isInstagramUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    return hostname.includes("instagram.com");
  } catch {
    return false;
  }
}

/**
 * Check if URL is from Facebook.
 */
export function isFacebookUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    return hostname.includes("facebook.com") || hostname.includes("fb.watch");
  } catch {
    return false;
  }
}

/**
 * Check if URL is from YouTube.
 */
export function isYouTubeUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    return hostname.includes("youtube.com") || hostname.includes("youtu.be");
  } catch {
    return false;
  }
}

/**
 * Detect the video platform from a URL.
 * @throws ZodError if the URL is invalid
 */
export function detectPlatform(url: string): VideoPlatform {
  urlSchema.parse(url);

  if (isInstagramUrl(url)) return "instagram";
  if (isFacebookUrl(url)) return "facebook";
  if (isYouTubeUrl(url)) return "youtube";

  return "generic";
}
