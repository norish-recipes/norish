"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody, CardHeader, Button } from "@heroui/react";
import { ExclamationTriangleIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import { useUserSettingsContext } from "../context";

import TagInput from "@/components/shared/tag-input";

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
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ExclamationTriangleIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </CardHeader>
      <CardBody className="gap-4">
        <p className="text-default-500 text-base">{t("description")}</p>
        <TagInput
          placeholder={t("placeholder")}
          value={localAllergies}
          onChange={setLocalAllergies}
        />
        <div className="flex justify-end">
          <Button
            color="primary"
            isDisabled={!hasChanges}
            isLoading={isUpdatingAllergies}
            startContent={<CheckIcon className="h-4 w-4" />}
            onPress={handleSave}
          >
            {t("saveButton")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
