import { RecipeScreen } from "@/features/recipes/recipe-screen";

export default async function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  const { id } = await params;

  return <RecipeScreen recipeId={id} />;
}
