import React, { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { Card, CardRow } from "@/components/card";
import { EmptyCard } from "@/components/empty-card";
import { destructiveAction } from "@/components/modal-header";
import { FitSheet } from "@/components/sheet";
import { SheetFieldSkeleton } from "@/components/sheet-input";
import { SheetNote } from "@/components/sheet-note";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { useText } from "@/lib/i18n/use-text";
import { useRouter } from "expo-router";

import type { PickerKind } from "@norish/shared-react/lists";
import { deleteProblemCopy, problemCopy, useContentEntry } from "@norish/shared-react/lists";

import { EntrySheet } from "../components/entry-sheet";
import { useEntryRoute } from "../hooks/use-entry-route";

/** One entry of a list: rename it, merge it onto the entry its new name folds onto, delete it, or read it. */
export function ContentEntryScreen() {
  const { kind, id, intent } = useEntryRoute();

  return kind ? <EntryScreen id={id} intent={intent} kind={kind} /> : null;
}

function EntryScreen({ kind, id, intent }: { kind: PickerKind; id: string; intent?: "delete" }) {
  const text = useText();
  const router = useRouter();
  const cancel = useCancelButton();
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
      <FitSheet name="content-entry" title={text(`settings.content.panel.editTitle.${kind}`)}>
        {entry.failed ? (
          <EmptyCard
            action={{
              label: text("common.actions.retry"),
              icon: "refresh-outline",
              testID: "content-entry-retry",
              onPress: entry.retry,
            }}
            icon="alert-circle-outline"
            placement="sheet"
            testID="content-entry-failed"
            title={text("settings.content.loadFailed")}
          />
        ) : (
          <SheetFieldSkeleton />
        )}
      </FitSheet>
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
          text: text(`settings.content.delete.action.${kind}`),
          style: "destructive",
          onPress: async () => {
            if (await entry.remove()) done();
          },
        },
      ]
    );
  };

  return (
    <EntrySheet
      before={
        <>
          {detail?.note ? (
            <SheetNote locked={detail.note.locked}>
              {text(`settings.content.${detail.note.key}`)}
            </SheetNote>
          ) : null}
          {view?.target ? (
            <SheetNote>
              {text("settings.content.panel.merge", {
                target: view.target.name,
                name,
                count: view.moved,
              })}
            </SheetNote>
          ) : null}
        </>
      }
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
      field={{
        accessibilityLabel: text("settings.content.panel.name"),
        canSubmit: entry.canSave,
        editable,
        maxLength: view?.max,
        testID: "content-entry-name",
        value: entry.name,
        onChangeText: entry.setName,
        onClear: editable ? () => entry.setName("") : undefined,
        onSubmit: () => void save(),
      }}
      name="content-entry"
      offline={editable && entry.offline}
      problem={problem}
      secondary={
        editable
          ? [
              {
                ...destructiveAction(text(`settings.content.delete.action.${kind}`), confirmDelete),
                disabled: entry.offline || entry.pending || entry.deleteState === "counting",
              },
            ]
          : undefined
      }
      title={editable ? text(`settings.content.panel.editTitle.${kind}`) : name}
    >
      <AskOnce
        ask={confirmDelete}
        ready={intent === "delete" && editable && !entry.offline && entry.deleteState === "ready"}
      />
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
          onPress={() => router.push({ pathname: "/settings/content-uses", params: { kind, id } })}
        />
      </Card>
    </EntrySheet>
  );
}

/** Runs `ask` once, when `ready`: the long-press menu's Delete opens the sheet already asking. */
function AskOnce({ ready, ask }: { ready: boolean; ask: () => void }) {
  const askedRef = useRef(false);

  useEffect(() => {
    if (!ready || askedRef.current) return;
    askedRef.current = true;
    ask();
  }, [ready, ask]);

  return null;
}
