"use client";

import { useState } from "react";
import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PickerEntry, PickerKind } from "@norish/shared-react/lists";
import { useEntryPicker } from "@norish/shared-react/lists";

/** The key of the "Create" row; an entry's id is a uuid, so it cannot collide. */
const CREATE_KEY = "__create__";

interface EntryComboBoxProps {
  kind: PickerKind;
  /** The recipe being edited, once it exists: its household's list is the one offered. */
  recipeId?: string;
  isSelected: (entry: PickerEntry) => boolean;
  onSelect: (entry: PickerEntry) => void;
  /** The field's accessible name. */
  label: string;
  placeholder?: string;
  /** How an entry reads in its row, when not by its name. */
  entryLabel?: (name: string) => string;
  /** Open on focus and list everything, for a short list; else only once something is typed. */
  opensOnFocus?: boolean;
  className?: string;
  inputClassName?: string;
  inputVariant?: "primary" | "secondary";
}

/**
 * Search a list as you type: the entries that match first, then a "Create 'x'" row when the
 * list has no entry of that name. Picking a row selects the entry; the Create row makes it first.
 */
export function EntryComboBox({
  kind,
  recipeId,
  isSelected,
  onSelect,
  label,
  placeholder,
  entryLabel,
  opensOnFocus = false,
  className,
  inputClassName,
  inputVariant = "secondary",
}: EntryComboBoxProps) {
  const t = useTranslations("recipes.picker");
  const [typed, setTyped] = useState("");
  // A combo box closes when its selection changes: a pick sets it for one render, then takes it
  // back and clears the field the pick filled with the row's text.
  const [picked, setPicked] = useState<string | null>(null);
  const done = (key: string) => {
    setPicked(key);
    setTimeout(() => {
      setPicked(null);
      setTyped("");
    }, 0);
  };
  const picker = useEntryPicker({
    kind,
    recipeId,
    typed,
    isSelected,
    onSelect: (entry) => {
      onSelect(entry);
      done(entry.id);
    },
  });
  const { offer } = picker;
  const items = [
    ...picker.matches.map((entry) => ({
      id: entry.id,
      text: entryLabel ? entryLabel(entry.name) : entry.name,
    })),
    ...(offer.kind === "create"
      ? [
          {
            id: CREATE_KEY,
            text: picker.isOffline
              ? t("createOffline", { name: offer.name })
              : t("create", { name: offer.name }),
          },
        ]
      : []),
  ];
  const problem =
    offer.kind === "tooLong"
      ? t("tooLong", { max: offer.max })
      : picker.createFailed && offer.kind === "create"
        ? t("createFailed", { name: offer.name })
        : null;
  const problemId = `${label}-problem`;

  return (
    <div className={className}>
      <ComboBox
        allowsEmptyCollection={offer.kind === "tooLong"}
        className="w-full"
        inputValue={typed}
        isInvalid={offer.kind === "tooLong"}
        items={items}
        menuTrigger={opensOnFocus ? "focus" : "input"}
        value={picked}
        variant={inputVariant}
        onChange={(key) => {
          // Escape and leaving the field commit "nothing": the typed text goes, nothing is made.
          if (key === null) {
            setTyped("");

            return;
          }

          if (key === CREATE_KEY) {
            void picker.createAndSelect();

            return;
          }

          const entry = picker.matches.find((candidate) => candidate.id === key);

          if (!entry) return;
          onSelect(entry);
          done(entry.id);
        }}
        onInputChange={setTyped}
      >
        <Label className="sr-only">{label}</Label>
        <Input
          aria-describedby={problem ? problemId : undefined}
          className={inputClassName}
          placeholder={placeholder}
          style={{ fontSize: "16px" }}
          variant={inputVariant}
        />
        <ComboBox.Popover>
          {/* Say why in the list itself: an open list hides the field below from a screen reader. */}
          <ListBox
            renderEmptyState={() => <p className="text-danger px-3 py-2 text-sm">{problem}</p>}
          >
            {(item: { id: string; text: string }) => (
              <ListBox.Item
                id={item.id}
                isDisabled={item.id === CREATE_KEY && picker.createDisabled}
                textValue={item.text}
              >
                {item.text}
              </ListBox.Item>
            )}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
      {problem ? (
        <p className="text-danger mt-1 text-sm" id={problemId} role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
