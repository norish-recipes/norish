import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { appRouter, createHttpContextFromHeaders } from "@norish/trpc/server";

import RecipeForm from "../components/recipe-form";

interface EditRecipePageProps {
  params: Promise<{ id: string }>;
}

function shouldRenderNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return ["FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(String(error.code));
}

async function getEditableRecipe(id: string) {
  const ctx = await createHttpContextFromHeaders(new Headers(await headers()), null);
  const caller = appRouter.createCaller(ctx);

  return caller.recipes.getEditable({ id });
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const { id } = await params;
  let recipe: Awaited<ReturnType<typeof getEditableRecipe>>;

  try {
    recipe = await getEditableRecipe(id);
  } catch (error) {
    if (shouldRenderNotFound(error)) {
      notFound();
    }

    throw error;
  }

  return <RecipeForm initialData={recipe} mode="edit" />;
}
