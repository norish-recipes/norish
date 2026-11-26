import React from "react";
import { Card, CardRow } from "@/components/card";
import { ChoiceCard } from "@/components/choice-card";
import { EmptyCard } from "@/components/empty-card";
import { Section } from "@/components/section";
import { useText } from "@/lib/i18n/use-text";
import { useRouter } from "expo-router";

import type { PickerKind } from "@norish/shared-react/lists";
import { problemCopy, useContentAdd } from "@norish/shared-react/lists";

import { EntrySheet } from "../components/entry-sheet";
import { useEntryRoute } from "../hooks/use-entry-route";

/**
 * Add to a list: the entries the name already matches are listed as you type, and Add is there
 * only when none folds alike. A name the server finds already there opens that entry instead.
 */
export function ContentAddScreen() {
  const { kind } = useEntryRoute();

  return kind ? <AddScreen kind={kind} /> : null;
}

function AddScreen({ kind }: { kind: PickerKind }) {
  const text = useText();
  const router = useRouter();
  const add = useContentAdd(kind);
  const copy = problemCopy(add.problem, add.max);
  const openEntry = (id: string) =>
    router.replace({ pathname: "/settings/content-entry", params: { kind, id } });
  const submit = async () => {
    const added = await add.add();

    if (!added) return;
    if (added.created) router.back();
    else openEntry(added.entry.id);
  };

  return (
    <EntrySheet
      confirm={{
        label: text("common.actions.add"),
        disabled: !add.canAdd,
        onPress: submit,
      }}
      field={{
        accessibilityLabel: text("settings.content.panel.name"),
        autoCapitalize: "none",
        canSubmit: add.canAdd,
        testID: "content-add-name",
        value: add.typed,
        onChangeText: add.setTyped,
        onClear: () => add.setTyped(""),
        onSubmit: () => void submit(),
      }}
      name="content-add"
      offline={add.offline}
      problem={add.problem === "loadFailed" ? null : copy}
      title={text(`settings.content.panel.addTitle.${kind}`)}
    >
      {add.problem === "loadFailed" ? (
        <EmptyCard
          action={{
            label: text("common.actions.retry"),
            icon: "refresh-outline",
            testID: "content-add-retry",
            onPress: () => void add.retry(),
          }}
          icon="alert-circle-outline"
          placement="sheet"
          testID="content-add-failed"
          title={text("settings.content.loadFailed")}
        />
      ) : null}
      {add.canAddForServer ? (
        <Section title={text("settings.content.panel.addTo")}>
          <ChoiceCard
            options={[
              {
                id: "household",
                label: text("settings.content.panel.toHousehold"),
                testID: "content-add-household",
              },
              {
                id: "server",
                label: text("settings.content.panel.toServer"),
                testID: "content-add-server",
              },
            ]}
            selected={add.forServer ? "server" : "household"}
            onPick={(id) => add.setForServer(id === "server")}
          />
        </Section>
      ) : null}
      {add.matches.length > 0 ? (
        <Section title={text(`settings.content.panel.already.${kind}`)}>
          <Card>
            {add.matches.map((match, index) => (
              <CardRow
                key={match.id}
                first={index === 0}
                label={match.name}
                testID="content-add-match"
                value={text("settings.content.recipes", { count: match.recipeCount })}
                onPress={() => openEntry(match.id)}
              />
            ))}
          </Card>
        </Section>
      ) : null}
    </EntrySheet>
  );
}
