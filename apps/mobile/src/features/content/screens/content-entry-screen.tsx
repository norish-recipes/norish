import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Card, CardRow } from "@/components/card";
import { destructiveAction } from "@/components/modal-header";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetFieldSkeleton, SheetInput } from "@/components/sheet-input";
import { SheetNote } from "@/components/sheet-note";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { useText } from "@/lib/i18n/use-text";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { PickerKind } from "@norish/shared-react/lists";
import { deleteProblemCopy, problemCopy, useContentEntry } from "@norish/shared-react/lists";

/** One entry of a list: rename it, merge it onto the entry its new name folds onto, delete it, or read it. */
export function ContentEntryScreen() {
  const text = useText();
  const router = useRouter();
  const cancel = useCancelButton();
  const { kind, id } = useLocalSearchParams<{ kind: PickerKind; id: string }>();
  const entry = useContentEntry(kind, id);
  const { view, detail } = entry;
  const editable = detail?.access === "edit";
  // A save or delete closes the sheet itself; the lists then drop the entry and must not close it again.
  const [closing, setClosing] = useState(false);
  const problem = problemCopy(entry.problem, view?.max);
  const deleteProblem = deleteProblemCopy(entry.deleteProblem);

  // Closed once a housemate deletes the entry.
  useEffect(() => {
    if (entry.gone && !closing) router.back();
  }, [entry.gone, closing, router]);

  if (!entry.entry) {
    return (
      <Sheet name="content-entry" title={text(`settings.content.panel.editTitle.${kind}`)}>
        <SheetBody>
          <SheetFieldSkeleton />
        </SheetBody>
      </Sheet>
    );
  }

  const name = entry.entry.name;
  const done = () => {
    setClosing(true);
    router.back();
  };
  const save = async () => {
    if (await entry.save()) done();
  };
  const confirmDelete = () => {
    entry.resetDelete();

    if (entry.deleteState === "countFailed") {
      entry.retryCount();

      return;
    }
    if (!entry.deleteImpact) return;

    Alert.alert(
      text("settings.content.delete.title", { name }),
      text(
        entry.deleteImpact.scope === "server"
          ? "settings.content.delete.bodyServer"
          : "settings.content.delete.body",
        { count: entry.deleteImpact.recipes }
      ),
      [
        cancel,
        {
          text: text("common.actions.delete"),
          style: "destructive",
          onPress: async () => {
            if (await entry.remove()) done();
          },
        },
      ]
    );
  };

  return (
    <Sheet
      confirm={
        editable
          ? {
              label:
                view?.action === "merge"
                  ? text("settings.content.panel.mergeAction")
                  : text("common.actions.save"),
              disabled: !entry.canSave,
              onPress: save,
            }
          : undefined
      }
      name="content-entry"
      secondary={
        editable
          ? [
              {
                ...destructiveAction(text("common.actions.delete"), confirmDelete),
                disabled: entry.offline || entry.pending || entry.deleteState === "counting",
              },
            ]
          : undefined
      }
      title={editable ? text(`settings.content.panel.editTitle.${kind}`) : name}
    >
      <SheetBody>
        <SheetInput
          accessibilityLabel={text("settings.content.panel.name")}
          editable={editable}
          maxLength={view?.max}
          returnKeyType="done"
          testID="content-entry-name"
          value={entry.name}
          onChangeText={entry.setName}
          onClear={editable ? () => entry.setName("") : undefined}
          onSubmitEditing={() => {
            if (entry.canSave) void save();
          }}
        />
        {detail?.note ? (
          <SheetNote locked={detail.note.locked}>
            {text(`settings.content.${detail.note.key}`)}
          </SheetNote>
        ) : null}
        {view?.target ? (
          <SheetNote tone="accent">
            {text("settings.content.panel.merge", {
              target: view.target.name,
              name,
              count: view.moved,
            })}
          </SheetNote>
        ) : null}
        {problem ? (
          <SheetNote tone="problem">
            {text(`settings.content.${problem.key}`, problem.values)}
          </SheetNote>
        ) : null}
        {deleteProblem ? (
          <SheetNote tone="problem">{text(`settings.content.${deleteProblem.key}`)}</SheetNote>
        ) : null}
        {entry.deleteState === "countFailed" ? (
          <SheetNote tone="problem">{text("settings.content.delete.countFailed")}</SheetNote>
        ) : null}
        <Card>
          <CardRow
            first
            label={text("settings.content.panel.usedBy")}
            testID="content-entry-used"
            value={text(`settings.content.${detail?.usedKey ?? "recipes"}`, {
              count: entry.entry.recipeCount,
            })}
            onPress={() =>
              router.push({ pathname: "/settings/content-uses", params: { kind, id } })
            }
          />
        </Card>
        {editable && entry.offline ? (
          <SheetNote>{text("settings.content.offline")}</SheetNote>
        ) : null}
      </SheetBody>
    </Sheet>
  );
}
