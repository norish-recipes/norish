"use client";

import { useEffect, useMemo, useState } from "react";
import { SettingRow } from "@/app/(app)/settings/components/setting-row";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { usePending } from "@/hooks/use-pending";
import { Label, ListBox, Select } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { AutomaticIngredientsConfig } from "@norish/config/zod/server-config";
import { DEFAULT_AUTOMATIC_INGREDIENTS } from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";
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
  const { aiConfig, imageGenerationConfig, updateAIConfig } = useAdminSettingsContext();
  const stored = aiConfig?.automaticIngredients ?? DEFAULT_AUTOMATIC_INGREDIENTS;
  // An icon is drawn by the image provider: without one, it is not offered.
  const canDrawIcons = (imageGenerationConfig?.provider ?? "disabled") !== "disabled";
  const offered = AUTOMATIC_INGREDIENT_KEYS.filter((key) => key !== "icon" || canDrawIcons);
  const [selected, setSelected] = useState<AutomaticIngredient[]>(() => selectedOf(stored));
  const [prevStored, setPrevStored] = useState(stored);
  const [saving, whileSaving] = usePending();

  if (stored !== prevStored) {
    setPrevStored(stored);
    setSelected(selectedOf(stored));
  }

  const hasChanges = useMemo(
    () => AUTOMATIC_INGREDIENT_KEYS.some((key) => selected.includes(key) !== stored[key]),
    [selected, stored]
  );

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

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
        <Select
          aria-label={t("automatic")}
          className="w-full"
          data-testid="ai-automatic-ingredients"
          isDisabled={!aiConfig?.enabled}
          placeholder={t("automaticPlaceholder")}
          selectionMode="multiple"
          value={selected.filter((key) => offered.includes(key))}
          variant="secondary"
          onChange={(chosen) =>
            // An option not offered keeps its stored value.
            setSelected(
              AUTOMATIC_INGREDIENT_KEYS.filter((key) =>
                offered.includes(key) ? chosen.includes(key) : selected.includes(key)
              )
            )
          }
        >
          <Label className="sr-only">{t("automatic")}</Label>
          <Select.Trigger>
            <Select.Value className="min-w-0">
              {({ defaultChildren, isPlaceholder }) =>
                isPlaceholder ? (
                  defaultChildren
                ) : (
                  <span className="block truncate">
                    {selected
                      .filter((key) => offered.includes(key))
                      .map((key) => t(`kinds.${key}`))
                      .join(", ")}
                  </span>
                )
              }
            </Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox selectionMode="multiple">
              {offered.map((key) => (
                <ListBox.Item key={key} id={key} textValue={t(`kinds.${key}`)}>
                  <div className="flex flex-col">
                    <span>{t(`kinds.${key}`)}</span>
                    <span className="text-muted text-xs">{t(`kinds.${key}Description`)}</span>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
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
