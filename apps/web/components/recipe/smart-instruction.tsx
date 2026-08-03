"use client";

import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { useTimerKeywordsQuery, useTimersEnabledQuery } from "@/hooks/config";

interface SmartInstructionProps {
  text: string;
  recipeId: string;
  recipeName?: string;
  stepIndex: number;
}

export function SmartInstruction({ text, recipeId, recipeName, stepIndex }: SmartInstructionProps) {
  const { timersEnabled } = useTimersEnabledQuery();
  const { timerKeywords } = useTimerKeywordsQuery();

  return (
    <SmartMarkdownRenderer
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
    />
  );
}
