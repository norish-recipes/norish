"use client";

import { useRouter } from "next/navigation";
import { useRecipesMutations } from "@/hooks/use-recipes-mutations";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * Import a link, pasted text or images and say so; unless `stay`, go to the Library, where its
 * pending card shows.
 */
export function useImportRecipe({ stay = false }: { stay?: boolean } = {}) {
  const router = useRouter();
  const t = useTranslations("common.import.paste");
  const tImage = useTranslations("common.import.image");
  const mutations = useRecipesMutations();

  const start =
    <T>(title: string, description: string, run: (input: T) => void) =>
    (input: T) => {
      run(input);
      toast(title, { description, variant: "default" });
      if (!stay) router.push("/");
    };

  return {
    importRecipe: start(t("importing"), t("inProgress"), mutations.importRecipe),
    importRecipeWithAI: start(t("importingWithAI"), t("inProgress"), mutations.importRecipeWithAI),
    importFromPaste: start(t("importing"), t("inProgress"), mutations.importRecipeFromPaste),
    importFromPasteWithAI: start(
      t("importingWithAI"),
      t("inProgress"),
      mutations.importRecipeFromPasteWithAI
    ),
    importFromImages: start(
      tImage("importing"),
      tImage("analyzing"),
      mutations.importRecipeFromImages
    ),
  };
}
