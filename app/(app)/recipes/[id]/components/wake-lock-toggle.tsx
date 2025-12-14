"use client";

import { Switch, Tooltip } from "@heroui/react";
import { DevicePhoneMobileIcon } from "@heroicons/react/20/solid";

import { useWakeLockContext } from "./wake-lock-context";

export default function WakeLockToggle() {
  const { isSupported, isActive, toggle } = useWakeLockContext();

  if (!isSupported) {
    return (
      <Tooltip content="Keep screen awake is not supported in this browser">
        <div className="flex items-center gap-2 opacity-50">
          <DevicePhoneMobileIcon className="h-4 w-4" />
          <span className="text-sm">Keep Screen On</span>
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      content={
        isActive
          ? "Screen will stay awake while cooking"
          : "Keep screen awake while following steps"
      }
    >
      <div className="flex items-center gap-2">
        <DevicePhoneMobileIcon className="h-4 w-4" />
        <Switch
          aria-label="Keep screen awake"
          color="success"
          isSelected={isActive}
          size="sm"
          onValueChange={toggle}
        />
      </div>
    </Tooltip>
  );
}
