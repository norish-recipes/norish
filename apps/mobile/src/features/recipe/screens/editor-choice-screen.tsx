import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Checkmark } from "@/components/checkmark";
import { Sheet, SheetList } from "@/components/sheet";
import { SheetSearchField } from "@/components/sheet-search-field";
import { SliceHairline, sliceRowClass } from "@/components/slice-row";
import { useText } from "@/lib/i18n/use-text";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useEntryPicker } from "@norish/shared-react/lists";

import type { Choice, ChoiceList, ChoiceParams } from "../components/editor/choice-request";
import { parseMultiple, takeChoice } from "../components/editor/choice-request";

interface SheetProps {
  name: string;
  title: string;
  query: string;
  onQueryChange: (query: string) => void;
  selected: string[];
  pick: (key: string) => void;
}

/** The sheet's rows in a card under a search field; `create` is the row that makes a new entry. */
function ChoiceSheet({
  name,
  title,
  query,
  onQueryChange,
  selected,
  pick,
  rows,
  create,
  notice,
}: SheetProps & {
  rows: Choice[];
  create?: { label: string; disabled: boolean; onPress: () => void };
  /** Why a typed name is not offered, or why making it failed. */
  notice?: string;
}) {
  const intl = useIntl();
  const data: (Choice | "create")[] = create ? [...rows, "create"] : rows;

  return (
    <Sheet name={name} title={title}>
      <SheetList
        ListHeaderComponent={
          <View className="pb-3">
            <SheetSearchField
              label={intl.formatMessage({ id: "common.actions.search" })}
              testID={`${name}-search`}
              value={query}
              onChange={onQueryChange}
            />
            {notice ? (
              <Text className="text-danger px-1 pt-2 text-[13px] font-medium">{notice}</Text>
            ) : null}
          </View>
        }
        data={data}
        keyExtractor={(choice) => (choice === "create" ? "create" : choice.key)}
        renderItem={({ item, index }) => {
          const position = { first: index === 0, last: index === data.length - 1 };

          if (item === "create") {
            return (
              <Pressable
                accessibilityLabel={create?.label}
                accessibilityRole="button"
                accessibilityState={{ disabled: create?.disabled }}
                className={`${sliceRowClass(position)} justify-between ${create?.disabled ? "opacity-50" : ""}`}
                disabled={create?.disabled}
                testID={`${name}-create`}
                onPress={create?.onPress}
              >
                <SliceHairline first={position.first} />
                <Text className="text-foreground flex-1 text-base">{create?.label}</Text>
              </Pressable>
            );
          }

          const ticked = selected.includes(item.key);

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: ticked }}
              className={`${sliceRowClass(position)} justify-between`}
              testID={`${name}-${item.key}`}
              onPress={() => pick(item.key)}
            >
              <SliceHairline first={position.first} />
              <Text className="text-foreground flex-1 text-base">{item.label}</Text>
              {ticked ? <Checkmark /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

/** A sheet over fixed choices, such as the countries. */
function FixedChoiceSheet({ choices, ...sheet }: SheetProps & { choices: Choice[] }) {
  const needle = sheet.query.trim().toLowerCase();
  const rows = needle
    ? choices.filter((choice) => choice.label.toLowerCase().includes(needle))
    : choices;

  return <ChoiceSheet {...sheet} rows={rows} />;
}

/** A sheet over a household list: the entries matching the search, then its "Create" row. */
function ListChoiceSheet({ list, ...sheet }: SheetProps & { list: ChoiceList }) {
  const text = useText();
  const picker = useEntryPicker({
    ...list,
    typed: sheet.query,
    // The sheet ticks and unticks its own, so a chosen entry stays in the list.
    isSelected: () => false,
    onSelect: (entry) => {
      sheet.pick(entry.id);
      sheet.onQueryChange("");
    },
  });
  const { offer } = picker;
  const rows = picker.matches.map((entry) => ({ key: entry.id, label: entry.name }));
  const create =
    offer.kind === "create"
      ? {
          label: picker.isOffline
            ? text("recipes.picker.createOffline", { name: offer.name })
            : text("recipes.picker.create", { name: offer.name }),
          disabled: picker.createDisabled,
          onPress: () => void picker.createAndSelect(),
        }
      : undefined;
  const notice =
    offer.kind === "tooLong"
      ? text("recipes.picker.tooLong", { max: offer.max })
      : picker.createFailed && offer.kind === "create"
        ? text("recipes.picker.createFailed", { name: offer.name })
        : undefined;

  return <ChoiceSheet {...sheet} create={create} notice={notice} rows={rows} />;
}

/** A searchable list over the editor, for its country and cuisines: its name, title and mode from the route, the rest from `requestChoice`. */
export function EditorChoiceScreen() {
  const router = useRouter();
  const {
    name,
    title,
    multiple: multipleParam,
  } = useLocalSearchParams<Pick<ChoiceParams, "name" | "title"> & { multiple?: string }>();
  const multiple = parseMultiple(multipleParam);
  const [request] = useState(takeChoice);
  const [selected, setSelected] = useState(request?.selected ?? []);
  const [query, setQuery] = useState("");

  // A relaunch restores the route without the request that opened it.
  useEffect(() => {
    if (!request) router.back();
  }, [request, router]);

  if (!request) return null;

  const pick = (key: string) => {
    const ticked = selected.includes(key);

    if (!multiple) {
      request.onChange(ticked ? [] : [key]);
      router.back();

      return;
    }
    const next = ticked ? selected.filter((candidate) => candidate !== key) : [...selected, key];

    setSelected(next);
    request.onChange(next);
  };
  const sheet = { name, title, query, onQueryChange: setQuery, selected, pick };

  return request.list ? (
    <ListChoiceSheet {...sheet} list={request.list} />
  ) : (
    <FixedChoiceSheet {...sheet} choices={request.choices} />
  );
}
