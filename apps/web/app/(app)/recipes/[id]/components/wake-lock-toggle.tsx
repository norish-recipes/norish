"use client";

import { Switch, Tooltip } from "@heroui/react";
import { DevicePhoneMobileIcon } from "@heroicons/react/20/solid";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { useWakeLockContext } from "./wake-lock-context";

export default function WakeLockToggle() {
  const { isSupported, isActive, toggle } = useWakeLockContext();
  const t = useTranslations("recipes.wakeLock");
  const hasAttemptedAutoEnableRef = useRef(false);

  useEffect(() => {
    if (!isSupported || isActive || hasAttemptedAutoEnableRef.current) return;

    hasAttemptedAutoEnableRef.current = true;
    toggle();
  }, [isSupported, isActive, toggle]);

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

  return (
    <Tooltip content={isActive ? t("activeTooltip") : t("inactiveTooltip")}>
      <div className="flex items-center gap-2">
        <DevicePhoneMobileIcon className="h-5 w-5" />
        <Switch
          aria-label={t("ariaLabel")}
          color="success"
          isSelected={isActive}
          size="sm"
          onValueChange={toggle}
        />
      </div>
    </Tooltip>
  );
}
