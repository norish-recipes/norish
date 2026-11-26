import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Card } from "@/components/card";
import { IconButton } from "@/components/icon-button";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { SliceHairline } from "@/components/slice-row";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { useText } from "@/lib/i18n/use-text";

import type { IngredientItem, Spelling } from "@norish/shared-react/ingredients";
import { useIngredientDraft, useIngredientSpellingsQuery } from "@norish/shared-react/ingredients";

type Draft = ReturnType<typeof useIngredientDraft>;

/** Every spelling a food goes by, as its own page of the food's sheet: tap one to move it, minus to
 * remove it (asking whether it names no food), plus in the header to add. All of it is the draft. */
export function FoodSpellingsStep({
  item,
  draft,
  onBack,
}: {
  item: IngredientItem;
  draft: Draft;
  onBack: () => void;
}) {
  const text = useText();
  const cancel = useCancelButton();
  const [adding, setAdding] = useState(false);
  // The server sends the viewer's and the household's spellings; the rest are read once asked for.
  const held = useIngredientSpellingsQuery(item.id);
  const aliases = draft.hiddenSpellings > 0 ? (held ?? item.aliases) : item.aliases;
  const askJunk = (spelling: Spelling) =>
    Alert.alert(
      text("settings.ingredients.junkTitle", { alias: spelling.text }),
      text("settings.ingredients.junkBody"),
      [
        cancel,
        {
          text: text("settings.ingredients.junkRemove"),
          onPress: () => draft.toggleRemoval(spelling, false),
        },
        {
          text: text("settings.ingredients.junkMark"),
          style: "destructive",
          onPress: () => draft.toggleRemoval(spelling, true),
        },
      ]
    );
  const rows = [
    ...aliases.map((spelling) => ({ key: spelling.id, name: spelling.text, spelling })),
    ...draft.added.map((added) => ({ key: `new-${added}`, name: added, spelling: null })),
  ];

  return (
    <Sheet
      back
      name="food-spellings"
      secondary={[
        {
          label: text("settings.ingredients.addAlias"),
          symbol: "plus",
          onPress: () => setAdding(true),
        },
      ]}
      title={text("settings.ingredients.spellingsSection")}
      onClose={onBack}
    >
      <SheetBody contentClassName="gap-4">
        {adding ? (
          <SheetInput
            autoCapitalize="none"
            placeholder={text("settings.ingredients.addAlias")}
            returnKeyType="done"
            testID="food-spelling-input"
            value={draft.alias}
            onChangeText={draft.setAlias}
            onSubmitEditing={draft.stageAlias}
          />
        ) : null}
        <Card>
          {rows.map(({ key, name, spelling }, index) => {
            const pending = spelling ? draft.removed.has(spelling.id) : false;
            const movable = spelling?.canRemove === true && !pending;

            return (
              <View
                key={key}
                className="min-h-[52px] flex-row items-center gap-3 px-4"
                testID={`food-spelling-${name}`}
              >
                <SliceHairline first={index === 0} />
                <Pressable
                  accessibilityRole={movable ? "button" : undefined}
                  className="min-w-0 flex-1 justify-center self-stretch"
                  disabled={!movable}
                  onPress={() =>
                    spelling &&
                    draft.setRelocation({ kind: "move", aliasId: spelling.id, text: spelling.text })
                  }
                >
                  <Text
                    className={`text-foreground text-base ${pending ? "line-through opacity-60" : ""}`}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </Pressable>
                {!spelling || spelling.canRemove ? (
                  <IconButton
                    icon={pending ? "arrow-undo-outline" : "remove-circle-outline"}
                    label={text(
                      pending
                        ? "settings.ingredients.keepAlias"
                        : "settings.ingredients.removeAlias",
                      { alias: name }
                    )}
                    small
                    testID={`food-spelling-remove-${name}`}
                    tone={pending ? "default" : "danger"}
                    onPress={() => {
                      if (!spelling) draft.unstage(name);
                      else if (pending) draft.toggleRemoval(spelling);
                      else askJunk(spelling);
                    }}
                  />
                ) : null}
              </View>
            );
          })}
        </Card>
      </SheetBody>
    </Sheet>
  );
}
