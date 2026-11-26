"use client";

import Panel from "@/components/Panel/Panel";
import { SkeletonRows } from "@/components/settings/settings-skeleton";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Note } from "@/components/shared/note";
import { RecipeLinks } from "@/components/shared/recipe-links";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PickerKind } from "@norish/shared-react/lists";
import { useEntryRecipes } from "@norish/shared-react/lists";

/** The content, mounted while the panel is open, so the recipes are read only then. */
function UsesContent({ kind, id, onClose }: { kind: PickerKind; id: string; onClose: () => void }) {
  const t = useTranslations("settings.content");
  const tActions = useTranslations("common.actions");
  const { recipes, loaded, failed, retry } = useEntryRecipes(kind, id);

  return (
    <>
      <Panel.Body data-testid="content-entry-uses" sections>
        {failed ? (
          <Note status="warning">
            {t("loadFailed")}
            <Button size="sm" variant="tertiary" onPress={retry}>
              {tActions("retry")}
            </Button>
          </Note>
        ) : null}
        {!loaded && !failed ? <SkeletonRows count={3} /> : null}
        {loaded && recipes.length === 0 ? <Note>{t("recipes", { count: 0 })}</Note> : null}
        {recipes.length > 0 ? <RecipeLinks recipes={recipes} onOpen={onClose} /> : null}
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton action="done" onPress={onClose}>
            {tActions("done")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </>
  );
}

/** The recipes carrying an entry, over its panel. */
export function EntryUsesPanel({
  kind,
  id,
  open,
  onClose,
}: {
  kind: PickerKind;
  id: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("settings.content");

  return (
    <Panel
      nested
      open={open}
      title={t("panel.usedBy")}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <UsesContent id={id} kind={kind} onClose={onClose} />
    </Panel>
  );
}
