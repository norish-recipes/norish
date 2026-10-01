/**
 * Ingredient Nutrition (ADR-0039): what an Ingredient's calories, fat,
 * carbohydrates and protein per 100 g are for one household, what one piece
 * of it weighs and how dense it is, each with where it came from. The one
 * place that knows the lookup order; the Ingredients page, the recipe page
 * and the language model's estimate all ask here.
 *
 * For each fact, first hit wins:
 *   1. the household's correction;
 *   2. Norish's fix list;
 *   3. the Ingredient's own CIQUAL code, then its proxy (2025, else 2020);
 *   4. CALNUT for those codes;
 *   5. its own USDA codes;
 *   6. its other CIQUAL-keyed codes;
 *   7. its name match;
 *   8. the nearest Parent Ingredient with the fact of its own, along
 *      Norish's tree at any distance, so a parent a person chose lends too;
 *      a lender that never lends ends the walk.
 * The piece weight takes the taxonomy's own before USDA's portions, and the
 * density USDA's before the taxonomy's; water is never assumed. Own before
 * inherited is deliberate: white wine reads dry white wine, not its
 * parent's pure alcohol.
 */
import type {
  NutritionCorrectionRow,
  NutritionFoodRow,
  NutritionNode,
} from "@norish/db/repositories/ingredient-nutrition";
import type {
  IngredientNutrition,
  NutritionFoodRef,
  NutritionSource,
  Per100g,
} from "@norish/shared/contracts/ingredient-nutrition";
import {
  findHouseholdCorrections,
  findNutritionFoods,
  findNutritionLineage,
  findNutritionRules,
} from "@norish/db/repositories/ingredient-nutrition";

/** Whose corrections count: a household's members, or nobody's (the catalogue export). */
export interface NutritionReader {
  householdUserIds: readonly string[];
}

export const NO_HOUSEHOLD: NutritionReader = { householdUserIds: [] };

/** One step's dataset food for an Ingredient, and where it is from. */
interface Step {
  source: NutritionSource;
  food: NutritionFoodRow;
}

/** What one step offers for one fact. */
interface Offer<T> {
  source: NutritionSource;
  value: T | null;
}

type OwnFacts = {
  [K in keyof IngredientNutrition]: Omit<NonNullable<IngredientNutrition[K]>, "borrowedFrom"> | null;
};

function refOf(food: NutritionFoodRow): NutritionFoodRef {
  return { dataset: food.dataset as NutritionFoodRef["dataset"], code: food.code, name: food.name };
}

function per100g(food: NutritionFoodRow): Per100g {
  return { kcal: food.kcal, fat: food.fat, carbs: food.carbs, protein: food.protein };
}

/** The first offer that has a value. */
function first<T>(offers: ReadonlyArray<Offer<T>>): { value: T; source: NutritionSource } | null {
  const found = offers.find((offer) => offer.value !== null);

  return found ? { value: found.value!, source: found.source } : null;
}

/** The corrections, foods and rules every node of a lineage needs, read in four queries. */
async function readSources(nodes: readonly NutritionNode[], reader: NutritionReader) {
  const corrections = await findHouseholdCorrections(
    nodes.map((node) => node.id),
    reader.householdUserIds
  );
  const rules = await findNutritionRules(nodes.flatMap((node) => (node.offId ? [node.offId] : [])));
  const fixes = new Map<string, string>();
  const names = new Map<string, string>();
  const neverLend = new Set<string>();

  for (const rule of rules) {
    if (rule.kind === "fix" && rule.food) fixes.set(rule.offId, rule.food);
    else if (rule.kind === "name" && rule.food) names.set(rule.offId, rule.food);
    else if (rule.kind === "never-lend") neverLend.add(rule.offId);
  }

  const keys: string[] = [
    ...fixes.values(),
    ...names.values(),
    ...[...corrections.values()].flatMap((correction) =>
      [correction.numbersFood, correction.pieceWeightFood, correction.densityFood].filter(
        (key): key is string => key !== null
      )
    ),
  ];
  const ndbs: string[] = [];

  for (const node of nodes) {
    const codes = node.nutritionCodes;

    if (!codes) continue;
    for (const code of [...codes.ciqual, ...codes.ciqualOther]) {
      keys.push(`ciqual:${code}`, `ciqual-2020:${code}`, `calnut:${code}`);
    }
    for (const code of codes.usda) {
      const [kind, value] = code.split(":");

      if (kind === "ndb") ndbs.push(value!);
      else keys.push(`usda:${value}`);
    }
  }

  const foods = await findNutritionFoods(keys, ndbs);
  const byKey = new Map(foods.map((food) => [`${food.dataset}:${food.code}`, food]));
  const byNdb = new Map<string, NutritionFoodRow>();

  for (const food of foods) if (food.ndb && !byNdb.has(food.ndb)) byNdb.set(food.ndb, food);

  return { corrections, fixes, names, neverLend, byKey, byNdb };
}

type Sources = Awaited<ReturnType<typeof readSources>>;

