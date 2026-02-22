"use client";

import { useEffect, useState } from "react";
import { Button, Tooltip } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";

/**
 * Toggle button to switch between decimal and fraction display modes.
 * Shows "½" when in fraction mode, "0.5" when in decimal mode.
 */
export default function AmountDisplayToggle() {
  const { mode, toggleMode } = useAmountDisplayPreference();
  const t = useTranslations("recipes.detail");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Don't render anything until hydrated to avoid flash
  if (!isHydrated) {
    return (
      <Button isDisabled isIconOnly className="bg-content2" size="sm" variant="flat">
        <span className="text-xs font-medium">½</span>
      </Button>
    );
  }

  const isFraction = mode === "fraction";
  const label = isFraction ? t("switchToDecimal") : t("switchToFraction");

  return (
    <Tooltip content={label} placement="bottom">
      <Button
        isIconOnly
        aria-label={label}
        className="bg-content2"
        size="sm"
        variant="flat"
        onPress={toggleMode}
      >
        <span className="text-xs font-medium">{isFraction ? "½" : "0.5"}</span>
      </Button>
    </Tooltip>
  );
}
