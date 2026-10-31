import type { UnitsMap } from "@norish/config/zod/server-config";
import type { UnitStyle } from "@norish/shared/contracts/zod/device-preferences";
import { formatUnit } from "@norish/shared/lib/unit-localization";

export type UnitFormatterAdapters = {
  locale: string;
  units: UnitsMap;
  unitStyle?: UnitStyle;
};

export function createUnitFormatter({ locale, units, unitStyle }: UnitFormatterAdapters) {
  const formatUnitOnly = (
    unit: string | null | undefined,
    amount?: number | null | undefined
  ): string => {
    if (!unit) return "";

    return formatUnit(unit, locale, units, amount, unitStyle);
  };

  const formatAmountUnit = (
    amount: number | null | undefined,
    unit: string | null | undefined
  ): string => {
    if (!unit) {
      if (!amount && amount !== 0) return "";
      const formattedAmount = amount % 1 === 0 ? amount.toString() : amount.toFixed(1);

      return `${formattedAmount}\u00D7`;
    }

    const localizedUnit = formatUnit(unit, locale, units, amount, unitStyle);

    if (!amount && amount !== 0) {
      return localizedUnit;
    }

    const formattedAmount = amount % 1 === 0 ? amount.toString() : amount.toFixed(1);
    const needsSpace = localizedUnit.length > 2;

    return needsSpace
      ? `${formattedAmount} ${localizedUnit}`
      : `${formattedAmount}${localizedUnit}`;
  };

  return {
    formatAmountUnit,
    formatUnitOnly,
    locale,
    units,
  };
}
