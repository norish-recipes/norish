"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { PackSizeWords } from "@norish/shared/lib/format-price";

/** The translated words a Pack Size needs that the unit table does not carry. */
export function usePackSizeWords(): PackSizeWords {
  const t = useTranslations("groceries.price");

  return useMemo(
    () => ({
      per: (unit: string) => t("perUnit", { unit }),
      pieces: (count: number) => t("pieces", { count }),
    }),
    [t]
  );
}
