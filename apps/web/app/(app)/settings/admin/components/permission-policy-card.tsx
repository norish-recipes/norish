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

type PolicyAction = "view" | "edit" | "delete";

export default function PermissionPolicyCard() {
  const t = useTranslations("settings.admin.permissions");
  const { recipePermissionPolicy, updateRecipePermissionPolicy } = useAdminSettingsContext();
  const [saving, setSaving] = useState<PolicyAction | null>(null);

  const labels: PermissionLevelLabels = {
    everyone: { label: t("levels.everyone"), description: t("levels.everyoneDescription") },
    household: { label: t("levels.household"), description: t("levels.householdDescription") },
    owner: { label: t("levels.owner"), description: t("levels.ownerDescription") },
  };

  const handleChange = async (action: PolicyAction, value: PermissionLevel) => {
    if (!recipePermissionPolicy) return;

    setSaving(action);
    try {
      await updateRecipePermissionPolicy({
        ...recipePermissionPolicy,
        [action]: value,
      });
    } finally {
      setSaving(null);
    }
  };

  const renderPolicySelect = (action: PolicyAction, ariaLabel: string) => (
    <PermissionLevelSelect
      ariaLabel={ariaLabel}
      isDisabled={saving !== null}
      labels={labels}
      value={recipePermissionPolicy?.[action] ?? null}
      onChange={(level) => void handleChange(action, level)}
    />
  );

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

        <div className="flex flex-col gap-4">
          <SettingRow description={t("viewDescription")} title={t("viewRecipes")}>
            {renderPolicySelect("view", t("viewRecipes"))}
          </SettingRow>

          <SettingRow description={t("editDescription")} title={t("editRecipes")}>
            {renderPolicySelect("edit", t("editRecipes"))}
          </SettingRow>

          <SettingRow description={t("deleteDescription")} title={t("deleteRecipes")}>
            {renderPolicySelect("delete", t("deleteRecipes"))}
          </SettingRow>
        </div>

        {/* The note names itself; a hard-coded "Note:" in front of it read as
            "Note: Note:" and was the one English word on a translated card. */}
        <div className="bg-surface-secondary text-muted mt-2 rounded-lg p-3 text-base">
          {t("note")}
        </div>
      </Card.Content>
    </Card>
  );
}
