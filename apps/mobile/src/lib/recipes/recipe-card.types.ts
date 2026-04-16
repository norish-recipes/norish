export type RecipeCardItem = {
  id: string;
  version: number;
  ownerId: string | null;
  imageUrl: string;
  imageHeaders?: Record<string, string>;
  title: string;
  description: string;
  servings: number;
  rating: number;
  tags: string[];
  categories?: string[];
  course: string;
  liked: boolean;
  allergies?: string[];
  totalDurationMinutes: number;
};
