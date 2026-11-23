import type { RecipeShareSummaryDto } from "@norish/shared/contracts/dto/recipe-shares";

export type ShareLinkAction = "revoke" | "reactivate" | "delete";

/** What a share link may be turned into: revoke or reactivate by its status, delete always. */
export const shareLinkActions = (status: RecipeShareSummaryDto["status"]): ShareLinkAction[] =>
  status === "active"
    ? ["revoke", "delete"]
    : status === "revoked"
      ? ["reactivate", "delete"]
      : ["delete"];
