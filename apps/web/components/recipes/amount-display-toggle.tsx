"use client";

import { useEffect, useState } from "react";
import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import { Button, Tooltip } from "@heroui/react";
import { useTranslations } from "next-intl";

type AmountDisplayToggleProps = {
  compact?: boolean;
};

/**
 * Toggle button to switch between decimal and fraction display modes.
 * Shows "½" when in fraction mode, "0.5" when in decimal mode.
 */
export default function AmountDisplayToggle({ compact = false }: AmountDisplayToggleProps) {
  const { mode, toggleMode } = useAmountDisplayPreference();
  const t = useTranslations("recipes.detail");
  const [isHydrated, setIsHydrated] = useState(false);
  const buttonClassName = compact
    ? "bg-surface-secondary size-8 min-w-8 px-0"
    : "bg-surface-secondary";

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Don't render anything until hydrated to avoid flash
  if (!isHydrated) {
    return (
      <Button isDisabled isIconOnly className={buttonClassName} size="sm" variant="tertiary">
        <span className="text-xs font-medium">½</span>
      </Button>
    );
  }
  const isFraction = mode === "fraction";
  const label = isFraction ? t("switchToDecimal") : t("switchToFraction");
  return (
    <Tooltip delay={0}>
      <Button
        isIconOnly
        aria-label={label}
        className={buttonClassName}
        size="sm"
        onPress={toggleMode}
        variant="tertiary"
      >
        <span className="text-xs font-medium">{isFraction ? "½" : "0.5"}</span>
      </Button>
      <Tooltip.Content placement="bottom">{label}</Tooltip.Content>
    </Tooltip>
  );
}
