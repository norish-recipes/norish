import { useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { sharedRecipeFamilyHooks } from "@/hooks/recipes/shared-recipe-hooks";
import { Toast, useToast } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecipeEnrichmentKind } from "@norish/shared/lib/recipe-enrichment";

const sharedUseRecipeEnrichment = sharedRecipeFamilyHooks.useRecipeEnrichment;

/** Recipe Enrichment lifecycle and manual requests for all four kinds. */
export function useRecipeEnrichment(recipeId: string) {
  const { user } = useAuth();
  const intl = useIntl();
  const { toast } = useToast();

  const onManualError = useCallback(
    (kind: RecipeEnrichmentKind, error: unknown) => {
      const description =
        error instanceof Error && error.message
          ? error.message
          : intl.formatMessage({ id: `recipes.enrichment.kinds.${kind}` });

      toast.show({
        component: (props) => (
          <Toast variant="danger" {...props} className="gap-1">
            <Toast.Title className="text-foreground">
              {intl.formatMessage({ id: "recipes.enrichment.failed" })}
            </Toast.Title>
            <Toast.Description className="text-muted">{description}</Toast.Description>
          </Toast>
        ),
      });
    },
    [intl, toast]
  );

  return sharedUseRecipeEnrichment(recipeId, user?.id ?? null, { onManualError });
}
