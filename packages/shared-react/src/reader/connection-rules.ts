import type { RecipeShareSummaryDto } from "@norish/shared/contracts/dto/recipe-shares";
import { TokenDomainSchema } from "@norish/shared/contracts/zod/site-auth-tokens";

/** What a share link may be turned into: revoke or reactivate by its status, delete always. */
export const shareLinkActions = (
  status: RecipeShareSummaryDto["status"]
): ("revoke" | "reactivate" | "delete")[] =>
  status === "active"
    ? ["revoke", "delete"]
    : status === "revoked"
      ? ["reactivate", "delete"]
      : ["delete"];

/** An API key as listed: the first characters it kept, which are all anyone can see of it. */
export const apiKeyPrefix = (start: string | null | undefined) => `${start || "***"}...`;

/** The longest name a key may have: Better Auth's `maximumNameLength`, which refuses a longer one. */
export const API_KEY_NAME_MAX_LENGTH = 32;

/** Site tokens in order of domain, account, then name, so a site's accounts read as the sets they are. */
export const orderedSiteTokens = <
  T extends { domain: string; account?: string | null; name: string },
>(
  tokens: T[]
): T[] =>
  [...tokens].sort(
    (a, b) =>
      a.domain.localeCompare(b.domain) ||
      (a.account ?? "").localeCompare(b.account ?? "") ||
      a.name.localeCompare(b.name)
  );

/** A new token's form: a bare domain is flagged (it must be a full domain), and Add needs all three fields. */
export function siteTokenForm({
  domain,
  name,
  value,
}: {
  domain: string;
  name: string;
  value: string;
}) {
  const domainBare = domain.trim() !== "" && !TokenDomainSchema.safeParse(domain).success;

  return {
    domainBare,
    valid: domain.trim() !== "" && !domainBare && name.trim() !== "" && value.trim() !== "",
  };
}
