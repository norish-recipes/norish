import type { SiteAuthTokenDecryptedDto } from "@/types/dto/site-auth-tokens";

/**
 * Filters tokens whose domain matches the given URL's hostname via suffix match.
 *
 * Handles various input formats:
 * - Full URLs: "https://www.instagram.com/p/123"
 * - Bare domains: "instagram.com", "www.instagram.com"
 * - Bare words: "instagram" (matches any hostname with "instagram" as a segment)
 *
 * Token domain "instagram.com" matches hostnames "instagram.com", "www.instagram.com", etc.
 * Token domain "instagram" matches "instagram.com", "www.instagram.com", etc.
 */
export function getMatchingTokens(
  tokens: SiteAuthTokenDecryptedDto[],
  url: string
): SiteAuthTokenDecryptedDto[] {
  const hostname = extractHostname(url);

  if (!hostname) return [];

  return tokens.filter((token) => {
    const domain = token.domain.toLowerCase();

    // Exact match or suffix match (e.g. "instagram.com" matches "www.instagram.com")
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return true;

    // Bare word match: token domain has no dot (e.g. "instagram")
    // Match if hostname starts with the word followed by a dot (e.g. "instagram.com")
    // or contains it as a segment (e.g. "www.instagram.com")
    if (!domain.includes(".")) {
      return hostname.startsWith(`${domain}.`) || hostname.includes(`.${domain}.`);
    }

    return false;
  });
}

/**
 * Extracts a hostname from various input formats.
 * - "https://www.instagram.com/p/123" -> "www.instagram.com"
 * - "instagram.com" -> "instagram.com"
 * - "instagram" -> treated as-is for matching
 */
function extractHostname(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) return null;

  // Try parsing as a full URL first
  try {
    const parsed = new URL(trimmed);

    if (parsed.hostname) return parsed.hostname;
  } catch {
    // Not a valid URL — fall through
  }

  // Try adding a scheme to see if it parses as a domain
  try {
    const parsed = new URL(`https://${trimmed}`);

    if (parsed.hostname) return parsed.hostname;
  } catch {
    // Not a valid domain either
  }

  // Return the raw input as a last resort (e.g. bare word like "instagram")
  return trimmed || null;
}
