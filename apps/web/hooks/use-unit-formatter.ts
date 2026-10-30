"use client";

import { useUnitsQuery } from "@/hooks/config/use-units-query";
import { useLocale } from "next-intl";

import { createUnitFormatter } from "@norish/shared-react/hooks";

export function useUnitFormatter() {
  const locale = useLocale();
  const { units } = useUnitsQuery();

  return createUnitFormatter({ locale, units });
}
