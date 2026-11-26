"use client";

import { useState } from "react";

import type {
  IngredientNutrition,
  NutritionFact,
  NutritionFoodRef,
  Per100g,
} from "@norish/shared/contracts/ingredient-nutrition";
import type { SpoonMeasure } from "@norish/shared/lib/spoon-measure";
import { densityFromSpoon, spoonWeight } from "@norish/shared/lib/spoon-measure";

import { useNutritionCorrection } from "./use-ingredient-nutrition";

export type Mode = "sources" | "food" | "label";

export type NutritionFactName = "numbers" | "pieceWeight" | "density";

/** A dataset food as the picker offers it, with what it said of the food, to show before the server does. */
export interface PickedFood {
  key: string;
  name: string;
  kcal?: number;
  pieceWeight?: number | null;
  density?: number | null;
}

/** One fact of the draft: left to the sources, a dataset food, or what a label says. */
export interface FactDraft {
  mode: Mode;
  food: PickedFood | null;
  /** The label's numbers as typed: calories, fat, carbohydrates, protein; or grams. */
  typed: string[];
}

export const LABEL_FIELDS: Record<NutritionFactName, readonly string[]> = {
  numbers: ["calories", "fat", "carbs", "protein"],
  pieceWeight: ["pieceGrams"],
  density: ["spoonGrams"],
};

/** The label fields that weigh grams of a food's 100 g, so can be no more than 100. */
const MASS_PER_100G: ReadonlySet<string> = new Set(["fat", "carbs", "protein"]);

/** Whether a fact's typed label holds a mass per 100 g above 100 g. */
function overHundredGrams(fact: NutritionFactName, draft: FactDraft) {
  return (
    draft.mode === "label" &&
    LABEL_FIELDS[fact].some(
      (field, index) =>
        MASS_PER_100G.has(field) && (typedNumber(draft.typed[index] ?? "") ?? 0) > 100
    )
  );
}

/** The dataset food a pick names, as a fact credits it. */
function foodRef(food: PickedFood): NutritionFoodRef {
  const [dataset, ...code] = food.key.split(":");

  return { dataset: dataset as NutritionFoodRef["dataset"], code: code.join(":"), name: food.name };
}

/** One fact as the household will have it once the correction lands: a label's numbers are exact,
 * a picked food keeps the numbers it did not know until the server says them. */
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

/** The household's correction of a food's nutrition (ADR-0039), fact by fact, as a draft until
 * `save`. Mount it afresh for each opening so the draft starts from what the household has. */
export function useNutritionDraft({
  ingredientId,
  current,
  measure,
  askSpoon = false,
  onClose,
}: {
  ingredientId: string;
  current: IngredientNutrition | null;
  /** The measure the household's recipes use most for the food, or null where none measures it by volume. */
  measure: SpoonMeasure | null;
  /** Start ready to type the spoon's weight, as the spoon row asks for it. */
  askSpoon?: boolean;
  onClose: () => void;
}) {
  const correction = useNutritionCorrection(ingredientId);
  // A density is typed as what the household's measure weighs; with none,
  // a correction made before is shown per 100 ml.
  const spoon = measure ?? "100ml";
  const [own] = useState<Record<NutritionFactName, FactDraft>>(() => ({
    numbers: draftOf(current?.numbers ?? null, (value) =>
      [value.kcal, value.fat, value.carbs, value.protein].map(String)
    ),
    pieceWeight: draftOf(current?.pieceWeight ?? null, (value) => [String(value)]),
    density: draftOf(current?.density ?? null, (value) => [
      String(Math.round(spoonWeight(value, spoon) * 10) / 10),
    ]),
  }));
  // Asked from the spoon row, the spoon's weight waits to be typed.
  const [initial] = useState<Record<NutritionFactName, FactDraft>>(() =>
    askSpoon && own.density.mode === "sources"
      ? { ...own, density: { mode: "label", food: null, typed: [] } }
      : own
  );
  const [draft, setDraft] = useState(initial);
  const corrected = Object.values(own).some((fact) => fact.mode !== "sources");
  // The spoon is asked about only where the household's recipes measure the
  // food by volume, or where its own correction already says one.
  const facts: readonly NutritionFactName[] =
    measure || initial.density.mode !== "sources"
      ? ["numbers", "pieceWeight", "density"]
      : ["numbers", "pieceWeight"];

  /** One fact as the procedure takes it: a dataset food, a label's numbers, the sources (null), or undefined while the draft is not complete. */
  const factInput = <T>(
    fact: NutritionFactName,
    label: (values: number[]) => T | undefined
  ): { food: string } | T | null | undefined => {
    const { mode, food, typed } = draft[fact];

    if (mode === "food") return food ? { food: food.key } : undefined;
    if (mode === "sources") return null;

    const values = typed.map(typedNumber);

    if (
      values.length !== LABEL_FIELDS[fact].length ||
      values.some((value) => value === null) ||
      overHundredGrams(fact, draft[fact])
    ) {
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

    return { gramsPerMl: densityFromSpoon(grams, spoon) };
  });
  // Every fact must be complete; all three left to the sources is a removal.
  const complete = numbers !== undefined && pieceWeight !== undefined && density !== undefined;
  const nothing = complete && numbers === null && pieceWeight === null && density === null;

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

  return {
    spoon,
    draft,
    facts,
    corrected,
    complete,
    nothing,
    canSave: complete && !(nothing && !corrected),
    /** The facts whose label has a mass per 100 g above 100 g, which none can save. */
    overHundred: facts.filter((fact) => overHundredGrams(fact, draft[fact])),
    set: (fact: NutritionFactName, next: Partial<FactDraft>) =>
      setDraft((previous) => ({ ...previous, [fact]: { ...previous[fact], ...next } })),
    /** The panel closes and the facts change at once; the server's word follows, and a refusal undoes it. */
    save: () => {
      if (!complete) return;
      onClose();
      if (nothing) correction.remove();
      else correction.correct({ numbers, pieceWeight, density }, shownNutrition());
    },
    removeAll: () => {
      onClose();
      correction.remove();
    },
  };
}
