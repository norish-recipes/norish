"use client";

import { useState } from "react";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Card, Label, ListBox, Select } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PermissionLevel } from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";

type PolicyAction = "view" | "edit" | "delete";

export default function PermissionPolicyCard() {
  const t = useTranslations("settings.admin.permissions");
  const { recipePermissionPolicy, updateRecipePermissionPolicy } = useAdminSettingsContext();
  const [saving, setSaving] = useState<PolicyAction | null>(null);

  const POLICY_OPTIONS: { value: PermissionLevel; labelKey: string; descriptionKey: string }[] = [
    {
      value: "everyone",
      labelKey: "levels.everyone",
      descriptionKey: "levels.everyoneDescription",
    },
    {
      value: "household",
      labelKey: "levels.household",
      descriptionKey: "levels.householdDescription",
    },
    {
      value: "owner",
      labelKey: "levels.owner",
      descriptionKey: "levels.ownerDescription",
    },
  ];

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
    <Select
      aria-label={ariaLabel}
      className="w-full sm:w-48"
      isDisabled={saving !== null}
      placeholder={ariaLabel}
      selectedKey={recipePermissionPolicy?.[action] ?? null}
      size="sm"
      variant="secondary"
      onSelectionChange={(key) => {
        if (typeof key === "string") {
          void handleChange(action, key as PermissionLevel);
        }
      }}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover placement="bottom end">
        <ListBox>
          {POLICY_OPTIONS.map((option) => (
            <ListBox.Item key={option.value} id={option.value} textValue={t(option.labelKey)}>
              <div className="flex flex-col">
                <span>{t(option.labelKey)}</span>
                <span className="text-muted text-xs">{t(option.descriptionKey)}</span>
              </div>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
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
          {/* View Policy */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t("viewRecipes")}</span>
              <span className="text-muted text-base">{t("viewDescription")}</span>
            </div>
            {renderPolicySelect("view", t("viewRecipes"))}
          </div>

          {/* Edit Policy */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t("editRecipes")}</span>
              <span className="text-muted text-base">{t("editDescription")}</span>
            </div>
            {renderPolicySelect("edit", t("editRecipes"))}
          </div>

          {/* Delete Policy */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t("deleteRecipes")}</span>
              <span className="text-muted text-base">{t("deleteDescription")}</span>
            </div>
            {renderPolicySelect("delete", t("deleteRecipes"))}
          </div>
        </div>

        <div className="bg-surface-secondary text-muted mt-2 rounded-lg p-3 text-base">
          <strong>Note:</strong> {t("note")}
        </div>
      </Card.Content>
    </Card>
  );
}
