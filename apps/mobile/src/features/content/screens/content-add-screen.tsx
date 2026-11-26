import React from "react";
import { View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { EmptyCard } from "@/components/empty-card";
import { ListHeading } from "@/components/list-heading";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { SheetNote } from "@/components/sheet-note";
import { useTokenColor } from "@/hooks/use-token-color";
import { useText } from "@/lib/i18n/use-text";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { PickerKind } from "@norish/shared-react/lists";
import { problemCopy, useContentAdd } from "@norish/shared-react/lists";

/**
 * Add to a list: the entries the name already matches are listed as you type, and Add is there
 * only when none folds alike. A name the server finds already there opens that entry instead.
 */
export function ContentAddScreen() {
  const text = useText();
  const router = useRouter();
  const accent = useTokenColor("accent-text");
  const { kind } = useLocalSearchParams<{ kind: PickerKind }>();
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
  const choice = (server: boolean, label: string) => (
    <CardRow
      chevron={false}
      first={!server}
      label={label}
      selected={add.forServer === server}
      testID={server ? "content-add-server" : "content-add-household"}
      onPress={() => add.setForServer(server)}
    >
      {add.forServer === server ? <Ionicons color={accent} name="checkmark" size={20} /> : null}
    </CardRow>
  );

  return (
    <Sheet
      confirm={{
        label: text("common.actions.add"),
        disabled: !add.canAdd,
        onPress: submit,
      }}
      name="content-add"
      title={text(`settings.content.panel.addTitle.${kind}`)}
    >
      <SheetBody contentClassName="gap-4">
        <SheetInput
          accessibilityLabel={text("settings.content.panel.name")}
          autoCapitalize="none"
          returnKeyType="done"
          testID="content-add-name"
          value={add.typed}
          onChangeText={add.setTyped}
          onClear={() => add.setTyped("")}
          onSubmitEditing={() => {
            if (add.canAdd) void submit();
          }}
        />
        {copy && add.problem !== "loadFailed" ? (
          <SheetNote tone="problem">{text(`settings.content.${copy.key}`, copy.values)}</SheetNote>
        ) : null}
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
          <View>
            <ListHeading title={text("settings.content.panel.addTo")} />
            <Card>
              {choice(false, text("settings.content.panel.toHousehold"))}
              {choice(true, text("settings.content.panel.toServer"))}
            </Card>
          </View>
        ) : null}
        {add.matches.length > 0 ? (
          <View>
            <ListHeading title={text(`settings.content.panel.already.${kind}`)} />
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
          </View>
        ) : null}
        {add.offline ? <SheetNote>{text("settings.content.offline")}</SheetNote> : null}
      </SheetBody>
    </Sheet>
  );
}
