import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Input, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useCookbookMembership } from "@norish/shared-react/recipes";

import { CookbookCover } from "../components/cookbook-cover";
import { PickRow, pickRowClass } from "../components/pick-row";
import { PickSheet } from "../components/pick-sheet";

/** Add to cookbook: tick the cookbooks the recipe belongs in, or ask for a new one, then Save. */
export function AddToCookbookScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { recipeId, name } = useLocalSearchParams<{ recipeId: string; name?: string }>();
  const [foreground, muted, accentForeground] = useThemeColor([
    "foreground",
    "muted",
    "accent-foreground",
  ] as const);
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
      action={{
        label: intl.formatMessage({ id: "common.actions.save" }),
        icon: "checkmark",
        testID: "add-to-cookbook-save",
        onPress: isDirty ? () => void save(() => router.back()) : undefined,
      }}
      header={
        <View className="flex-row gap-2">
          <TextField className="flex-1">
            <Input
              accessibilityLabel={newLabel}
              className="bg-default h-12 rounded-full px-4 text-base"
              placeholder={newLabel}
              returnKeyType="done"
              testID="add-to-cookbook-new-title"
              value={newTitle}
              onChangeText={setNewTitle}
              onSubmitEditing={stageNew}
            />
          </TextField>
          <Pressable
            accessibilityLabel={newLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canStage }}
            className={`size-12 items-center justify-center rounded-full ${canStage ? "bg-accent" : "bg-default"}`}
            disabled={!canStage}
            testID="add-to-cookbook-new-add"
            onPress={stageNew}
          >
            <Ionicons color={canStage ? accentForeground : muted} name="add" size={22} />
          </Pressable>
        </View>
      }
      list={
        isLoading
          ? undefined
          : {
              items,
              empty: (
                <Text className="text-muted py-10 text-center text-base">
                  {intl.formatMessage({ id: "recipes.cookbooks.noneEditable" })}
                </Text>
              ),
              keyExtractor: (item) =>
                String(item.kind === "pending" ? item.entry.key : item.cookbook.id),
              renderRow: (item, position) =>
                item.kind === "pending" ? (
                  <View
                    className={pickRowClass(position)}
                    testID={`add-to-cookbook-pending-${item.entry.key}`}
                  >
                    <View className="bg-surface size-11 items-center justify-center rounded-xl">
                      <Ionicons color={muted} name="book-outline" size={20} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                        {item.entry.title}
                      </Text>
                      <Text className="text-muted text-[13px]">
                        {intl.formatMessage({ id: "recipes.cookbooks.willBeCreated" })}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel={intl.formatMessage({ id: "common.actions.remove" })}
                      accessibilityRole="button"
                      className="bg-surface size-8 items-center justify-center rounded-full"
                      testID={`add-to-cookbook-unstage-${item.entry.key}`}
                      onPress={() => unstage(item.entry.key)}
                    >
                      <Ionicons color={foreground} name="close" size={16} />
                    </Pressable>
                  </View>
                ) : (
                  <PickRow
                    media={
                      <CookbookCover
                        className="size-11 overflow-hidden rounded-xl"
                        cookbook={item.cookbook}
                        iconSize={20}
                        onSheet
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
      subtitle={name}
      title={intl.formatMessage({ id: "recipes.cookbooks.panelTitle" })}
    />
  );
}
