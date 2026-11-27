"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Panel, { PanelComboBoxPopover } from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Section } from "@/components/shared/section";
import {
  ComboBox,
  Input,
  Label,
  ListBox,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useFormatter, useTranslations } from "next-intl";

import type { FactDraft, NutritionFactName, PickedFood } from "@norish/shared-react/ingredients";
import type {
  IngredientNutrition,
  NutritionFact,
} from "@norish/shared/contracts/ingredient-nutrition";
import type { SpoonMeasure } from "@norish/shared/lib/spoon-measure";
import {
  LABEL_FIELDS,
  spoonKey,
  useDatasetFoodSearch,
  useNutritionDraft,
} from "@norish/shared-react/ingredients";
import { spoonWeight } from "@norish/shared/lib/spoon-measure";

import { factSource } from "./nutrition-copy";

type Fact = NutritionFactName;

/**
 * Correct an Ingredient's nutrition for the household (ADR-0039), fact by
 * fact: the numbers per 100 g, what one piece weighs, and what a spoon of it
 * weighs in the measure the household's recipes use most, stored as the
 * same density whichever measure it was typed in. Each is kept as Norish has
 * it, set to a dataset food found by its name in the dataset's own words
 * ("Milk, semi-skimmed, UHT"), or typed from a label. A draft until Save, as
 * every panel is; Remove takes the household's correction away, every
 * member's.
 */
