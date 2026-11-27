"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { SettingRow } from "@/components/settings/setting-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { Note } from "@/components/shared/note";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import type { PermissionLevel, RecipePermissionPolicy } from "@norish/config/zod/server-config";
import { ServerConfigKeys, withinView } from "@norish/config/zod/server-config";
import { useAdminConfig, usePermissionPolicyMutations } from "@norish/shared-react/admin";

import type { PermissionLevelLabels } from "./permission-level-select";
import { PermissionLevelSelect } from "./permission-level-select";

type PolicyAction = "view" | "edit" | "delete";

/** The policy with one level changed; narrowing view narrows edit and delete with it. */
function withLevel(
  policy: RecipePermissionPolicy,
  action: PolicyAction,
  level: PermissionLevel
): RecipePermissionPolicy {
  return withinView({ ...policy, [action]: level });
}

/** Who outside a household may view, edit or delete its recipes and cookbooks; each select saves. */
export default function PermissionPolicyCard() {
  const t = useTranslations("settings.admin.permissions");
  const recipePermissionPolicy = useAdminConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY);
  const { saveRecipePolicy } = usePermissionPolicyMutations();
  const [saving, setSaving] = useState<PolicyAction | null>(null);

  const recipeLabels: PermissionLevelLabels = {
    everyone: { label: t("levels.everyone"), description: t("levels.everyoneDescription") },
    household: { label: t("levels.household"), description: t("levels.householdDescription") },
  };

  const handleRecipeChange = async (action: PolicyAction, value: PermissionLevel) => {
    if (!recipePermissionPolicy) return;

    setSaving(action);
    await saveRecipePolicy(withLevel(recipePermissionPolicy, action, value)).finally(() =>
      setSaving(null)
    );
  };

  const view = recipePermissionPolicy?.view;
  const renderPolicySelect = (action: PolicyAction, ariaLabel: string) => (
    <PermissionLevelSelect
      ariaLabel={ariaLabel}
      disabledLevels={
        action !== "view" && view === "household" ? (["everyone"] as const) : undefined
      }
      isDisabled={saving !== null}
      labels={recipeLabels}
      value={recipePermissionPolicy?.[action] ?? null}
      onChange={(level) => void handleRecipeChange(action, level)}
    />
  );

  return (
    <SettingsCard
      contentClassName="gap-6"
      description={t("description")}
      icon={ShieldCheckIcon}
      title={t("title")}
    >
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
    </SettingsCard>
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
