"use client";

import { useCallback, useEffect, useState } from "react";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import TagInput from "@/components/shared/tag-input";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useUserSettingsContext } from "../context";

export default function AllergiesCard() {
  const t = useTranslations("settings.user.allergies");
  const { allergies, updateAllergies, isUpdatingAllergies } = useUserSettingsContext();
  const [localAllergies, setLocalAllergies] = useState<string[]>([]);

  // Sync local state when allergies load
  useEffect(() => {
    if (allergies) {
      setLocalAllergies(allergies);
    }
  }, [allergies]);
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
      <div className="flex justify-end">
        <Button
          isDisabled={!hasChanges}
          onPress={handleSave}
          variant="primary"
          isPending={isUpdatingAllergies}
        >
          {t("saveButton")}
        </Button>
      </div>
    </SettingsCard>
  );
}
