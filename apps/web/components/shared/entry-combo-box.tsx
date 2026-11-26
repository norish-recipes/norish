"use client";

import { use, useEffect, useRef, useState } from "react";
import { Button, ComboBox, Input, Label, ListBox } from "@heroui/react";
import { useTranslations } from "next-intl";
import { ComboBoxStateContext } from "react-aria-components";

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
  /** Backspace in the empty field, for a field that holds chips. */
  onBackspaceEmpty?: () => void;
  className?: string;
  inputClassName?: string;
  inputVariant?: "primary" | "secondary";
}

/**
 * Opens the list once it has rows for the text in the focused field. React Aria opens only when
 * the text changes and its rows catch up a render later, so a paste into an empty list stayed shut.
 */
function OpenOnRows({ rows, typed }: { rows: number; typed: string }) {
  const state = use(ComboBoxStateContext);

  useEffect(() => {
    if (state?.isFocused && !state.isOpen && rows > 0 && typed.trim() !== "")
      state.open(null, "input");
  }, [state, rows, typed]);

  return null;
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
  onBackspaceEmpty,
  className,
  inputClassName,
  inputVariant = "secondary",
}: EntryComboBoxProps) {
  const t = useTranslations("recipes.picker");
  const tActions = useTranslations("common.actions");
  const [typed, setTyped] = useState("");
  const fieldRef = useRef<HTMLDivElement>(null);
  // A combo box closes when its selection changes, so a pick sets it for one render and then
  // takes it back, clearing the text the pick filled in.
  const [picked, setPicked] = useState<string | null>(null);
  const settle = (key: string) => {
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
      settle(entry.id);
    },
  });
  const { offer, problem } = picker;
  const items = [
    ...picker.matches.map((entry) => ({
      id: entry.id,
      text: entryLabel ? entryLabel(entry.name) : entry.name,
    })),
    ...(offer.kind === "create"
      ? [{ id: CREATE_KEY, text: t(picker.createLabelKey, { name: offer.name }) }]
      : []),
  ];
  const problemId = `${label}-problem`;

  return (
    <div ref={fieldRef} className={className}>
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
          // Leaving the field commits "nothing": the typed text goes. A list the page scrolled shut
          // commits it too, in a field still typed in, so the text stays and the list comes back.
          if (key === null) {
            if (!fieldRef.current?.contains(document.activeElement)) setTyped("");

            return;
          }

          if (key === CREATE_KEY) {
            void picker.createAndSelect();

            return;
          }

          const entry = picker.matches.find((candidate) => candidate.id === key);

          if (entry) picker.pick(entry);
        }}
        onInputChange={setTyped}
      >
        <OpenOnRows rows={items.length} typed={typed} />
        <Label className="sr-only">{label}</Label>
        <Input
          aria-describedby={problem ? problemId : undefined}
          className={inputClassName}
          placeholder={placeholder}
          style={{ fontSize: "16px" }}
          variant={inputVariant}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && typed === "") onBackspaceEmpty?.();
            if (event.key === "Escape") setTyped("");
          }}
        />
        <ComboBox.Popover>
          {/* Say why in the list itself: an open list hides the field below from a screen reader. */}
          <ListBox
            renderEmptyState={() => (
              <p className="text-danger px-3 py-2 text-sm">
                {problem ? t(problem.key, problem.values) : null}
              </p>
            )}
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
        <div className="text-danger mt-1 text-sm" id={problemId} role="alert">
          {t(problem.key, problem.values)}
          {problem.key === "loadFailed" ? (
            <Button className="ml-2" size="sm" variant="tertiary" onPress={picker.retryList}>
              {tActions("retry")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
