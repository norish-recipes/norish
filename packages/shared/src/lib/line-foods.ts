import type { RecipeIngredientsDto } from "@norish/shared/contracts/dto/recipe-ingredient";

/** How a recipe line naming several foods joins them (ADR-0037): all of them, or any one. */
export type LineJoin = NonNullable<RecipeIngredientsDto["joined"]>;

/** What a reader needs of a recipe line to read the foods it names. */
export type LineWithFoods = Partial<
  Pick<RecipeIngredientsDto, "id" | "ingredientId" | "ingredientName" | "joined" | "foods">
>;

/** A line as one of the foods it is bought and counted by. */
export type FoodToBuy<L extends LineWithFoods> = L & {
  /** The line it comes from. */
  lineId: L["id"];
  /** The line's other foods, any of which would do instead. */
  alternativeIds: string[];
};

/**
 * Lines as their foods are bought and counted: each food of an "and" line at the line's amount,
 * an "or" line's first with the rest beside it, any other line as it is.
 */
export function foodsToBuy<L extends LineWithFoods>(lines: readonly L[]): Array<FoodToBuy<L>> {
  return lines.flatMap((line): Array<FoodToBuy<L>> => {
    const foods = line.joined && line.foods?.length ? line.foods : undefined;

    if (!foods) return [{ ...line, lineId: line.id, alternativeIds: [] }];

    const each = line.joined === "together" ? foods : foods.slice(0, 1);

    return each.map((food, position) => ({
      ...line,
      id: position === 0 || !line.id ? line.id : `${line.id}:${position}`,
      lineId: line.id,
      ingredientId: food.ingredientId,
      ingredientName: food.name,
      alternativeIds:
        line.joined === "alternatives" ? foods.slice(1).map((other) => other.ingredientId) : [],
    }));
  });
}

/** The join a line keeps for these foods: one food or none has no join. */
export function joinOf(foods: readonly unknown[], joined: LineJoin | null): LineJoin | null {
  return foods.length > 1 ? joined : null;
}

/** Each food once, at its first place: a line or a split names a food no more than once. */
export function distinctFoods<F extends { ingredientId: string }>(foods: readonly F[]): F[] {
  return foods.filter(
    (food, index) => foods.findIndex((other) => other.ingredientId === food.ingredientId) === index
  );
}
