"use client";

import type { Key } from "react";
import { Panel } from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { DateAndSlotFields } from "@/features/calendar/components/panels/edit-planned-recipe-panel";
import { Input, Label, TextField } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useTranslations } from "next-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { useCalendarMutations, usePlannedItemDraft } from "@norish/shared-react/calendar";
import { Slot } from "@norish/shared/contracts";

type EditNotePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: PlannedItemFromQuery;
};
/** A note's draft: Save writes its text, day and slot as one change, only what was touched. */
export function EditNotePanel({ open, onOpenChange, note }: EditNotePanelProps) {
  const { planNote, deleteItem, saveItem } = useCalendarMutations();
  const { draft, setTitle, setDate, setSlot, save } = usePlannedItemDraft(note, saveItem);
  const t = useTranslations("calendar.editNote");
  const tActions = useTranslations("common.actions");
  const title = draft.title.trim();
  const handleSave = () => {
    if (!title) return;
    save();
    onOpenChange(false);
  };
  const handleDelete = () => {
    deleteItem(note.id);
    onOpenChange(false);
  };
  const handleDuplicate = () => {
    if (!title) return;
    planNote(draft.date, draft.slot, title);
  };
  const handleSlotChange = (value: Key | null) => {
    if (value) {
      setSlot(value.toString() as Slot);
    }
  };
  return (
    <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
      <Panel.Body>
        <TextField value={draft.title} onChange={setTitle}>
          <Label>{t("noteLabel")}</Label>
          <Input
            placeholder={t("notePlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSave();
              }
            }}
          />
        </TextField>

        <DateAndSlotFields
          selectedDate={parseDate(draft.date)}
          selectedSlot={draft.slot}
          onSelectDate={(date) => setDate(date.toString())}
          onSelectSlot={handleSlotChange}
        />
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup
          start={
            <ActionButton action="delete" onPress={handleDelete}>
              {tActions("delete")}
            </ActionButton>
          }
        >
          <ActionButton action="duplicate" onPress={handleDuplicate}>
            {tActions("duplicate")}
          </ActionButton>
          <ActionButton action="save" onPress={handleSave}>
            {tActions("save")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}
