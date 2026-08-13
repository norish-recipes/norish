"use client";

import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import { Button, Tooltip } from "@heroui/react";
import { useTranslations } from "next-intl";

type AmountDisplayToggleProps = {
  compact?: boolean;
};

/**
 * Toggle button to switch between decimal and fraction display modes.
 * Shows "½" when in fraction mode, "0.5" when in decimal mode. The stored
 * mode rides a cookie into the first render, so there is no hydration
 * stand-in — the toggle reflects the reader's choice from the first paint.
 */
export default function AmountDisplayToggle({ compact = false }: AmountDisplayToggleProps) {
  const { mode, toggleMode } = useAmountDisplayPreference();
  const t = useTranslations("recipes.detail");
  const buttonClassName = compact
    ? "bg-surface-secondary size-8 min-w-8 px-0"
    : "bg-surface-secondary";

  const isFraction = mode === "fraction";
  const label = isFraction ? t("switchToDecimal") : t("switchToFraction");

  return (
    <Tooltip delay={0}>
      <Button
        isIconOnly
        aria-label={label}
        className={buttonClassName}
        size="sm"
        variant="tertiary"
        onPress={toggleMode}
      >
        <span className="text-xs font-medium">{isFraction ? "½" : "0.5"}</span>
      </Button>
      <Tooltip.Content placement="bottom">{label}</Tooltip.Content>
    </Tooltip>
  );
}
