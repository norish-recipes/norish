"use client";

import type { PackSizeWords } from "@/lib/format-price";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

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
