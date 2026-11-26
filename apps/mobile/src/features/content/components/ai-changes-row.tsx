import React from "react";
import { Card } from "@/components/card";
import { CountRow } from "@/components/count-row";
import { Ionicons } from "@/components/icon";
import { useTokenColor } from "@/hooks/use-token-color";
import { useText } from "@/lib/i18n/use-text";

import { useAIChangeCounts } from "@norish/shared-react/ingredients";

/** The row over the Ingredients list that opens Changed by AI, with a tag saying how many changes are left to check. */
export function AiChangesRow({ onPress }: { onPress: () => void }) {
  const text = useText();
  const muted = useTokenColor("muted");
  const { total, unsure } = useAIChangeCounts();

  if (total === 0) return null;

  return (
    <Card surface>
      <CountRow
        leading={<Ionicons color={muted} name="sparkles-outline" size={20} />}
        name={text("settings.ingredients.changedByAI.title")}
        tag={
          unsure > 0
            ? text("settings.ingredients.changedByAI.toCheck", { count: unsure })
            : undefined
        }
        testID="content-ai-changes"
        onPress={onPress}
      />
    </Card>
  );
}
