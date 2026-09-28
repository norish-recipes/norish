"use client";

import { useState } from "react";
import { SettingRow } from "@/app/(app)/settings/components/setting-row";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PermissionLevel } from "@norish/config/zod/server-config";

import type { PermissionLevelLabels } from "./permission-level-select";
import { useAdminSettingsContext } from "../context";
import { PermissionLevelSelect } from "./permission-level-select";

/**
 * Who may edit an Ingredient someone else minted. One level: Ingredients are
 * always visible, and adding an alias is open to everyone.
 */
export default function IngredientPermissionCard() {
  const t = useTranslations("settings.admin.ingredientPermissions");
  const { ingredientPermissionPolicy, updateIngredientPermissionPolicy } =
    useAdminSettingsContext();
  const [saving, setSaving] = useState(false);

  const labels: PermissionLevelLabels = {
    everyone: { label: t("levels.everyone"), description: t("levels.everyoneDescription") },
    household: { label: t("levels.household"), description: t("levels.householdDescription") },
    owner: { label: t("levels.owner"), description: t("levels.ownerDescription") },
  };

  const handleChange = async (edit: PermissionLevel) => {
    setSaving(true);
    try {
      await updateIngredientPermissionPolicy({ edit });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheckIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-6">
        <p className="text-muted text-base">{t("description")}</p>

        <SettingRow description={t("editDescription")} title={t("editIngredients")}>
          <PermissionLevelSelect
            ariaLabel={t("editIngredients")}
            isDisabled={saving}
            labels={labels}
            value={ingredientPermissionPolicy?.edit ?? null}
            onChange={(level) => void handleChange(level)}
          />
        </SettingRow>

        <div className="bg-surface-secondary text-muted mt-2 rounded-lg p-3 text-base">
          {t("note")}
        </div>
      </Card.Content>
    </Card>
  );
}
