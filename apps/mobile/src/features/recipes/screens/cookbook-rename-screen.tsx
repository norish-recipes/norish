import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useCookbookQuery, useCookbookTitleEdit } from "@norish/shared-react/recipes";

import { CookbookTitleSheet } from "../components/cookbook-title-sheet";

function RenameSheet({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const intl = useIntl();
  const router = useRouter();
  const { title, setTitle, isDirty, save } = useCookbookTitleEdit(cookbook);

  return (
    <CookbookTitleSheet
      canSubmit={isDirty}
      name="cookbook-rename"
      submitIcon="checkmark"
      submitLabelId="common.actions.save"
      title={intl.formatMessage({ id: "recipes.cookbooks.renameTitle" })}
      value={title}
      onChange={setTitle}
      onSubmit={() => {
        void save();
        router.back();
      }}
    />
  );
}

/** Rename cookbook: the field is a skeleton until the cookbook is read. */
export function CookbookRenameScreen() {
  const intl = useIntl();
  const { cookbookId } = useLocalSearchParams<{ cookbookId: string }>();
  const { cookbook } = useCookbookQuery(cookbookId ?? "");

  return cookbook ? (
    // Keyed by the cookbook, so a rename from elsewhere never discards what is typed.
    <RenameSheet key={cookbook.id} cookbook={cookbook} />
  ) : (
    <CookbookTitleSheet
      isLoading
      canSubmit={false}
      name="cookbook-rename"
      submitIcon="checkmark"
      submitLabelId="common.actions.save"
      title={intl.formatMessage({ id: "recipes.cookbooks.renameTitle" })}
    />
  );
}
