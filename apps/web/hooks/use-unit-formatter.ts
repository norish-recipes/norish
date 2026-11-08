"use client";

import { useLocale } from "next-intl";

import { useUnitsQuery } from "@norish/shared-react/config";
import { createUnitFormatter } from "@norish/shared-react/hooks";
import { useDevicePreference } from "@norish/shared-react/reader";

export function useUnitFormatter() {
  const locale = useLocale();
  const { units } = useUnitsQuery();
  const [unitStyle] = useDevicePreference("unitStyle");

  return createUnitFormatter({ locale, units, unitStyle });
}
