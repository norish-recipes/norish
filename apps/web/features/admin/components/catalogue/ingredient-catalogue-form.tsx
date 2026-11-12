"use client";

import { useState } from "react";
import { SettingRow } from "@/components/settings/setting-row";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { usePending } from "@/hooks/use-pending";
import { useTranslations } from "next-intl";

import type { AutomaticIngredientsConfig } from "@norish/config/zod/server-config";
import { DEFAULT_AUTOMATIC_INGREDIENTS, ServerConfigKeys } from "@norish/config/zod/server-config";
import { useAdminConfig, useAIConfigMutations } from "@norish/shared-react/admin";

import { useReportDirty } from "../../hooks/use-report-dirty";
import { KindsSelect } from "../kinds-select";
import CleanUpCatalogue from "./clean-up-catalogue";
import FillGaps from "./fill-gaps";

interface IngredientCatalogueFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

type AutomaticIngredient = keyof AutomaticIngredientsConfig;

const AUTOMATIC_INGREDIENT_KEYS = [
  "cleanUp",
  "nutrition",
  "conversions",
  "icon",
] as const satisfies readonly AutomaticIngredient[];

function selectedOf(config: AutomaticIngredientsConfig): AutomaticIngredient[] {
  return AUTOMATIC_INGREDIENT_KEYS.filter((key) => config[key]);
}

export default function IngredientCatalogueForm({ onDirtyChange }: IngredientCatalogueFormProps) {
  const t = useTranslations("settings.admin.aiProcessing.ingredientCatalogue");
  const tActions = useTranslations("common.actions");
  const aiConfig = useAdminConfig(ServerConfigKeys.AI_CONFIG);
  // An icon is drawn by the image provider: without one, it is not offered.
  const canDrawIcons = useAdminConfig(
    ServerConfigKeys.IMAGE_GENERATION_CONFIG,
    (config) => (config?.provider ?? "disabled") !== "disabled"
  );
  const { save: updateAIConfig } = useAIConfigMutations();
  const stored = aiConfig?.automaticIngredients ?? DEFAULT_AUTOMATIC_INGREDIENTS;
  const offered = AUTOMATIC_INGREDIENT_KEYS.filter((key) => key !== "icon" || canDrawIcons);
  const [selected, setSelected] = useState<AutomaticIngredient[]>(() => selectedOf(stored));
  const [prevStored, setPrevStored] = useState(stored);
  const [saving, whileSaving] = usePending();

  if (stored !== prevStored) {
    setPrevStored(stored);
    setSelected(selectedOf(stored));
  }

  const hasChanges = AUTOMATIC_INGREDIENT_KEYS.some(
    (key) => selected.includes(key) !== stored[key]
  );

  useReportDirty(hasChanges, onDirtyChange);

  const handleSave = async () => {
    if (!aiConfig) return;
    await whileSaving(() =>
      updateAIConfig({
        ...aiConfig,
        automaticIngredients: Object.fromEntries(
          AUTOMATIC_INGREDIENT_KEYS.map((key) => [key, selected.includes(key)])
        ) as AutomaticIngredientsConfig,
      })
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <SettingRow description={t("automaticDescription")} title={t("automatic")}>
        <KindsSelect
          isDisabled={!aiConfig?.enabled}
          label={t("automatic")}
          options={offered.map((key) => ({
            id: key,
            label: t(`kinds.${key}`),
            description: t(`kinds.${key}Description`),
          }))}
          placeholder={t("automaticPlaceholder")}
          testId="ai-automatic-ingredients"
          value={selected}
          onChange={(chosen) =>
            // An option not offered keeps its stored value.
            setSelected(
              AUTOMATIC_INGREDIENT_KEYS.filter((key) =>
                offered.includes(key) ? chosen.includes(key) : selected.includes(key)
              )
            )
          }
        />
      </SettingRow>

      <ActionButtonGroup className="pt-2">
        <ActionButton
          action="save"
          isDisabled={!aiConfig || !hasChanges}
          isPending={saving}
          onPress={handleSave}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>

      <CleanUpCatalogue />
      <FillGaps />
    </div>
  );
}
