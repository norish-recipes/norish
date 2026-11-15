import { SharedRecipeScreen } from "@/features/recipes/shared-recipe-screen";

export default async function SharedRecipePage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;

  return <SharedRecipeScreen token={token} />;
}
