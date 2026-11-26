import ContentSkeleton from "@/features/content/content-skeleton";
import { IngredientsSkeleton } from "@/features/ingredients/components/ingredients-skeleton";

export default function Loading() {
  return <ContentSkeleton ingredients={<IngredientsSkeleton />} />;
}
