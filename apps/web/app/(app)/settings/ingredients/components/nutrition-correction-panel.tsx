"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import Panel, { usePanelPortalContainer } from "@/components/Panel/Panel";
import { ActionButton } from "@/components/shared/action-button";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  TextField,
  toast,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import type {
  IngredientNutrition,
  NutritionFact,
} from "@norish/shared/contracts/ingredient-nutrition";
import { NUTRITION_CREDIT_NAMES } from "@norish/shared/contracts/ingredient-nutrition";

import { CUP_ML } from "./nutrition-copy";

/** How long typing pauses before the datasets are searched. */
const SEARCH_DELAY_MS = 250;

type Mode = "sources" | "food" | "label";

type Fact = "numbers" | "pieceWeight" | "density";

/** A dataset food as the picker offers it. */
interface PickedFood {
  key: string;
  name: string;
}

/** One fact of the draft: left to the sources, a dataset food, or what a label says. */
interface FactDraft {
  mode: Mode;
  food: PickedFood | null;
  /** The label's numbers as typed: calories, fat, carbohydrates, protein; or grams. */
  typed: string[];
}

const LABEL_FIELDS: Record<Fact, readonly string[]> = {
  numbers: ["calories", "fat", "carbs", "protein"],
  pieceWeight: ["pieceGrams"],
  density: ["cupGrams"],
};

/** A number as a person types it: a comma or a point, nothing negative. */
function typedNumber(text: string): number | null {
  const value = Number(text.trim().replace(",", "."));

  return text.trim() !== "" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** The draft a fact starts from: the household's own correction where it has one, else the sources. */
function draftOf<T>(fact: NutritionFact<T> | null, typed: (value: T) => string[]): FactDraft {
  const empty = { mode: "sources" as const, food: null, typed: [] };

  if (!fact || fact.borrowedFrom) return empty;
  if (fact.source.kind === "household-food") {
    const { food } = fact.source;

    return {
      mode: "food",
      food: { key: `${food.dataset}:${food.code}`, name: food.name },
      typed: [],
    };
  }
  if (fact.source.kind === "household")
    return { mode: "label", food: null, typed: typed(fact.value) };

  return empty;
}

/**
 * Correct an Ingredient's nutrition for the household (ADR-0039), fact by
 * fact: the numbers per 100 g, what one piece weighs, what a cup weighs.
 * Each is kept as Norish has it, set to a dataset food found by its name
 * in the dataset's own words ("Milk, semi-skimmed, UHT"), or typed from a
 * label. A draft until Save, as every panel is; Remove takes the
 * household's correction away, every member's.
 */
export function NutritionCorrectionPanel({
  ingredientId,
  name,
  current,
  open,
  onClose,
}: {
  ingredientId: string;
  name: string;
  current: IngredientNutrition | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("settings.ingredients.nutrition");
  const tActions = useTranslations("common.actions");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // The panel is mounted afresh for each opening, so the draft starts from
  // what the household has now.
  const [initial] = useState<Record<Fact, FactDraft>>(() => ({
    numbers: draftOf(current?.numbers ?? null, (value) =>
      [value.kcal, value.fat, value.carbs, value.protein].map(String)
    ),
    pieceWeight: draftOf(current?.pieceWeight ?? null, (value) => [String(value)]),
    density: draftOf(current?.density ?? null, (value) => [
      String(Math.round(value * CUP_ML * 10) / 10),
    ]),
  }));
  const [draft, setDraft] = useState(initial);
  const corrected = Object.values(initial).some((fact) => fact.mode !== "sources");

  const correct = useMutation(trpc.ingredients.correctNutrition.mutationOptions());
  const remove = useMutation(trpc.ingredients.removeNutritionCorrection.mutationOptions());
  const busy = correct.isPending || remove.isPending;

  const refetch = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.ingredients.nutrition.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.ingredients.nutritionFor.queryKey() }),
    ]);
  };

  const factInput = (fact: Fact) => {
    const { mode, food, typed } = draft[fact];

    if (mode === "food") return food ? { food: food.key } : undefined;
    if (mode === "sources") return null;

    const values = typed.map(typedNumber);

    if (values.length !== LABEL_FIELDS[fact].length || values.some((value) => value === null)) {
      return undefined;
    }
    if (fact === "numbers") {
      const [kcal, fat, carbs, protein] = values as number[];

      return { kcal: kcal!, fat: fat!, carbs: carbs!, protein: protein! };
    }
    if (fact === "pieceWeight") return values[0]! > 0 ? { grams: values[0]! } : undefined;

    return values[0]! > 0 ? { gramsPerMl: values[0]! / CUP_ML } : undefined;
  };
  const numbers = factInput("numbers");
  const pieceWeight = factInput("pieceWeight");
  const density = factInput("density");
  // Every fact must be complete; all three left to the sources is a removal.
  const complete = numbers !== undefined && pieceWeight !== undefined && density !== undefined;
  const nothing = complete && numbers === null && pieceWeight === null && density === null;

  const fail = (error: unknown) =>
    showSafeErrorToast({
      title: t("errors.title"),
      description: t(
        `errors.${error instanceof Error && isRefusal(error.message) ? error.message : "unknown"}`
      ),
      error,
      context: "ingredients:correct-nutrition",
    });

  const save = async () => {
    if (!complete || busy) return;
    try {
      if (nothing) {
        await remove.mutateAsync({ ingredientId });
      } else {
        await correct.mutateAsync({ ingredientId, numbers, pieceWeight, density });
      }
      await refetch();
      toast(nothing ? t("removed") : t("saved"), { variant: "success" });
      onClose();
    } catch (error) {
      fail(error);
    }
  };

  const removeAll = async () => {
    try {
      await remove.mutateAsync({ ingredientId });
      await refetch();
      toast(t("removed"), { variant: "success" });
      onClose();
    } catch (error) {
      fail(error);
    }
  };

  const set = (fact: Fact, next: Partial<FactDraft>) =>
    setDraft((previous) => ({ ...previous, [fact]: { ...previous[fact], ...next } }));

  return (
    <Panel
      nested
      className="contents"
      open={open}
      title={t("correctTitle", { name })}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Panel.Body>
        <div className="flex flex-col gap-5 pb-2" data-testid="nutrition-correction">
          <p className="text-muted text-sm">{t("correctIntro")}</p>
          {(["numbers", "pieceWeight", "density"] as const).map((fact) => (
            <FactEditor
              key={fact}
              busy={busy}
              draft={draft[fact]}
              fact={fact}
              onChange={(next) => set(fact, next)}
            />
          ))}
        </div>
      </Panel.Body>
      <Panel.Footer>
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {corrected ? (
            <Button
              data-testid="nutrition-correction-remove"
              isDisabled={busy}
              variant="ghost"
              onPress={() => void removeAll()}
            >
              {t("remove")}
            </Button>
          ) : (
            <span />
          )}
          <ActionButton
            action="save"
            data-testid="nutrition-correction-save"
            isDisabled={busy || !complete || (nothing && !corrected)}
            isPending={busy}
            onPress={() => void save()}
          >
            {tActions("save")}
          </ActionButton>
        </div>
      </Panel.Footer>
    </Panel>
  );
}

