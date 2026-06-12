"use client";

/**
 * Share-page-safe instruction renderer.
 *
 * This adapter must only read public share config. It intentionally avoids
 * authenticated config hooks, user context, private tRPC hooks, and private
 * recipe context.
 */
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { useSharePublicConfigQuery } from "@/hooks/recipes/use-share-public-config-query";

import type { IngredientLinkCandidate } from "@norish/shared-react/text";

interface PublicSmartInstructionProps {
  text: string;
  recipeId: string;
  token: string;
  recipeName?: string;
  stepIndex: number;
  ingredientCandidates?: IngredientLinkCandidate[];
  onIngredientPress?: (candidate: IngredientLinkCandidate) => void;
}

export function PublicSmartInstruction({
  text,
  recipeId,
  token,
  recipeName,
  stepIndex,
  ingredientCandidates,
  onIngredientPress,
}: PublicSmartInstructionProps) {
  const { timersEnabled, timerKeywords } = useSharePublicConfigQuery(token);

  return (
    <SmartMarkdownRenderer
      ingredientCandidates={ingredientCandidates}
      linkMode="public"
      text={text}
      timerConfig={{
        enabled: timersEnabled && timerKeywords.enabled,
        keywords: {
          hours: timerKeywords.hours,
          minutes: timerKeywords.minutes,
          seconds: timerKeywords.seconds,
        },
        recipeId,
        recipeName,
        stepIndex,
      }}
      onIngredientPress={onIngredientPress}
    />
  );
}
