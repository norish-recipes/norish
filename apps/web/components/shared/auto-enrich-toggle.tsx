"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import { useUserSettingsQuery } from "@/hooks/user/use-user-query";
import { useTranslations } from "next-intl";

import { getAutoEnrichOnAddPreference } from "@norish/shared/lib/user-preferences";

export function useAutoEnrichOnAdd(
  isOpen = true
): [boolean | undefined, (enabled: boolean) => void] {
  const { user, isLoading } = useUserSettingsQuery();
  const profileDefault =
    isLoading || user === null ? undefined : getAutoEnrichOnAddPreference(user);
  const [override, setOverride] = useState<boolean | undefined>(undefined);
  const wasOpen = useRef(isOpen);

  useEffect(() => {
    if (isOpen && !wasOpen.current) setOverride(undefined);
    wasOpen.current = isOpen;
  }, [isOpen]);

  const setAutoEnrich = useCallback((enabled: boolean) => setOverride(enabled), []);

  return [override ?? profileDefault, setAutoEnrich];
}

export default function AutoEnrichToggle({
  isSelected,
  onValueChange,
  isDisabled,
}: {
  isSelected: boolean | undefined;
  onValueChange: (isSelected: boolean) => void;
  isDisabled?: boolean;
}) {
  const t = useTranslations("common.autoEnrich");
  const labelId = useId();
  const isResolved = isSelected !== undefined;

  return (
    <div className="border-border flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-foreground text-sm font-medium" id={labelId}>
          {t("title")}
        </span>
        <span className="text-muted text-xs">{t("description")}</span>
      </div>
      <SettingsSwitch
        aria-busy={!isResolved}
        aria-labelledby={labelId}
        color="success"
        isDisabled={isDisabled || !isResolved}
        isSelected={isSelected ?? false}
        onValueChange={onValueChange}
      />
    </div>
  );
}
