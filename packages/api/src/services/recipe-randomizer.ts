import type { RandomRecipeCandidate } from "@norish/db/repositories/recipes";

/**
 * Fisher-Yates shuffle - ensures true randomness by shuffling candidates
 * before weighted selection. Without this, DB ordering causes deterministic results.
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = shuffled[i];
    const target = shuffled[j];

    if (current === undefined || target === undefined) {
      continue;
    }

    [shuffled[i], shuffled[j]] = [target, current];
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
  if (candidates.length === 1) return candidates[0] ?? null;

  const shuffled = shuffleArray(candidates);
  const weights = shuffled.map(calculateWeight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  }

  let random = Math.random() * totalWeight;

  for (let i = 0; i < shuffled.length; i++) {
    const weight = weights[i];
    const candidate = shuffled[i];

    if (weight === undefined || candidate === undefined) {
      continue;
    }

    random -= weight;

    if (random <= 0) {
      return candidate;
    }
  }

  return shuffled[shuffled.length - 1] ?? null;
}
