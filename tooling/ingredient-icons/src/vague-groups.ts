/**
 * The groups at the top of the seeded tree whose one picture would mislead
 * the foods filed under them: a "vegetable" icon on every unpictured
 * vegetable, a chicken leg on a turkey. They are drawn no icon, and listed in
 * the set's manifest as `none`, so borrowing stops before it turns vague and
 * a Draw icons round never draws them either. A group whose picture holds
 * for its kinds (flour, rice, egg, bread) is drawn like any food.
 */
export const VAGUE_GROUPS: readonly string[] = [
  "en:added-sugar",
  "en:alcohol",
  "en:algae",
  "en:animal",
  "en:cereal",
  "en:coating",
  "en:concentrate",
  "en:condiment",
  "en:dairy",
  "en:enzyme",
  "en:extract",
  "en:ferment",
  "en:fiber",
  "en:fish",
  "en:flavouring",
  "en:fruit",
  "en:game-animal",
  "en:herb",
  "en:meat",
  "en:nut",
  "en:oil-and-fat",
  "en:plant",
  "en:poultry",
  "en:preparation",
  "en:protein",
  "en:sauce",
  "en:seed",
  "en:shellfish",
  "en:starch",
  "en:varietal",
  "en:vegetable",
];
