import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Sheet, SheetList } from "@/components/sheet";
import { SheetSearchField } from "@/components/sheet-search-field";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { ChoiceParams } from "../components/editor/choice-request";
import { takeChoice } from "../components/editor/choice-request";

/** A searchable list over the editor, for its country and cuisines: its name, title and mode from the route, the rest from `requestChoice`. */
export function EditorChoiceScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { name, title, multiple } = useLocalSearchParams<
    Pick<ChoiceParams, "name" | "title"> & { multiple?: string }
  >();
  const [request] = useState(takeChoice);
  const [selected, setSelected] = useState(request?.selected ?? []);
  const [query, setQuery] = useState("");
  const [accent] = useThemeColor(["accent"] as const);

  // A relaunch restores the route without the request that opened it.
  useEffect(() => {
    if (!request) router.back();
  }, [request, router]);

  if (!request) return null;

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? request.choices.filter((choice) => choice.label.toLowerCase().includes(needle))
    : request.choices;

  const pick = (key: string) => {
    const ticked = selected.includes(key);

    if (!multiple) {
      request.onChange(ticked ? [] : [key]);
      router.back();

      return;
    }
    const next = ticked ? selected.filter((candidate) => candidate !== key) : [...selected, key];

    setSelected(next);
    request.onChange(next);
  };

  return (
    <Sheet name={name} title={title}>
      <SheetList
        ListHeaderComponent={
          <View className="pb-2">
            <SheetSearchField
              label={intl.formatMessage({ id: "common.actions.search" })}
              testID={`${name}-search`}
              value={query}
              onChange={setQuery}
            />
          </View>
        }
        data={shown}
        keyExtractor={(choice) => choice.key}
        renderItem={({ item, index }) => {
          const ticked = selected.includes(item.key);

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: ticked }}
              className={`min-h-12 flex-row items-center justify-between ${index === 0 ? "" : "border-separator border-t"}`}
              testID={`${name}-${item.key}`}
              onPress={() => pick(item.key)}
            >
              <Text className="text-foreground flex-1 text-[17px]">{item.label}</Text>
              {ticked ? <Ionicons color={accent} name="checkmark" size={20} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}
