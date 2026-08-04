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
