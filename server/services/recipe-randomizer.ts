import type { RandomRecipeCandidate } from "@/server/db/repositories/recipes";

/**
 * Fisher-Yates shuffle - ensures true randomness by shuffling candidates
 * before weighted selection. Without this, DB ordering causes deterministic results.
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function calculateWeight(candidate: RandomRecipeCandidate): number {
  let weight = 1.0;

  const favoriteBonus = Math.min(candidate.householdFavoriteCount * 0.2, 1.0);

  weight += favoriteBonus;

  if (candidate.householdAverageRating !== null && candidate.householdAverageRating < 3) {
    weight *= 0.7;
  }

  return Math.max(weight, 0.1);
}

export function selectWeightedRandomRecipe(
  candidates: RandomRecipeCandidate[]
): RandomRecipeCandidate | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const shuffled = shuffleArray(candidates);
  const weights = shuffled.map(calculateWeight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  let random = Math.random() * totalWeight;

  for (let i = 0; i < shuffled.length; i++) {
    random -= weights[i];

    if (random <= 0) {
      return shuffled[i];
    }
  }

  return shuffled[shuffled.length - 1];
}
