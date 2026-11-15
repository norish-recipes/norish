import type { ComponentRef } from "react";
import React from "react";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import { useRouter } from "expo-router";
import { Input, TextField } from "heroui-native";
import { useIntl } from "react-intl";

import { useNewCookbook } from "@norish/shared-react/recipes";

import { RecipePickSheet } from "../components/recipe-pick";

/** New cookbook: a name and the recipes to start it with, then Create. */
export function NewCookbookScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { title, setTitle, canCreate, create, ...pick } = useNewCookbook();
  // The sheet opens on its field, so the keyboard rises with it.
  const fieldRef = useFocusOnMount<ComponentRef<typeof Input>>();
  const submit = () => {
    void create();
    router.back();
  };

  return (
    <RecipePickSheet
      action={{
        label: intl.formatMessage({ id: "common.actions.create" }),
        icon: "add",
        testID: "new-cookbook-submit",
        onPress: canCreate ? submit : undefined,
      }}
      emptyId="recipes.cookbooks.noRecipesToAdd"
      name="new-cookbook"
      pick={pick}
      subtitle={
        pick.selected.length > 0
          ? intl.formatMessage(
              { id: "recipes.cookbooks.recipeCount" },
              { count: pick.selected.length }
            )
          : undefined
      }
      title={intl.formatMessage({ id: "recipes.cookbooks.createTitle" })}
    >
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
    </RecipePickSheet>
  );
}
