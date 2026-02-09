"use client";

import type { PermissionLevel } from "@/server/db/zodSchemas/server-config";

import { Card, CardBody, CardHeader, Select, SelectItem } from "@heroui/react";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useTranslations } from "next-intl";

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

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheckIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </CardHeader>
      <CardBody className="gap-6">
        <p className="text-default-500 text-base">{t("description")}</p>

        <div className="flex flex-col gap-4">
          {/* View Policy */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t("viewRecipes")}</span>
              <span className="text-default-500 text-base">{t("viewDescription")}</span>
            </div>
            <Select
              aria-label={t("viewRecipes")}
              className="w-full sm:w-48"
              classNames={{
                trigger: "bg-content2",
              }}
              isDisabled={saving !== null}
              selectedKeys={recipePermissionPolicy?.view ? [recipePermissionPolicy.view] : []}
              size="sm"
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as PermissionLevel;

                if (value) handleChange("view", value);
              }}
            >
              {POLICY_OPTIONS.map((option) => (
                <SelectItem key={option.value} textValue={t(option.labelKey)}>
                  <div className="flex flex-col">
                    <span className="font-medium">{t(option.labelKey)}</span>
                    <span className="text-default-400 text-xs">{t(option.descriptionKey)}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* Edit Policy */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t("editRecipes")}</span>
              <span className="text-default-500 text-base">{t("editDescription")}</span>
            </div>
            <Select
              aria-label={t("editRecipes")}
              className="w-full sm:w-48"
              classNames={{
                trigger: "bg-content2",
              }}
              isDisabled={saving !== null}
              selectedKeys={recipePermissionPolicy?.edit ? [recipePermissionPolicy.edit] : []}
              size="sm"
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as PermissionLevel;

                if (value) handleChange("edit", value);
              }}
            >
              {POLICY_OPTIONS.map((option) => (
                <SelectItem key={option.value} textValue={t(option.labelKey)}>
                  <div className="flex flex-col">
                    <span className="font-medium">{t(option.labelKey)}</span>
                    <span className="text-default-400 text-xs">{t(option.descriptionKey)}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* Delete Policy */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t("deleteRecipes")}</span>
              <span className="text-default-500 text-base">{t("deleteDescription")}</span>
            </div>
            <Select
              aria-label={t("deleteRecipes")}
              className="w-full sm:w-48"
              classNames={{
                trigger: "bg-content2",
              }}
              isDisabled={saving !== null}
              selectedKeys={recipePermissionPolicy?.delete ? [recipePermissionPolicy.delete] : []}
              size="sm"
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as PermissionLevel;

                if (value) handleChange("delete", value);
              }}
            >
              {POLICY_OPTIONS.map((option) => (
                <SelectItem key={option.value} textValue={t(option.labelKey)}>
                  <div className="flex flex-col">
                    <span className="font-medium">{t(option.labelKey)}</span>
                    <span className="text-default-400 text-xs">{t(option.descriptionKey)}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>

        <div className="bg-content2 text-default-600 mt-2 rounded-lg p-3 text-base">
          <strong>Note:</strong> {t("note")}
        </div>
      </CardBody>
    </Card>
  );
}
