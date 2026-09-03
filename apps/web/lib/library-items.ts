import type { CookbookSummaryDTO, RecipeDashboardDTO } from "@norish/shared/contracts";

/**
 * One row of the Library, discriminated by what kind of thing it is.
 *
 * The Library is one list rather than two bands (ADR-0026), so the grid has to
 * be told what it is drawing rather than assuming recipes. `pending` is the
 * import placeholder the dashboard already showed before cookbooks existed.
 */
export type LibraryGridItem =
  | { kind: "pending"; id: string }
  | { kind: "recipe"; id: string; recipe: RecipeDashboardDTO }
  | { kind: "cookbook"; id: string; cookbook: CookbookSummaryDTO };
