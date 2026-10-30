"use client";

import { useCallback, useState } from "react";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import TagInput from "@/components/shared/tag-input";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import { useUserSettingsContext } from "../context";

export default function AllergiesCard() {
  const t = useTranslations("settings.user.allergies");
  const tActions = useTranslations("common.actions");
  const { allergies, updateAllergies, isUpdatingAllergies } = useUserSettingsContext();
  const [localAllergies, setLocalAllergies] = useState<string[]>(allergies);
  const [syncedAllergies, setSyncedAllergies] = useState(allergies);

  // Sync local state when allergies load
  if (allergies !== syncedAllergies) {
    setSyncedAllergies(allergies);
    if (allergies) {
      setLocalAllergies(allergies);
    }
  }
  const hasChanges =
    JSON.stringify(localAllergies.slice().sort()) !==
    JSON.stringify((allergies || []).slice().sort());
  const handleSave = useCallback(async () => {
    await updateAllergies(localAllergies);
  }, [localAllergies, updateAllergies]);
  return (
    <SettingsCard description={t("description")} icon={ExclamationTriangleIcon} title={t("title")}>
      <TagInput
        placeholder={t("placeholder")}
        value={localAllergies}
        onChange={setLocalAllergies}
      />
      <ActionButtonGroup>
        <ActionButton
          action="save"
          isDisabled={!hasChanges}
          isPending={isUpdatingAllergies}
          onPress={handleSave}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>
    </SettingsCard>
  );
}
