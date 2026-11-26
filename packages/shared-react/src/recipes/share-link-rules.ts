import type { RecipeShareSummaryDto } from "@norish/shared/contracts/dto/recipe-shares";

export type ShareLinkAction = "copy" | "revoke" | "reactivate" | "delete";

/** What a share link may be turned into: Copy while it works and Reactivate once revoked, both
 * only with a kept link; revoke while it works; delete always. */
export function shareLinkActions({
  status,
  hasLink,
}: Pick<RecipeShareSummaryDto, "status" | "hasLink">): ShareLinkAction[] {
  switch (status) {
    case "active":
      return hasLink ? ["copy", "revoke", "delete"] : ["revoke", "delete"];
    case "revoked":
      return hasLink ? ["reactivate", "delete"] : ["delete"];
    case "expired":
      return ["delete"];
  }
}
