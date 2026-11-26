import React from "react";
import { View } from "react-native";
import { Card } from "@/components/card";
import { CountRow } from "@/components/count-row";
import { useTokenColor } from "@/hooks/use-token-color";
import { useText } from "@/lib/i18n/use-text";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useAIChangeCounts } from "@norish/shared-react/ingredients";

/** The row over the Ingredients list that opens Changed by AI, saying how many changes are left to check. */
export function AiChangesRow({ onPress }: { onPress: () => void }) {
  const text = useText();
  const muted = useTokenColor("muted");
  const { total, unsure } = useAIChangeCounts();

  if (total === 0) return null;

  return (
    <View className="px-5">
      <Card surface>
        <CountRow
          leading={<Ionicons color={muted} name="sparkles-outline" size={20} />}
          name={text("settings.ingredients.changedByAI.openCompact", { count: unsure })}
          testID="content-ai-changes"
          onPress={onPress}
        />
      </Card>
    </View>
  );
}
