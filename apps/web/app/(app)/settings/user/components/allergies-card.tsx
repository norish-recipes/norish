"use client";

import { useCallback, useEffect, useState } from "react";
import TagInput from "@/components/shared/tag-input";
import { CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button, Card } from "@heroui/react";
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
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ExclamationTriangleIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-4">
        <p className="text-muted text-base">{t("description")}</p>
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
            {<CheckIcon className="h-4 w-4" />}
            {t("saveButton")}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
