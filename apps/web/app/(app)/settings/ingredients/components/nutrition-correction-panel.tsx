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
  NutritionFoodRef,
  Per100g,
} from "@norish/shared/contracts/ingredient-nutrition";
import type { SpoonMeasure } from "@norish/shared/lib/spoon-measure";
import { NUTRITION_CREDIT_NAMES } from "@norish/shared/contracts/ingredient-nutrition";
import { SPOON_MEASURE_ML } from "@norish/shared/lib/spoon-measure";

import { factSource, spoonKey } from "./nutrition-copy";

/** How long typing pauses before the datasets are searched. */
const SEARCH_DELAY_MS = 250;

type Mode = "sources" | "food" | "label";

type Fact = "numbers" | "pieceWeight" | "density";

/** A dataset food as the picker offers it, with what it said of the food, to show before the server does. */
interface PickedFood {
  key: string;
  name: string;
  kcal?: number;
  pieceWeight?: number | null;
  density?: number | null;
}

/** The dataset food a pick names, as a fact credits it. */
function foodRef(food: PickedFood): NutritionFoodRef {
  const [dataset, ...code] = food.key.split(":");

  return { dataset: dataset as NutritionFoodRef["dataset"], code: code.join(":"), name: food.name };
}

/**
 * One fact as the household will have it once the correction lands, for the
 * panel to show at once: a label's numbers are exact; a picked food brings
 * what the picker knew of it, and keeps the numbers it did not know until
 * the server says them. Left to the sources, the fact is the server's to
 * say: null here keeps what is shown.
 */
function shownFact<T>(
  draft: FactDraft,
  typed: () => T,
  fromFood: (food: PickedFood) => T | undefined,
  before: NutritionFact<T> | null
): NutritionFact<T> | null | undefined {
  if (draft.mode === "label") {
    return { value: typed(), source: { kind: "household" }, borrowedFrom: null };
  }
  if (draft.mode === "food" && draft.food) {
    const value = fromFood(draft.food) ?? before?.value;

    if (value === undefined) return undefined;

    return {
      value,
      source: { kind: "household-food", food: foodRef(draft.food) },
      borrowedFrom: null,
    };
  }

  return undefined;
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
  density: ["spoonGrams"],
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // A density is typed as what the household's measure weighs; with none,
  // a correction made before is shown per 100 ml.
  const spoon = measure ?? "100ml";
  const spoonMl = SPOON_MEASURE_ML[spoon];
  // The panel is mounted afresh for each opening, so the draft starts from
  // what the household has now.
  const [own] = useState<Record<Fact, FactDraft>>(() => ({
    numbers: draftOf(current?.numbers ?? null, (value) =>
      [value.kcal, value.fat, value.carbs, value.protein].map(String)
    ),
    pieceWeight: draftOf(current?.pieceWeight ?? null, (value) => [String(value)]),
    density: draftOf(current?.density ?? null, (value) => [
      String(Math.round(value * spoonMl * 10) / 10),
    ]),
  }));
  // Asked from the spoon row, the spoon's weight waits to be typed.
  const [initial] = useState<Record<Fact, FactDraft>>(() =>
    askSpoon && own.density.mode === "sources"
      ? { ...own, density: { mode: "label", food: null, typed: [] } }
      : own
  );
  const [draft, setDraft] = useState(initial);
  const corrected = Object.values(own).some((fact) => fact.mode !== "sources");
  // The spoon is asked about only where the household's recipes measure the
  // food by volume, or where its own correction already says one.
  const facts: readonly Fact[] =
    measure || initial.density.mode !== "sources"
      ? ["numbers", "pieceWeight", "density"]
      : ["numbers", "pieceWeight"];

  const correct = useMutation(trpc.ingredients.correctNutrition.mutationOptions());
  const remove = useMutation(trpc.ingredients.removeNutritionCorrection.mutationOptions());

  // What the server did replaces what was shown: the Ingredient's own facts,
  // and every recipe total worked out from them.
  const refetch = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.ingredients.nutrition.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.ingredients.nutritionFor.queryKey() }),
    ]);

  /**
   * One fact as the procedure takes it: a dataset food, a label's numbers
   * (`label` says what the typed values make), the sources (null), or
   * undefined while the draft is not complete.
   */
  const factInput = <T,>(
    fact: Fact,
    label: (values: number[]) => T | undefined
  ): { food: string } | T | null | undefined => {
    const { mode, food, typed } = draft[fact];

    if (mode === "food") return food ? { food: food.key } : undefined;
    if (mode === "sources") return null;

    const values = typed.map(typedNumber);

    if (values.length !== LABEL_FIELDS[fact].length || values.some((value) => value === null)) {
      return undefined;
    }

    return label(values.map((value) => value ?? 0));
  };
  const numbers = factInput("numbers", ([kcal = 0, fat = 0, carbs = 0, protein = 0]) => ({
    kcal,
    fat,
    carbs,
    protein,
  }));
  const pieceWeight = factInput("pieceWeight", ([grams = 0]) =>
    grams > 0 ? { grams } : undefined
  );
  const density = factInput("density", ([grams = 0]) => {
    if (!(grams > 0)) return undefined;
    // Left as it was, a correction keeps the density it was stored with,
    // whatever measure it was typed in then.
    if (current?.density && draft.density.typed[0] === initial.density.typed[0]) {
      return { gramsPerMl: current.density.value };
    }

    return { gramsPerMl: grams / spoonMl };
  });
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

  /** What the section shows the moment the correction is saved, before the server has it. */
  const shownNutrition = (): IngredientNutrition | null => {
    if (!numbers && !pieceWeight && !density) return null;
    const next: IngredientNutrition = current ?? {
      numbers: null,
      pieceWeight: null,
      density: null,
    };
    const shown = {
      numbers: shownFact<Per100g>(
        draft.numbers,
        () => (numbers && "kcal" in numbers ? numbers : { kcal: 0, fat: 0, carbs: 0, protein: 0 }),
        () => undefined,
        current?.numbers ?? null
      ),
      pieceWeight: shownFact<number>(
        draft.pieceWeight,
        () => (pieceWeight && "grams" in pieceWeight ? pieceWeight.grams : 0),
        (food) => food.pieceWeight ?? undefined,
        current?.pieceWeight ?? null
      ),
      density: shownFact<number>(
        draft.density,
        () => (density && "gramsPerMl" in density ? density.gramsPerMl : 0),
        (food) => food.density ?? undefined,
        current?.density ?? null
      ),
    };

    return {
      numbers: shown.numbers === undefined ? next.numbers : shown.numbers,
      pieceWeight: shown.pieceWeight === undefined ? next.pieceWeight : shown.pieceWeight,
      density: shown.density === undefined ? next.density : shown.density,
    };
  };

  /** The panel closes and the facts change at once; the server's word follows, and a refusal undoes it. */
  const land = (
    shown: IngredientNutrition | null,
    message: string,
    edit: () => Promise<unknown>
  ) => {
    if (shown) {
      queryClient.setQueryData(trpc.ingredients.nutrition.queryKey({ ingredientId }), shown);
    }
    toast(message, { variant: "success" });
    onClose();
    edit()
      .catch(fail)
      .finally(() => void refetch());
  };

  const save = () => {
    if (!complete) return;
    if (nothing) {
      land(null, t("removed"), () => remove.mutateAsync({ ingredientId }));

      return;
    }
    land(shownNutrition(), t("saved"), () =>
      correct.mutateAsync({ ingredientId, numbers, pieceWeight, density })
    );
  };

  const removeAll = () => land(null, t("removed"), () => remove.mutateAsync({ ingredientId }));

  const set = (fact: Fact, next: Partial<FactDraft>) =>
    setDraft((previous) => ({ ...previous, [fact]: { ...previous[fact], ...next } }));

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
      t("grams", { value: whole(density * spoonMl) })
    ),
  };

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
          {facts.map((fact) => (
            <FactEditor
              key={fact}
              draft={draft[fact]}
              fact={fact}
              now={now[fact]}
              spoon={spoon}
              onChange={(next) => set(fact, next)}
            />
          ))}
        </div>
      </Panel.Body>
      <Panel.Footer>
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {corrected ? (
            <Button data-testid="nutrition-correction-remove" variant="ghost" onPress={removeAll}>
              {t("remove")}
            </Button>
          ) : (
            <span />
          )}
          <ActionButton
            action="save"
            data-testid="nutrition-correction-save"
            isDisabled={!complete || (nothing && !corrected)}
            onPress={save}
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

