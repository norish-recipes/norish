import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import FloatingRecipeChip from "@/components/dashboard/floating-recipe-chip";
import RecipeGrid from "@/components/dashboard/recipe-grid";
import SearchInput from "@/components/dashboard/search-input";
import CreateRecipeButton from "@/components/dashboard/create-recipe-button";
import { auth } from "@/server/auth/auth";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const t = await getTranslations("recipes.dashboard");

  if (!session?.user) return null; // This should never happen due to proxy

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="mb-6 flex min-h-10 shrink-0 items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <CreateRecipeButton />
      </div>

      <div className="mb-6">
        <SearchInput />
      </div>

      <div className="min-h-0 flex-1">
        <RecipeGrid />
      </div>

      <FloatingRecipeChip />
    </div>
  );
}
