import React from "react";
import { AiChange } from "@/components/ai-change";
import { CardSlice } from "@/components/card-slice";
import { EmptyCard } from "@/components/empty-card";
import { PillButton } from "@/components/pill-button";
import { Section } from "@/components/section";
import { HeadingRow, sectionRows } from "@/components/section-rows";
import { FitSheet, Sheet, SheetList } from "@/components/sheet";
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
  // The sheet kit allows one secondary action in the header: Clear.
  const secondary =
    rest.length > 0
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
      : [];
  const title = text("settings.ingredients.changedByAI.title");

  if (changes.length === 0) {
    return (
      <FitSheet name="ingredient-changes" title={title}>
        <EmptyCard
          icon="sparkles-outline"
          placement="sheet"
          testID="ingredient-changes-empty"
          title={text("settings.ingredients.changedByAI.empty")}
        />
      </FitSheet>
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
        ListFooterComponent={
          answerAll ? (
            <PillButton
              centred
              icon="arrow-undo-outline"
              label={text("settings.ingredients.changedByAI.undoAll")}
              testID="ingredient-changes-undo-all"
              onPress={() => void undoAll(actionable)}
            />
          ) : undefined
        }
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
          const copy = changeCopy(change, locale);

          return (
            <CardSlice edge={edgeAt(item.index, item.count)}>
              <AiChange
                id={change.id}
                note={text(`settings.ingredients.${copy.key}`, copy.values)}
                subject={
                  change.ingredient
                    ? ingredientDisplayName(change.ingredient, locale)
                    : (change.from ?? "")
                }
                testID="ingredient-change"
                onKeep={change.canAct && isOpenChange(change) ? () => void keep(change) : undefined}
                onOpen={
                  change.ingredient
                    ? () =>
                        router.push({
                          pathname: "/settings/ingredient",
                          params: { id: change.ingredient?.id },
                        })
                    : undefined
                }
                onUndo={change.canAct ? () => void undo(change) : undefined}
              />
            </CardSlice>
          );
        }}
        testID="ingredient-changes-list"
      />
    </Sheet>
  );
}
