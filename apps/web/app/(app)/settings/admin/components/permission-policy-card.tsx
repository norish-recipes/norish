"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { SettingRow } from "@/app/(app)/settings/components/setting-row";
import { Note } from "@/components/shared/note";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PermissionLevel } from "@norish/config/zod/server-config";

import type { PermissionLevelLabels } from "./permission-level-select";
import { useAdminSettingsContext } from "../context";
import { PermissionLevelSelect } from "./permission-level-select";

type PolicyAction = "view" | "edit" | "delete";

/**
 * Who may do what with what others made: one card, a section per kind of
 * thing. Recipes have a level for viewing, editing and deleting; Ingredients
 * one for editing, since the catalogue is always visible and adding a
 * translation is open to everyone. Each select saves as it changes.
 */
export default function PermissionPolicyCard() {
  const t = useTranslations("settings.admin.permissions");
  const tIngredients = useTranslations("settings.admin.ingredientPermissions");
  const {
    recipePermissionPolicy,
    updateRecipePermissionPolicy,
    ingredientPermissionPolicy,
    updateIngredientPermissionPolicy,
  } = useAdminSettingsContext();
  const [saving, setSaving] = useState<PolicyAction | "ingredients" | null>(null);

  const recipeLabels: PermissionLevelLabels = {
    everyone: { label: t("levels.everyone"), description: t("levels.everyoneDescription") },
    household: { label: t("levels.household"), description: t("levels.householdDescription") },
    owner: { label: t("levels.owner"), description: t("levels.ownerDescription") },
  };
  const ingredientLabels: PermissionLevelLabels = {
    everyone: {
      label: tIngredients("levels.everyone"),
      description: tIngredients("levels.everyoneDescription"),
    },
    household: {
      label: tIngredients("levels.household"),
      description: tIngredients("levels.householdDescription"),
    },
    owner: {
      label: tIngredients("levels.owner"),
      description: tIngredients("levels.ownerDescription"),
    },
  };

  const handleRecipeChange = async (action: PolicyAction, value: PermissionLevel) => {
    if (!recipePermissionPolicy) return;

    setSaving(action);
    try {
      await updateRecipePermissionPolicy({ ...recipePermissionPolicy, [action]: value });
    } finally {
      setSaving(null);
    }
  };

  const handleIngredientChange = async (edit: PermissionLevel) => {
    setSaving("ingredients");
    try {
      await updateIngredientPermissionPolicy({ edit });
    } finally {
      setSaving(null);
    }
  };

  const renderPolicySelect = (action: PolicyAction, ariaLabel: string) => (
    <PermissionLevelSelect
      ariaLabel={ariaLabel}
      isDisabled={saving !== null}
      labels={recipeLabels}
      value={recipePermissionPolicy?.[action] ?? null}
      onChange={(level) => void handleRecipeChange(action, level)}
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

        <Section id="recipes" note={t("note")} title={t("recipes")}>
          <SettingRow description={t("viewDescription")} title={t("viewRecipes")}>
            {renderPolicySelect("view", t("viewRecipes"))}
          </SettingRow>
          <SettingRow description={t("editDescription")} title={t("editRecipes")}>
            {renderPolicySelect("edit", t("editRecipes"))}
          </SettingRow>
          <SettingRow description={t("deleteDescription")} title={t("deleteRecipes")}>
            {renderPolicySelect("delete", t("deleteRecipes"))}
          </SettingRow>
        </Section>

        <Section id="ingredients" note={tIngredients("note")} title={t("ingredients")}>
          <p className="text-muted text-base">{tIngredients("description")}</p>
          <SettingRow
            description={tIngredients("editDescription")}
            title={tIngredients("editIngredients")}
          >
            <PermissionLevelSelect
              ariaLabel={tIngredients("editIngredients")}
              isDisabled={saving !== null}
              labels={ingredientLabels}
              value={ingredientPermissionPolicy?.edit ?? null}
              onChange={(level) => void handleIngredientChange(level)}
            />
          </SettingRow>
        </Section>
      </Card.Content>
    </Card>
  );
}

/** One kind of thing on the card: a heading, its rows, and the note that goes with them. */
function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4" data-testid={`permissions-${id}`}>
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
      <Note>{note}</Note>
    </section>
  );
}
