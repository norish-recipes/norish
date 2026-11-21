import { useIntl } from "react-intl";

import type { PackSizeWords } from "@norish/shared/lib/format-price";

/** The translated words a Pack Size needs that the unit table does not carry. */
export function usePackSizeWords(): PackSizeWords {
  const intl = useIntl();

  return {
    per: (unit) => intl.formatMessage({ id: "groceries.price.perUnit" }, { unit }),
    pieces: (count) => intl.formatMessage({ id: "groceries.price.pieces" }, { count }),
  };
}
