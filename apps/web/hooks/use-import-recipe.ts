"use client";

import { useRouter } from "next/navigation";
import { useRecipesMutations } from "@/hooks/use-recipes-mutations";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

/** Import a link, say so, and go to the Library, where its pending card shows. */
export function useImportRecipe() {
  const router = useRouter();
  const t = useTranslations("common.import.paste");
  const mutations = useRecipesMutations();

  const start = (title: string, importUrl: (url: string) => void) => (url: string) => {
    toast(title, { description: t("inProgress"), variant: "default" });
    importUrl(url);
    router.push("/");
  };

  return {
    importRecipe: start(t("importing"), mutations.importRecipe),
    importRecipeWithAI: start(t("importingWithAI"), mutations.importRecipeWithAI),
  };
}
