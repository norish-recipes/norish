"use client";

import { useRouter } from "next/navigation";
import { useRecipeMutationErrorToast } from "@/hooks/use-recipes-mutations";
import { showActionToast } from "@/lib/ui/action-toast";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useImportMutations } from "@norish/shared-react/recipes";

/**
 * Import a link, pasted text or images and say so; unless `stay`, go to the Library, where its
 * pending card shows.
 */
export function useImportRecipe({ stay = false }: { stay?: boolean } = {}) {
  const router = useRouter();
  const t = useTranslations("common.import.paste");
  const tImage = useTranslations("common.import.image");
  const tImport = useTranslations("recipes.import");
  const showErrorToast = useRecipeMutationErrorToast();

  // Importing a URL the household already holds is an answer, not a failure:
  // say so, and offer the recipe the import was reaching for.
  const showAlreadyExistsToast = (recipeId: string): void => {
    showActionToast(tImport("alreadyExists"), {
      action: {
        label: tImport("openExisting"),
        onPress: () => router.push(`/recipes/${recipeId}`),
      },
    });
  };
  const mutations = useImportMutations(showErrorToast, showAlreadyExistsToast);

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
