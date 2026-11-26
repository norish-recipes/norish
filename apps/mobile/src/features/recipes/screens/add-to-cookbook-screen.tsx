import React from "react";
import { View } from "react-native";
import { EmptyCard } from "@/components/empty-card";
import { IconButton } from "@/components/icon-button";
import { SheetInput } from "@/components/sheet-input";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useCookbookMembership } from "@norish/shared-react/recipes";

import { CookbookCover } from "../components/cookbook-cover";
import { PickRow } from "../components/pick-row";
import { PickSheet } from "../components/pick-sheet";

/** Add to cookbook: tick the cookbooks the recipe belongs in, or ask for a new one, then Save. */
export function AddToCookbookScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const [muted] = useThemeColor(["muted"] as const);
  const {
    cookbooks,
    isLoading,
    isMember,
    toggle,
    newTitle,
    setNewTitle,
    pending,
    stageNew,
    unstage,
    isDirty,
    save,
  } = useCookbookMembership({ recipeIds: recipeId ? [recipeId] : [] });
  const newLabel = intl.formatMessage({ id: "recipes.cookbooks.newWithRecipe" });
  const canStage = newTitle.trim().length > 0;

  const items = [
    ...pending.map((entry) => ({ kind: "pending" as const, entry })),
    ...cookbooks.map((cookbook) => ({ kind: "cookbook" as const, cookbook })),
  ];

  return (
    <PickSheet
      actions={{
        confirm: {
          label: intl.formatMessage({ id: "common.actions.save" }),
          onPress: isDirty ? () => save(() => router.back()) : undefined,
        },
      }}
      header={
        <View className="flex-row gap-2">
          <TextField className="flex-1">
            <SheetInput
              accessibilityLabel={newLabel}
              placeholder={newLabel}
              returnKeyType="done"
              testID="add-to-cookbook-new-title"
              value={newTitle}
              onChangeText={setNewTitle}
              onSubmitEditing={stageNew}
            />
          </TextField>
          <IconButton
            disabled={!canStage}
            icon="add"
            label={newLabel}
            testID="add-to-cookbook-new-add"
            onPress={stageNew}
          />
        </View>
      }
      list={
        isLoading
          ? undefined
          : {
              items,
              empty: (
                <EmptyCard
                  icon="book-outline"
                  placement="sheet"
                  testID="add-to-cookbook-none"
                  title={intl.formatMessage({ id: "recipes.cookbooks.noneEditable" })}
                />
              ),
              keyExtractor: (item) =>
                String(item.kind === "pending" ? item.entry.key : item.cookbook.id),
              renderRow: (item, position) =>
                item.kind === "pending" ? (
                  <PickRow
                    media={
                      <View className="bg-thumb size-10 items-center justify-center rounded-xl">
                        <Ionicons color={muted} name="book-outline" size={20} />
                      </View>
                    }
                    position={position}
                    subtitle={intl.formatMessage({ id: "recipes.cookbooks.willBeCreated" })}
                    testID={`add-to-cookbook-pending-${item.entry.key}`}
                    title={item.entry.title}
                    trailing={
                      <IconButton
                        icon="close"
                        label={intl.formatMessage({ id: "common.actions.remove" })}
                        testID={`add-to-cookbook-unstage-${item.entry.key}`}
                        onPress={() => unstage(item.entry.key)}
                      />
                    }
                  />
                ) : (
                  <PickRow
                    media={
                      <CookbookCover
                        className="size-10 overflow-hidden rounded-xl"
                        cookbook={item.cookbook}
                        iconSize={20}
                      />
                    }
                    position={position}
                    selected={isMember(item.cookbook.id)}
                    subtitle={intl.formatMessage(
                      { id: "recipes.cookbooks.recipeCount" },
                      { count: item.cookbook.memberCount }
                    )}
                    testID={`add-to-cookbook-row-${item.cookbook.id}`}
                    title={item.cookbook.title}
                    onToggle={() => toggle(item.cookbook.id, !isMember(item.cookbook.id))}
                  />
                ),
            }
      }
      name="add-to-cookbook"
      title={intl.formatMessage({ id: "recipes.cookbooks.panelTitle" })}
    />
  );
}
