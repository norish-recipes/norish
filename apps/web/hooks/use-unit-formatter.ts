"use client";

import { useLocale } from "next-intl";

import { useUnitsQuery } from "@norish/shared-react/config";
import { useDevicePreference } from "@norish/shared-react/reader";
import { createUnitFormatter } from "@norish/shared/lib/unit-localization";

export function useUnitFormatter() {
  const locale = useLocale();
  const { units } = useUnitsQuery();
  const [unitStyle] = useDevicePreference("unitStyle");

  return createUnitFormatter({ locale, units, unitStyle });
}
