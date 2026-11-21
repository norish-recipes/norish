"use client";

import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";

import type { ImportOptions } from "./use-import-mutations";
import { usePlatform } from "../platform/platform";
import { useImportMutations } from "./use-import-mutations";
import { useRecipeMutationErrorToast } from "./use-recipe-mutation-error-toast";

/** Whether pasted text is over what an AI import takes, the spaces around it aside. */
export function isPasteTooLong(text: string): boolean {
  return text.trim().length > MAX_RECIPE_PASTE_CHARS;
}

/**
 * Import a link, pasted text or images and say so; unless `stay`, go to the Library, where its
 * pending card shows.
 */
export function useImportRecipe({ stay = false }: { stay?: boolean } = {}) {
  const { toast, navigation } = usePlatform();
  const showErrorToast = useRecipeMutationErrorToast("common.import.paste.failed");

  // Importing a URL the household already holds is an answer, not a failure:
  // say so, and offer the recipe the import was reaching for.
  const showAlreadyExistsToast = (recipeId: string): void => {
    toast.show({
      severity: "default",
      title: toast.translate("recipes.import.alreadyExists"),
      actionLabel: toast.translate("recipes.import.openExisting"),
      onActionPress: () => navigation.toRecipe(recipeId),
    });
  };
  const mutations = useImportMutations(showErrorToast, showAlreadyExistsToast);

  const start =
    <T>(titleId: string, descriptionId: string, run: (input: T, options?: ImportOptions) => void) =>
    (input: T, options?: ImportOptions) => {
      const announce = () =>
        toast.show({
          severity: "default",
          title: toast.translate(titleId),
          description: toast.translate(descriptionId),
        });

      // A caller that keeps failures for a later try says so only once the server queued it.
      if (options?.keeps) {
        run(input, { ...options, onAccepted: announce });
      } else {
        run(input, options);
        announce();
      }
      if (!stay) navigation.toHome();
    };

  return {
    importRecipe: start(
      "common.import.paste.importing",
      "common.import.paste.inProgress",
      mutations.importRecipe
    ),
    importRecipeWithAI: start(
      "common.import.paste.importingWithAI",
      "common.import.paste.inProgress",
      mutations.importRecipeWithAI
    ),
    importFromPaste: start(
      "common.import.paste.importing",
      "common.import.paste.inProgress",
      mutations.importRecipeFromPaste
    ),
    /** False, with a warning, when the text is over the AI import's length cap. */
    importFromPasteWithAI: (text: string): boolean => {
      if (isPasteTooLong(text)) {
        toast.show({
          severity: "warning",
          title: toast.translate("common.import.paste.tooLarge"),
          description: toast.translate("common.import.paste.maxCharacters", {
            max: MAX_RECIPE_PASTE_CHARS.toLocaleString(),
          }),
        });

        return false;
      }
      start(
        "common.import.paste.importingWithAI",
        "common.import.paste.inProgress",
        mutations.importRecipeFromPasteWithAI
      )(text);

      return true;
    },
    importFromImages: start(
      "common.import.image.importing",
      "common.import.image.analyzing",
      mutations.importRecipeFromImages
    ),
  };
}
