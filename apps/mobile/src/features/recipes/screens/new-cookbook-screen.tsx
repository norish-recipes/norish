import React, { useState } from "react";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useCookbooksMutations } from "@norish/shared-react/recipes";

import { CookbookTitleSheet } from "../components/cookbook-title-sheet";

/** New cookbook: a title, then Create; the new cookbook appears at the top of the Cookbooks lens. */
export function NewCookbookScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { createCookbook } = useCookbooksMutations();
  const [title, setTitle] = useState("");
  const trimmed = title.trim();

  return (
    <CookbookTitleSheet
      canSubmit={trimmed.length > 0}
      name="new-cookbook"
      submitIcon="add"
      submitLabelId="common.actions.create"
      title={intl.formatMessage({ id: "recipes.cookbooks.createTitle" })}
      value={title}
      onChange={setTitle}
      onSubmit={() => {
        void createCookbook({ title: trimmed });
        router.back();
      }}
    />
  );
}
