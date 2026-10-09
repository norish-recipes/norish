"use client";

import { useEffect, useRef } from "react";
import { DevicePhoneMobileIcon } from "@heroicons/react/20/solid";
import { ToggleButton, Tooltip } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useWakeLockContext } from "./wake-lock-context";

type WakeLockToggleProps = {
  /**
   * Off where the surface already took the wake lock itself — cooking mode
   * does, so its toggle only ever hands it back rather than racing it for a
   * second one.
   */
  autoEnable?: boolean;
};

export default function WakeLockToggle({ autoEnable = true }: WakeLockToggleProps) {
  const { isSupported, isActive, toggle } = useWakeLockContext();
  const t = useTranslations("recipes.wakeLock");
  const hasAttemptedAutoEnableRef = useRef(false);

  useEffect(() => {
    if (!autoEnable || !isSupported || isActive || hasAttemptedAutoEnableRef.current) return;

    hasAttemptedAutoEnableRef.current = true;
    toggle();
  }, [autoEnable, isSupported, isActive, toggle]);

  const tooltip = !isSupported
    ? t("notSupported")
    : isActive
      ? t("activeTooltip")
      : t("inactiveTooltip");

  return (
    <Tooltip delay={0}>
      {/* Unsupported stays focusable rather than disabled, so its tooltip
          can still say why it does nothing. */}
      <ToggleButton
        isIconOnly
        aria-disabled={!isSupported || undefined}
        aria-label={t("ariaLabel")}
        className={`size-10 min-w-10 rounded-full ${isSupported ? "" : "opacity-50"}`}
        isSelected={isActive}
        onChange={() => {
          if (isSupported) void toggle();
        }}
      >
        <DevicePhoneMobileIcon className="size-5" />
      </ToggleButton>
      <Tooltip.Content placement="top">{tooltip}</Tooltip.Content>
    </Tooltip>
  );
}
