"use client";

import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { useTimerKeywordsQuery, useTimersEnabledQuery } from "@/hooks/config";

import type { IngredientLinkCandidate } from "@norish/shared-react/text";

interface SmartInstructionProps {
  text: string;
  recipeId: string;
  recipeName?: string;
  stepIndex: number;
  ingredientCandidates?: IngredientLinkCandidate[];
  onIngredientPress?: (candidate: IngredientLinkCandidate) => void;
}

export function SmartInstruction({
  text,
  recipeId,
  recipeName,
  stepIndex,
  ingredientCandidates,
  onIngredientPress,
}: SmartInstructionProps) {
  const { timersEnabled } = useTimersEnabledQuery();
  const { timerKeywords } = useTimerKeywordsQuery();

  return (
    <SmartMarkdownRenderer
      ingredientCandidates={ingredientCandidates}
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
