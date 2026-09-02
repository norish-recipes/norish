/**
 * Which of a user's Site Auth Tokens an import sends.
 *
 * Two questions, in order: which tokens belong to this URL's site, and which of
 * that site's logins is this import using. The answer to the second is what the
 * job records, so a rate-limited or expired login can be named.
 */

import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";

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

/**
 * One site login's worth of tokens, as an import will send them.
 *
 * `account` is the label the tokens were saved under, or null when nothing on
 * the domain is labelled and the domain's tokens travel as one unnamed set.
 */
export interface CredentialSet {
  account: string | null;
  tokens: SiteAuthTokenDecryptedDto[];
}

/**
 * The credential sets that apply to `url`, in a stable order.
 *
 * Only the account label separates one set from another; the domain decides
 * whether a token applies to this URL at all. A token saved without a label is
 * not tied to one login, so it joins every set — a CSRF cookie or an
 * Authorization header shared by all of a site's accounts is saved once.
 *
 * With nothing labelled there is exactly one set, which is every token the
 * domain matched: the shape a server that has never named an account keeps.
 */
export function credentialSetsForUrl(
  tokens: SiteAuthTokenDecryptedDto[],
  url: string
): CredentialSet[] {
  const matching = getMatchingTokens(tokens, url);
  const shared = matching.filter((token) => !token.account);
  const byAccount = new Map<string, SiteAuthTokenDecryptedDto[]>();

  for (const token of matching) {
    if (!token.account) continue;

    const existing = byAccount.get(token.account);

    if (existing) existing.push(token);
    else byAccount.set(token.account, [token]);
  }

  if (byAccount.size === 0) {
    return shared.length > 0 ? [{ account: null, tokens: shared }] : [];
  }

  return [...byAccount.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([account, owned]) => ({ account, tokens: [...shared, ...owned] }));
}

/**
 * Pick the set this import will use.
 *
 * The choice is random rather than round-robin: a worker handles one job and
 * keeps no state between them, and spreading imports over the accounts is the
 * whole point — no counter has to survive a restart for that to hold.
 */
export function rotateCredentialSet(sets: CredentialSet[]): CredentialSet | null {
  if (sets.length === 0) return null;
  if (sets.length === 1) return sets[0] ?? null;

  return sets[Math.floor(Math.random() * sets.length)] ?? null;
}