/** One fact of the correction: what it is now, where the correction comes from, and the food or the label's numbers. */
function FactEditor({
  fact,
  draft,
  now,
  spoon,
  onChange,
}: {
  fact: Fact;
  draft: FactDraft;
  /** What the fact is now and where it came from, in a line. */
  now: string;
  /** The measure a density is typed in. */
  spoon: SpoonMeasure;
  onChange: (next: Partial<FactDraft>) => void;
}) {
  const t = useTranslations("settings.ingredients.nutrition");
  const fields = LABEL_FIELDS[fact];

  return (
    <section className="flex flex-col gap-2" data-testid={`nutrition-correction-${fact}`}>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
          {fact === "density" ? t(`spoon.${spoonKey(spoon)}`) : t(`facts.${fact}`)}
        </h3>
        <p className="text-muted text-xs" data-testid={`nutrition-correction-${fact}-now`}>
          {now}
        </p>
      </div>
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
    </section>
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
      kcal: food.kcal,
      pieceWeight: food.pieceWeight,
      density: food.density,
      detail: [
        NUTRITION_CREDIT_NAMES[food.dataset],
        fact === "numbers"
          ? t("kcal", { value: format.number(food.kcal, { maximumFractionDigits: 0 }) })
          : fact === "pieceWeight"
            ? t("grams", {
                value: format.number(food.pieceWeight ?? 0, { maximumFractionDigits: 0 }),
              })
            : t(`spoonGrams.${spoonKey(spoon)}`, {
                value: format.number((food.density ?? 0) * SPOON_MEASURE_ML[spoon], {
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
