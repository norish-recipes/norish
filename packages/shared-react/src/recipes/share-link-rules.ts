import type { RecipeShareSummaryDto } from "@norish/shared/contracts/dto/recipe-shares";

export type ShareLinkAction = "copy" | "revoke" | "reactivate" | "delete";

/** What a share link may be turned into: Copy while it works and has a kept link, revoke or
 * reactivate by its status, delete always. */
export const shareLinkActions = ({
  status,
  hasLink,
}: Pick<RecipeShareSummaryDto, "status" | "hasLink">): ShareLinkAction[] => [
  ...(status === "active" && hasLink ? (["copy"] as const) : []),
  ...(status === "active"
    ? (["revoke", "delete"] as const)
    : status === "revoked"
      ? (["reactivate", "delete"] as const)
      : (["delete"] as const)),
];
