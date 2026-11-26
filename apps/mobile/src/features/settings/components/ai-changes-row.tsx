import React from "react";
import { View } from "react-native";
import { useText } from "@/lib/i18n/use-text";

import { isOpenChange, useAIChangesQuery } from "@norish/shared-react/ingredients";

import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

/** The row over the Ingredients list that opens Changed by AI, saying how many changes are left to check. */
export function AiChangesRow({ onPress }: { onPress: () => void }) {
  const text = useText();
  const { total, unsure } = useAIChangesQuery((changes) => ({
    total: changes.length,
    unsure: changes.filter(isOpenChange).length,
  }));

  if (total === 0) return null;

  return (
    <View className="px-5">
      <SettingsGroup>
        <SettingsRow
          accessory="chevron"
          icon="sparkles-outline"
          testID="content-ai-changes"
          title={text("settings.ingredients.changedByAI.openCompact", { count: unsure })}
          onPress={onPress}
        />
      </SettingsGroup>
    </View>
  );
}
