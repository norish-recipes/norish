"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import TagInput from "@/components/shared/tag-input";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import {
  changesAllergies,
  useAllergiesMutation,
  useAllergiesQuery,
} from "@norish/shared-react/reader";

export default function AllergiesCard() {
  const t = useTranslations("settings.user.allergies");
  const tActions = useTranslations("common.actions");
  const { allergies, answered } = useAllergiesQuery();
  const { setAllergies, isUpdatingAllergies } = useAllergiesMutation();
  const [localAllergies, setLocalAllergies] = useState<string[]>(allergies);
  const [syncedAllergies, setSyncedAllergies] = useState(allergies);

  if (allergies !== syncedAllergies) {
    setSyncedAllergies(allergies);
    setLocalAllergies(allergies);
  }
  const hasChanges = changesAllergies(localAllergies, allergies);

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
          isDisabled={!hasChanges || !answered}
          isPending={isUpdatingAllergies}
          onPress={() => setAllergies(localAllergies)}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>
    </SettingsCard>
  );
}
