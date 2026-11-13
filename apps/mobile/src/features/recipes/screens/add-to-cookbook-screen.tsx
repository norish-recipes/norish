import React from "react";
import { Pressable, Text, View } from "react-native";
import { Sheet, SheetScrollView } from "@/components/sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Input, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useCookbookMembership } from "@norish/shared-react/recipes";

import { CookbookCover } from "../components/cookbook-cover";
import { PickRow, pickRowClass, PickRowSkeleton } from "../components/pick-row";

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
  const total = pending.length + cookbooks.length;

  return (
    <Sheet
      actions={
        <Button
          className="h-[50px] rounded-full"
          isDisabled={!isDirty}
          testID="add-to-cookbook-save"
          variant="primary"
          onPress={() => void save(() => router.back())}
        >
          <Ionicons color={accentForeground} name="checkmark" size={20} />
          <Button.Label className="text-base font-semibold">
            {intl.formatMessage({ id: "common.actions.save" })}
          </Button.Label>
        </Button>
      }
      name="add-to-cookbook"
      subtitle={name}
      title={intl.formatMessage({ id: "recipes.cookbooks.panelTitle" })}
    >
      <SheetScrollView contentClassName="gap-3">
        <View className="flex-row gap-2">
          <TextField className="flex-1">
            <Input
              accessibilityLabel={newLabel}
              className="h-12 rounded-full px-4 text-base"
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
        {isLoading ? (
          <View testID="add-to-cookbook-skeleton">
            {[0, 1, 2].map((index) => (
              <PickRowSkeleton key={index} position={{ first: index === 0, last: index === 2 }} />
            ))}
          </View>
        ) : total === 0 ? (
          <Text className="text-muted py-10 text-center text-base">
            {intl.formatMessage({ id: "recipes.cookbooks.noneEditable" })}
          </Text>
        ) : (
          <View testID="add-to-cookbook-list">
            {pending.map((entry, index) => (
              <View
                key={entry.key}
                className={pickRowClass({
                  first: index === 0,
                  last: cookbooks.length === 0 && index === pending.length - 1,
                })}
                testID={`add-to-cookbook-pending-${entry.key}`}
              >
                <View className="bg-default size-11 items-center justify-center rounded-xl">
                  <Ionicons color={muted} name="book-outline" size={20} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text className="text-muted text-[13px]">
                    {intl.formatMessage({ id: "recipes.cookbooks.willBeCreated" })}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={intl.formatMessage({ id: "common.actions.remove" })}
                  accessibilityRole="button"
                  className="bg-default size-8 items-center justify-center rounded-full"
                  testID={`add-to-cookbook-unstage-${entry.key}`}
                  onPress={() => unstage(entry.key)}
                >
                  <Ionicons color={foreground} name="close" size={16} />
                </Pressable>
              </View>
            ))}
            {cookbooks.map((cookbook, index) => (
              <PickRow
                key={cookbook.id}
                media={
                  <CookbookCover
                    className="size-11 overflow-hidden rounded-xl"
                    cookbook={cookbook}
                    iconSize={20}
                  />
                }
                position={{
                  first: pending.length === 0 && index === 0,
                  last: index === cookbooks.length - 1,
                }}
                selected={isMember(cookbook.id)}
                subtitle={intl.formatMessage(
                  { id: "recipes.cookbooks.recipeCount" },
                  { count: cookbook.memberCount }
                )}
                testID={`add-to-cookbook-row-${cookbook.id}`}
                title={cookbook.title}
                onToggle={() => toggle(cookbook.id, !isMember(cookbook.id))}
              />
            ))}
          </View>
        )}
      </SheetScrollView>
    </Sheet>
  );
}