const REFUSALS = ["unknown-food", "empty", "not-found"] as const;

function isRefusal(message: string): message is (typeof REFUSALS)[number] {
  return (REFUSALS as readonly string[]).includes(message);
}

/** One fact of the correction: where it comes from, and the food or the label's numbers. */
function FactEditor({
  fact,
  draft,
  busy,
  onChange,
}: {
  fact: Fact;
  draft: FactDraft;
  busy: boolean;
  onChange: (next: Partial<FactDraft>) => void;
}) {
  const t = useTranslations("settings.ingredients.nutrition");
  const fields = LABEL_FIELDS[fact];

  return (
    <section className="flex flex-col gap-2" data-testid={`nutrition-correction-${fact}`}>
      <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
        {t(`facts.${fact}`)}
      </h3>
      <ToggleButtonGroup
        disallowEmptySelection
        fullWidth
        isDisabled={busy}
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
        <DatasetFoodPicker fact={fact} picked={draft.food} onPick={(food) => onChange({ food })} />
      ) : null}
      {draft.mode === "label" ? (
        <div className={fields.length > 1 ? "grid grid-cols-2 gap-2" : "flex"}>
          {fields.map((field, index) => (
            <TextField
              key={field}
              className="min-w-0"
              isDisabled={busy}
              value={draft.typed[index] ?? ""}
              onChange={(value) => {
                const typed = [...draft.typed];

                typed[index] = value;
                onChange({ typed });
              }}
            >
              <Label className="text-muted text-xs">{t(`label.${field}`)}</Label>
              <Input
                data-testid={`nutrition-correction-${field}`}
                inputMode="decimal"
                variant="secondary"
              />
            </TextField>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Find a dataset food by the words of its name, in the dataset's own words.
 * For a piece weight or a density only foods with one are offered.
 */
function DatasetFoodPicker({
  fact,
  picked,
  onPick,
}: {
  fact: Fact;
  picked: PickedFood | null;
  onPick: (food: PickedFood | null) => void;
}) {
  const t = useTranslations("settings.ingredients.nutrition");
  const format = useFormatter();
  const trpc = useTRPC();
  // Inside a Panel the options must portal into it, or vaul swallows every tap (#511).
  const portalContainer = usePanelPortalContainer();
  const [term, setTerm] = useState(picked?.name ?? "");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [term]);

  const { data, isFetching } = useQuery({
    ...trpc.ingredients.nutritionFoods.queryOptions({ search }),
    enabled: search.length >= 2,
  });
  const options = (data ?? [])
    .filter((food) =>
      fact === "pieceWeight"
        ? food.pieceWeight !== null
        : fact === "density"
          ? food.density !== null
          : true
    )
    .map((food) => ({
      id: `${food.dataset}:${food.code}`,
      name: food.name,
      detail: [
        NUTRITION_CREDIT_NAMES[food.dataset],
        fact === "numbers"
          ? t("kcal", { value: format.number(food.kcal, { maximumFractionDigits: 0 }) })
          : fact === "pieceWeight"
            ? t("grams", {
                value: format.number(food.pieceWeight ?? 0, { maximumFractionDigits: 0 }),
              })
            : t("cupGrams", {
                value: format.number((food.density ?? 0) * CUP_ML, { maximumFractionDigits: 0 }),
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
      selectedKey={picked?.key ?? null}
      variant="secondary"
      onInputChange={(value) => {
        setTerm(value);
        if (picked) onPick(null);
      }}
      onSelectionChange={(key) => {
        const option = options.find((candidate) => candidate.id === key);

        if (!option) return;
        setTerm(option.name);
        onPick({ key: option.id, name: option.name });
      }}
    >
      <Label className="sr-only">{t("searchFood")}</Label>
      <Input
        data-testid="nutrition-food-picker"
        placeholder={t("searchFood")}
        variant="secondary"
      />
      <ComboBox.Popover UNSTABLE_portalContainer={portalContainer}>
        <ListBox
          renderEmptyState={() => (
            <p className="text-muted px-3 py-2 text-sm">
              {term.trim().length < 2
                ? t("foodHint")
                : isFetching || search !== term.trim()
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
      </ComboBox.Popover>
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
