import type { RecipeShareSummaryDto } from "@norish/shared/contracts/dto/recipe-shares";

export type ShareLinkAction = "copy" | "revoke" | "reactivate" | "delete";

/** What a share link may be turned into: Copy while it works and has a kept link, revoke or
 * reactivate by its status, delete always. */
export function shareLinkActions({
  status,
  hasLink,
}: Pick<RecipeShareSummaryDto, "status" | "hasLink">): ShareLinkAction[] {
  switch (status) {
    case "active":
      return hasLink ? ["copy", "revoke", "delete"] : ["revoke", "delete"];
    case "revoked":
      return ["reactivate", "delete"];
    case "expired":
      return ["delete"];
  }
}
