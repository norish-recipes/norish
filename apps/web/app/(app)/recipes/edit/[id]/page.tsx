import { notFound } from "next/navigation";

import RecipeForm from "../components/recipe-form";

import { getRecipeFull } from "@/server/db";

interface EditRecipePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const { id } = await params;
  const recipe = await getRecipeFull(id);

  if (!recipe) {
    notFound();
  }

  return <RecipeForm initialData={recipe} mode="edit" />;
}
