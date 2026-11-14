import type { ComponentRef } from "react";
import React from "react";
import { View } from "react-native";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import { useRouter } from "expo-router";
import { Input, TextField } from "heroui-native";
import { useIntl } from "react-intl";

import { useNewCookbook } from "@norish/shared-react/recipes";

import { PickSheet } from "../components/pick-sheet";
import { recipePickList, SearchRecipes } from "../components/recipe-pick";

/**
 * New cookbook: a name and, under it, the recipes to start it with, then Create.
 */
export function NewCookbookScreen() {
  const intl = useIntl();
  const router = useRouter();
  const {
    title,
    setTitle,
    canCreate,
    create,
    input,
    setInput,
    recipes,
    isLoading,
    loadMore,
    selected,
    toggle,
  } = useNewCookbook();
  // The sheet opens on its field, so the keyboard rises with it.
  const fieldRef = useFocusOnMount<ComponentRef<typeof Input>>();
  const submit = () => {
    void create();
    router.back();
  };

  return (
    <PickSheet
      action={{
        label: intl.formatMessage({ id: "common.actions.create" }),
        icon: "add",
        testID: "new-cookbook-submit",
        onPress: canCreate ? submit : undefined,
      }}
      header={
        <View className="gap-2">
          <TextField>
            <Input
              ref={fieldRef}
              accessibilityLabel={intl.formatMessage({ id: "recipes.cookbooks.titleLabel" })}
              className="bg-default h-12 rounded-full px-4 text-base"
              placeholder={intl.formatMessage({ id: "recipes.cookbooks.titlePlaceholder" })}
              returnKeyType="done"
              testID="new-cookbook-title"
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={canCreate ? submit : undefined}
            />
          </TextField>
          <SearchRecipes value={input} onChange={setInput} />
        </View>
      }
      list={
        isLoading
          ? undefined
          : recipePickList({
              intl,
              recipes,
              emptyId: "recipes.cookbooks.noRecipesToAdd",
              selected,
              onToggle: toggle,
              onEndReached: loadMore,
            })
      }
      name="new-cookbook"
      subtitle={
        selected.length > 0
          ? intl.formatMessage({ id: "recipes.cookbooks.recipeCount" }, { count: selected.length })
          : undefined
      }
      title={intl.formatMessage({ id: "recipes.cookbooks.createTitle" })}
    />
  );
}
