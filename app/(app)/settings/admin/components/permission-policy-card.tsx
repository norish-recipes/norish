"use client";

import type { PermissionLevel } from "@/server/db/zodSchemas/server-config";

import { Card, CardBody, CardHeader, Select, SelectItem } from "@heroui/react";
import { ShieldCheckIcon } from "@heroicons/react/16/solid";
import { useState } from "react";

import { useAdminSettingsContext } from "../context";

const POLICY_OPTIONS: { value: PermissionLevel; label: string; description: string }[] = [
  {
    value: "everyone",
    label: "Everyone",
    description: "All authenticated users",
  },
  {
    value: "household",
    label: "Household",
    description: "Recipe owner and their household members",
  },
  {
    value: "owner",
    label: "Owner Only",
    description: "Only the recipe owner",
  },
];

type PolicyAction = "view" | "edit" | "delete";

export default function PermissionPolicyCard() {
  const { recipePermissionPolicy, updateRecipePermissionPolicy } = useAdminSettingsContext();
  const [saving, setSaving] = useState<PolicyAction | null>(null);

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
          Recipe Permissions
        </h2>
      </CardHeader>
      <CardBody className="gap-6">
        <p className="text-default-500 text-base">
          Control who can view, edit, and delete recipes. Server admins always have full access.
        </p>

        <div className="flex flex-col gap-4">
          {/* View Policy */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">View Recipes</span>
              <span className="text-default-500 text-base">
                Who can see recipes in the dashboard
              </span>
            </div>
            <Select
              aria-label="View permission"
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
                <SelectItem key={option.value} textValue={option.label}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-default-400 text-xs">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* Edit Policy */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Edit Recipes</span>
              <span className="text-default-500 text-base">Who can modify recipe details</span>
            </div>
            <Select
              aria-label="Edit permission"
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
                <SelectItem key={option.value} textValue={option.label}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-default-400 text-xs">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* Delete Policy */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Delete Recipes</span>
              <span className="text-default-500 text-base">Who can remove recipes</span>
            </div>
            <Select
              aria-label="Delete permission"
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
                <SelectItem key={option.value} textValue={option.label}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-default-400 text-xs">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>

        <div className="bg-content2 text-default-600 mt-2 rounded-lg p-3 text-base">
          <strong>Note:</strong> Groceries and Calendar items follow household rules automatically,
          household members can always edit/delete items belonging to anyone in the same household.
        </div>
      </CardBody>
    </Card>
  );
}
