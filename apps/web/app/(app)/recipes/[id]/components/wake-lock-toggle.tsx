"use client";

import { useEffect, useRef } from "react";
import UiSwitch from "@/components/shared/ui-switch";
import { DevicePhoneMobileIcon } from "@heroicons/react/20/solid";
import { Tooltip, toast } from "@heroui/react";
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
        <div className="flex items-center gap-2 opacity-50">
          <DevicePhoneMobileIcon className="h-5 w-5" />
          <span className="text-sm">{t("keepScreenOn")}</span>
        </div>
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
      <div className="flex items-center gap-2">
        <DevicePhoneMobileIcon className="h-5 w-5" />
        <UiSwitch
          aria-label={t("ariaLabel")}
          color="success"
          isSelected={isActive}
          size="sm"
          onValueChange={handleToggle}
        />
      </div>
    </Tooltip>
  );
}
