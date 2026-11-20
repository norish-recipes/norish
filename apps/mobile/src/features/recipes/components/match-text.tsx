import React from "react";
import { Segments } from "@/components/highlighted-text";
import { useIntl } from "react-intl";

import type { LibraryMatchDTO } from "@norish/shared/contracts";
import { useAmountDisplayPreference, useUnitFormatter } from "@norish/shared-react/recipes";
import { formatAmount } from "@norish/shared/lib/format-amount";

import { matchLine } from "../utils/match-line";

/** Why a recipe matched, in place of its description; goes inside a `Text`. */
export function MatchText({ match, search }: { match: LibraryMatchDTO; search: string }) {
  const intl = useIntl();
  const { mode } = useAmountDisplayPreference();
  const { formatUnitOnly } = useUnitFormatter(intl.locale);
  // The amount and unit read as on the recipe page.
  const prefix =
    match.field === "ingredients"
      ? [formatAmount(match.amount, mode), formatUnitOnly(match.unit, match.amount)]
          .filter(Boolean)
          .join(" ")
      : "";
  const line = matchLine(match, search, prefix);
  const label = line.labelId ? intl.formatMessage({ id: line.labelId }, line.labelValues) : null;

  return (
    <>
      {label}
      {label && line.segments.length > 0 ? " " : null}
      <Segments segments={line.segments} />
    </>
  );
}
