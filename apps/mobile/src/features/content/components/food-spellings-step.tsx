import React, { useState } from "react";
import { Alert } from "react-native";
import { CardSlice } from "@/components/card-slice";
import { CountRow } from "@/components/count-row";
import { IconButton } from "@/components/icon-button";
import { FitSheet } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { edgeAt } from "@/lib/card-edges";
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
    <FitSheet
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
      {rows.map(({ key, name, spelling }, index) => {
        const pending = spelling ? draft.removed.has(spelling.id) : false;
        const movable = spelling?.canRemove === true && !pending;

        return (
          <CardSlice key={key} edge={edgeAt(index, rows.length)}>
            <CountRow
              name={name}
              struck={pending}
              testID={`food-spelling-${name}`}
              trailing={
                !spelling || spelling.canRemove ? (
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
                ) : undefined
              }
              onPress={
                movable && spelling
                  ? () =>
                      draft.setRelocation({
                        kind: "move",
                        aliasId: spelling.id,
                        text: spelling.text,
                      })
                  : undefined
              }
            />
          </CardSlice>
        );
      })}
    </FitSheet>
  );
}