export function NutritionCorrectionPanel({
  ingredientId,
  name,
  current,
  measure,
  askSpoon = false,
  open,
  onClose,
}: {
  ingredientId: string;
  name: string;
  current: IngredientNutrition | null;
  /** The measure the household's recipes use most for the food, or null where none measures it by volume. */
  measure: SpoonMeasure | null;
  /** Open ready to type the spoon's weight, as the spoon row asks for it. */
  askSpoon?: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("settings.ingredients.nutrition");
  const tActions = useTranslations("common.actions");
  const format = useFormatter();
  const { spoon, draft, facts, corrected, complete, nothing, overHundred, set, save, removeAll } =
    useNutritionDraft({ ingredientId, current, measure, askSpoon, onClose });

  // What each fact is now, and where it came from, so the viewer sees what
  // the correction replaces; or that Norish has nothing for it yet.
  const whole = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const nowLine = <T,>(fact: NutritionFact<T> | null | undefined, value: (fact: T) => string) =>
    fact
      ? t("current", { value: value(fact.value), source: factSource(t, fact) })
      : t("currentNone");
  const now: Record<Fact, string> = {
    numbers: nowLine(current?.numbers, (value) => t("kcal", { value: whole(value.kcal) })),
    pieceWeight: nowLine(current?.pieceWeight, (grams) => t("grams", { value: whole(grams) })),
    density: nowLine(current?.density, (density) =>
      t("grams", { value: whole(spoonWeight(density, spoon)) })
    ),
  };

  return (
    <Panel
      nested
      open={open}
      title={t("correctTitle", { name })}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Panel.Body data-testid="nutrition-correction" sections>
        <p className="text-muted text-sm">{t("correctIntro")}</p>
        {facts.map((fact) => (
          <FactEditor
            key={fact}
            draft={draft[fact]}
            fact={fact}
            now={now[fact]}
            overHundred={overHundred.includes(fact)}
            spoon={spoon}
            onChange={(next) => set(fact, next)}
          />
        ))}
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup
          start={
            corrected ? (
              <ActionButton
                action="remove"
                data-testid="nutrition-correction-remove"
                onPress={removeAll}
              >
                {t("remove")}
              </ActionButton>
            ) : null
          }
        >
          <ActionButton
            action="save"
            data-testid="nutrition-correction-save"
            isDisabled={!complete || (nothing && !corrected)}
            onPress={save}
          >
            {tActions("save")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}

/** One fact of the correction: what it is now, where the correction comes from, and the food or the label's numbers. */
function FactEditor({
  fact,
  draft,
  now,
  overHundred,
  spoon,
  onChange,
}: {
  fact: Fact;
  draft: FactDraft;
  /** What the fact is now and where it came from, in a line. */
  now: string;
  /** The label has a mass per 100 g above 100 g. */
  overHundred: boolean;
  /** The measure a density is typed in. */
  spoon: SpoonMeasure;
  onChange: (next: Partial<FactDraft>) => void;
}) {
  const t = useTranslations("settings.ingredients.nutrition");
  const fields = LABEL_FIELDS[fact];

  return (
    <Section
      data-testid={`nutrition-correction-${fact}`}
      placement="panel"
      title={fact === "density" ? t(`spoon.${spoonKey(spoon)}`) : t(`facts.${fact}`)}
    >
      <p className="text-muted text-xs" data-testid={`nutrition-correction-${fact}-now`}>
        {now}
      </p>
      <ToggleButtonGroup
        disallowEmptySelection
        fullWidth
        selectedKeys={[draft.mode]}
        selectionMode="single"
        size="sm"
        onSelectionChange={(keys) => {
          const [mode] = Array.from(keys);

          if (mode === "sources" || mode === "food" || mode === "label") onChange({ mode });
        }}
      >
        <ToggleButton data-testid={`nutrition-correction-${fact}-sources`} id="sources">
          {t("useSources")}
        </ToggleButton>
        <ToggleButton data-testid={`nutrition-correction-${fact}-food`} id="food">
          <ToggleButtonGroup.Separator />
          {t("pickFood")}
        </ToggleButton>
        <ToggleButton data-testid={`nutrition-correction-${fact}-label`} id="label">
          <ToggleButtonGroup.Separator />
          {t("typeLabel")}
        </ToggleButton>
      </ToggleButtonGroup>
      {draft.mode === "food" ? (
        <DatasetFoodPicker
          fact={fact}
          picked={draft.food}
          spoon={spoon}
          onPick={(food) => onChange({ food })}
        />
      ) : null}
      {draft.mode === "label" ? (
        <div className={fields.length > 1 ? "grid grid-cols-2 gap-2" : "flex"}>
          {fields.map((field, index) => (
            <TextField
              key={field}
              className="min-w-0"
              value={draft.typed[index] ?? ""}
              onChange={(value) => {
                const typed = [...draft.typed];

                typed[index] = value;
                onChange({ typed });
              }}
            >
              <Label className="text-muted text-xs">
                {fact === "density"
                  ? t(`label.spoonGrams.${spoonKey(spoon)}`)
                  : t(`label.${field}`)}
              </Label>
              <Input
                data-testid={`nutrition-correction-${field}`}
                inputMode="decimal"
                variant="secondary"
              />
            </TextField>
          ))}
        </div>
      ) : null}
      {overHundred ? (
        <p className="text-danger text-xs" data-testid={`nutrition-correction-${fact}-over`}>
          {t("overHundred")}
        </p>
      ) : null}
    </Section>
  );
}

/**
 * Find a dataset food by the words of its name, in the dataset's own words.
 * For a piece weight or a density only foods with one are offered, a
 * density as what a spoon of the food weighs.
 */
function DatasetFoodPicker({
  fact,
  picked,
  spoon,
  onPick,
}: {
  fact: Fact;
  picked: PickedFood | null;
  spoon: SpoonMeasure;
  onPick: (food: PickedFood | null) => void;
}) {
  const t = useTranslations("settings.ingredients.nutrition");
  const format = useFormatter();
  // Inside a Panel the options must portal into it, or vaul swallows every tap (#511).
  const [term, setTerm] = useState(picked?.name ?? "");
  const { options: found, hint } = useDatasetFoodSearch(fact, term);
  const options = found.map((food) => ({
    ...food,
    detail: [
      food.dataset,
      fact === "numbers"
        ? t("kcal", { value: format.number(food.kcal, { maximumFractionDigits: 0 }) })
        : fact === "pieceWeight"
          ? t("grams", {
              value: format.number(food.pieceWeight ?? 0, { maximumFractionDigits: 0 }),
            })
          : t(`spoonGrams.${spoonKey(spoon)}`, {
              value: format.number(spoonWeight(food.density ?? 0, spoon), {
                maximumFractionDigits: 1,
              }),
            }),
    ].join(" · "),
  }));

  return (
    <ComboBox
      allowsEmptyCollection
      className="min-w-0"
      inputValue={term}
      items={options}
      menuTrigger="input"
      value={picked?.key ?? null}
      variant="secondary"
      onInputChange={(value) => {
        setTerm(value);
        if (picked) onPick(null);
      }}
      onChange={(key) => {
        const option = options.find((candidate) => candidate.id === key);

        if (!option) return;
        setTerm(option.name);
        onPick({
          key: option.id,
          name: option.name,
          kcal: option.kcal,
          pieceWeight: option.pieceWeight,
          density: option.density,
        });
      }}
    >
      <Label className="sr-only">{t("searchFood")}</Label>
      <Input
        data-testid="nutrition-food-picker"
        placeholder={t("searchFood")}
        variant="secondary"
      />
      <PanelComboBoxPopover>
        <ListBox
          renderEmptyState={() => (
            <p className="text-muted px-3 py-2 text-sm">
              {hint === "hint"
                ? t("foodHint")
                : hint === "searching"
                  ? t("searchingFoods")
                  : t("noFoods")}
            </p>
          )}
        >
          {(option: { id: string; name: string; detail: string }) => (
            <ListBox.Item
              data-testid="nutrition-food-option"
              id={option.id}
              textValue={option.name}
            >
              <FoodOption detail={option.detail}>{option.name}</FoodOption>
            </ListBox.Item>
          )}
        </ListBox>
      </PanelComboBoxPopover>
    </ComboBox>
  );
}

function FoodOption({ children, detail }: { children: ReactNode; detail: string }) {
  return (
    <span className="flex flex-col">
      <span>{children}</span>
      <span className="text-muted text-xs">{detail}</span>
    </span>
  );
}
