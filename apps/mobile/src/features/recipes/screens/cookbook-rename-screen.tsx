import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useCookbookEdit, useCookbookQuery } from "@norish/shared-react/recipes";

import { CookbookTitleSheet } from "../components/cookbook-title-sheet";

function RenameSheet({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const intl = useIntl();
  const router = useRouter();
  const { title, setTitle, isDirty, save } = useCookbookEdit(cookbook, { withMembers: false });

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

/** Rename cookbook: the field holds the title at once, and takes edits once the cookbook is read. */
export function CookbookRenameScreen() {
  const intl = useIntl();
  const { cookbookId, title } = useLocalSearchParams<{ cookbookId: string; title?: string }>();
  const { cookbook } = useCookbookQuery(cookbookId ?? "");

  return cookbook ? (
    // A rename from elsewhere starts the staged title again from the new one.
    <RenameSheet key={cookbook.title} cookbook={cookbook} />
  ) : (
    <CookbookTitleSheet
      isLoading
      canSubmit={false}
      name="cookbook-rename"
      submitIcon="checkmark"
      submitLabelId="common.actions.save"
      title={intl.formatMessage({ id: "recipes.cookbooks.renameTitle" })}
      value={title ?? ""}
      onChange={() => {}}
      onSubmit={() => {}}
    />
  );
}
