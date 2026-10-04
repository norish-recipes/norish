"use client";

import { useEffect, useRef } from "react";
import { DevicePhoneMobileIcon } from "@heroicons/react/20/solid";
import { Button, Tooltip, toast } from "@heroui/react";
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

  if (!isSupported) {
    return (
      <Tooltip content={t("notSupported")}>
        <Button
          isIconOnly
          aria-label={t("notSupported")}
          className="size-10 min-w-10 rounded-full opacity-50"
          isDisabled
          variant="secondary"
        >
          <DevicePhoneMobileIcon className="size-5" />
        </Button>
      </Tooltip>
    );
  }

  const handleToggle = async () => {
    await toggle();
    // Use the *current* isActive to determine what the state was before toggle
    if (isActive) {
      toast(t("inactiveToast"));
    } else {
      toast(t("activeToast"));
    }
  };

  return (
    <Tooltip content={isActive ? t("activeTooltip") : t("inactiveTooltip")}>
      <Button
        isIconOnly
        aria-label={t("ariaLabel")}
        aria-pressed={isActive}
        className="size-10 min-w-10 rounded-full transition-colors"
        variant={isActive ? "primary" : "secondary"}
        onPress={handleToggle}
      >
        <DevicePhoneMobileIcon className="size-5" />
      </Button>
    </Tooltip>
  );
}
