export type RecipeCardItem = {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  servings: number;
  rating: number;
  tags: string[];
  course: string;
  liked: boolean;
  totalDurationMinutes: number;
};
