import React from "react";
import { Pressable, Text, View } from "react-native";
import { CardSlice } from "@/components/card-slice";
import { EmptyCard } from "@/components/empty-card";
import { Section } from "@/components/section";
import { HeadingRow, sectionRows } from "@/components/section-rows";
import { Sheet, SheetBody, SheetList } from "@/components/sheet";
import { edgeAt } from "@/lib/card-edges";
import { useText } from "@/lib/i18n/use-text";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import {
  aiChangesView,
  changeCopy,
  isOpenChange,
  useAIChangeMutations,
  useAIChangesQuery,
} from "@norish/shared-react/ingredients";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

/** Changed by AI: the last month's changes, open ones first with Keep and Undo; a name opens its food. */
export function IngredientChangesScreen() {
  const text = useText();
  const router = useRouter();
  const { locale } = useIntl();
  const changes = useAIChangesQuery((all) => all);
  const { keep, undo, keepAll, undoAll, clear } = useAIChangeMutations();
  const { unsure, rest, actionable, answerAll } = aiChangesView(changes);
  const rows = sectionRows(
    [
      { key: "unsure", section: "unsure" as const, heading: unsure.length > 0, items: unsure },
      {
        key: "sure",
        section: "sure" as const,
        heading: unsure.length > 0 && rest.length > 0,
        items: rest,
      },
    ],
    (change) => change.id
  );
  const secondary = [
    ...(answerAll
      ? [
          {
            label: text("settings.ingredients.changedByAI.undoAll"),
            symbol: "arrow.uturn.backward" as const,
            onPress: () => void undoAll(actionable),
          },
        ]
      : []),
    ...(rest.length > 0
      ? [
          {
            label: text("settings.ingredients.changedByAI.clear"),
            symbol: "xmark" as const,
            onPress: () => {
              // Nothing left to check: the sheet would only say AI changed nothing.
              if (unsure.length === 0) router.back();
              void clear();
            },
          },
        ]
      : []),
  ];
  const title = text("settings.ingredients.changedByAI.title");

  if (changes.length === 0) {
    return (
      <Sheet name="ingredient-changes" title={title}>
        <SheetBody>
          <EmptyCard
            icon="sparkles-outline"
            placement="sheet"
            testID="ingredient-changes-empty"
            title={text("settings.ingredients.changedByAI.empty")}
          />
        </SheetBody>
      </Sheet>
    );
  }

  return (
    <Sheet
      confirm={
        answerAll
          ? {
              label: text("settings.ingredients.changedByAI.keepAll"),
              onPress: () => void keepAll(actionable),
            }
          : undefined
      }
      name="ingredient-changes"
      secondary={secondary}
      title={title}
    >
      <SheetList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item }) => {
          if (item.type === "heading") {
            return (
              <HeadingRow first={item.first}>
                <Section title={text(`settings.ingredients.changedByAI.${item.section}`)} />
              </HeadingRow>
            );
          }

          const change = item.item;
          const subject = change.ingredient
            ? ingredientDisplayName(change.ingredient, locale)
            : (change.from ?? "");
          const copy = changeCopy(change, locale);

          return (
            <CardSlice edge={edgeAt(item.index, item.count)}>
              <View className="gap-1.5 px-4 py-3" testID={`ingredient-change-${change.id}`}>
                {change.ingredient ? (
                  <Pressable
                    accessibilityRole="button"
                    testID={`ingredient-change-open-${change.id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/settings/ingredient",
                        params: { id: change.ingredient?.id },
                      })
                    }
                  >
                    <Text className="text-accent-text text-base font-medium">{subject}</Text>
                  </Pressable>
                ) : (
                  <Text className="text-foreground text-base font-medium">{subject}</Text>
                )}
                <Text className="text-muted text-sm">
                  {text(`settings.ingredients.${copy.key}`, copy.values)}
                </Text>
                {change.canAct ? (
                  <View className="flex-row gap-4 pt-1">
                    <Pressable
                      accessibilityRole="button"
                      testID={`ingredient-change-undo-${change.id}`}
                      onPress={() => void undo(change)}
                    >
                      <Text className="text-danger text-[15px] font-medium">
                        {text("settings.ingredients.changedByAI.undo")}
                      </Text>
                    </Pressable>
                    {isOpenChange(change) ? (
                      <Pressable
                        accessibilityRole="button"
                        testID={`ingredient-change-keep-${change.id}`}
                        onPress={() => void keep(change)}
                      >
                        <Text className="text-accent-text text-[15px] font-medium">
                          {text("settings.ingredients.changedByAI.keep")}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </CardSlice>
          );
        }}
        testID="ingredient-changes-list"
      />
    </Sheet>
  );
}