/** Steps 2 to 7 for one Ingredient, in order: its fix, its codes' foods, its name match. */
function stepsOf(node: NutritionNode, sources: Sources): Step[] {
  const { fixes, names, byKey, byNdb } = sources;
  const codes = node.nutritionCodes;
  const food = (key: string | undefined) => (key ? byKey.get(key) : undefined);
  const step = (kind: "fix" | "code" | "name", found: NutritionFoodRow | undefined): Step[] =>
    found ? [{ source: { kind, food: refOf(found) }, food: found }] : [];
  const ciqual = (code: string) => step("code", food(`ciqual:${code}`) ?? food(`ciqual-2020:${code}`));
  const calnut = (code: string) => step("code", food(`calnut:${code}`));
  const usda = (code: string) => {
    const [kind, value] = code.split(":");

    return step("code", kind === "ndb" ? byNdb.get(value!) : food(`usda:${value}`));
  };

  return [
    ...step("fix", food(node.offId ? fixes.get(node.offId) : undefined)),
    ...(codes?.ciqual.flatMap(ciqual) ?? []),
    ...(codes?.ciqual.flatMap(calnut) ?? []),
    ...(codes?.usda.flatMap(usda) ?? []),
    ...(codes?.ciqualOther.flatMap((code) => [...ciqual(code), ...calnut(code)]) ?? []),
    ...step("name", food(node.offId ? names.get(node.offId) : undefined)),
  ];
}

/**
 * Step 1, the household's correction, fact by fact: a dataset food it picked
 * or numbers it typed, each the last word for that fact.
 */
function correctionOffers(
  correction: NutritionCorrectionRow | undefined,
  sources: Sources
): { numbers: Array<Offer<Per100g>>; pieceWeight: Array<Offer<number>>; density: Array<Offer<number>> } {
  const picked = (key: string | null) => (key ? (sources.byKey.get(key) ?? null) : null);
  const source = (food: NutritionFoodRow | null): NutritionSource =>
    food ? { kind: "household-food", food: refOf(food) } : { kind: "household" };

  if (!correction) return { numbers: [], pieceWeight: [], density: [] };

  const numbersFood = picked(correction.numbersFood);
  const { kcal, fat, carbs, protein } = correction;
  const typed = kcal !== null && fat !== null && carbs !== null && protein !== null;
  const pieceFood = picked(correction.pieceWeightFood);
  const densityFood = picked(correction.densityFood);

  return {
    numbers: numbersFood
      ? [{ source: source(numbersFood), value: per100g(numbersFood) }]
      : typed
        ? [{ source: source(null), value: { kcal, fat, carbs, protein } }]
        : [],
    pieceWeight: [{ source: source(pieceFood), value: pieceFood?.pieceWeight ?? correction.pieceWeight }],
    density: [{ source: source(densityFood), value: densityFood?.density ?? correction.density }],
  };
}

/**
 * An Ingredient's own facts, before any borrowing: its household's
 * correction, then the sources. The numbers come from the first step with a
 * food. The piece weight takes the taxonomy's own after a
 * fix and before any code's portion; the density takes the codes' portions
 * before the taxonomy's own, and a name match's last.
 */
function ownFacts(node: NutritionNode, sources: Sources): OwnFacts {
  const steps = stepsOf(node, sources);
  const kind = (wanted: NutritionSource["kind"]) => steps.filter((it) => it.source.kind === wanted);
  const offer = (fact: "pieceWeight" | "density") => (it: Step) => ({
    source: it.source,
    value: it.food[fact],
  });
  const taxonomy = (value: number | null | undefined): Array<Offer<number>> =>
    value ? [{ source: { kind: "taxonomy" }, value }] : [];
  const corrected = correctionOffers(sources.corrections.get(node.id), sources);

  return {
    numbers: first([
      ...corrected.numbers,
      ...steps.map((it) => ({ source: it.source, value: per100g(it.food) })),
    ]),
    pieceWeight: first([
      ...corrected.pieceWeight,
      ...kind("fix").map(offer("pieceWeight")),
      ...taxonomy(node.nutritionCodes?.pieceWeight),
      ...kind("code").map(offer("pieceWeight")),
      ...kind("name").map(offer("pieceWeight")),
    ]),
    density: first([
      ...corrected.density,
      ...kind("fix").map(offer("density")),
      ...kind("code").map(offer("density")),
      ...taxonomy(node.nutritionCodes?.density),
      ...kind("name").map(offer("density")),
    ]),
  };
}

/**
 * Resolve Ingredient Nutrition for these Ingredients, as `reader`'s household
 * sees it. An id that names no Ingredient answers nothing at all.
 */
export async function resolveIngredientNutrition(
  ingredientIds: readonly string[],
  reader: NutritionReader
): Promise<Map<string, IngredientNutrition>> {
  const lineage = await findNutritionLineage(ingredientIds);
  const sources = await readSources([...lineage.values()], reader);
  const own = new Map([...lineage.values()].map((node) => [node.id, ownFacts(node, sources)]));
  const answer = new Map<string, IngredientNutrition>();

  const borrow = <K extends keyof IngredientNutrition>(
    node: NutritionNode,
    fact: K
  ): IngredientNutrition[K] => {
    const mine = own.get(node.id)?.[fact];

    if (mine) return { ...mine, borrowedFrom: null } as IngredientNutrition[K];

    const seen = new Set([node.id]);

    for (let parentId = node.parentId; parentId && !seen.has(parentId); ) {
      const parent = lineage.get(parentId);

      if (!parent) break;
      seen.add(parent.id);
      // A lender that never lends ends the walk: its children have no numbers rather than bad ones.
      if (parent.offId && sources.neverLend.has(parent.offId)) break;

      const lent = own.get(parent.id)?.[fact];

      if (lent) {
        return { ...lent, borrowedFrom: { id: parent.id, name: parent.name } } as IngredientNutrition[K];
      }
      parentId = parent.parentId;
    }

    return null as IngredientNutrition[K];
  };

  for (const id of new Set(ingredientIds)) {
    const node = lineage.get(id);

    if (!node) continue;
    answer.set(id, {
      numbers: borrow(node, "numbers"),
      pieceWeight: borrow(node, "pieceWeight"),
      density: borrow(node, "density"),
    });
  }

  return answer;
}

