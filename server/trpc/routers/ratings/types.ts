export type RatingSubscriptionEvents = {
  ratingUpdated: {
    recipeId: string;
    averageRating: number | null;
    ratingCount: number;
  };
  ratingFailed: {
    recipeId: string;
    reason: string;
  };
};
