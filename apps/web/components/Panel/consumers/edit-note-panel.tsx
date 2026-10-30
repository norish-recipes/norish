"use client";

import type { DateValue } from "@internationalized/date";
import type { Key } from "react";
import { useState } from "react";
import { useCalendarContext } from "@/app/(app)/calendar/context";
import { DateAndSlotFields } from "@/components/Panel/consumers/edit-planned-recipe-panel";
import { Panel } from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Input, Label, TextField } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useTranslations } from "next-intl";

import { Slot } from "@norish/shared/contracts";

type EditNotePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  initialTitle: string;
  date: string;
  slot: Slot;
};
export function EditNotePanel({
  open,
  onOpenChange,
  noteId,
  initialTitle,
  date,
  slot,
}: EditNotePanelProps) {
  const { deletePlanned, moveItem, updateItem, planNote } = useCalendarContext();
  const [title, setTitle] = useState(initialTitle);
  const [selectedDate, setSelectedDate] = useState<DateValue>(() => parseDate(date));
  const [selectedSlot, setSelectedSlot] = useState<Slot>(slot);
  const [seededFrom, setSeededFrom] = useState({ open, initialTitle, date, slot });
  const t = useTranslations("calendar.editNote");
  const tActions = useTranslations("common.actions");
  if (
    seededFrom.open !== open ||
    seededFrom.initialTitle !== initialTitle ||
    seededFrom.date !== date ||
    seededFrom.slot !== slot
  ) {
    setSeededFrom({ open, initialTitle, date, slot });
    if (open) {
      setTitle(initialTitle);
      setSelectedDate(parseDate(date));
      setSelectedSlot(slot);
    }
  }
  const handleSave = () => {
    if (!title.trim()) return;
    const newDateStr = selectedDate.toString();
    const titleChanged = title.trim() !== initialTitle;
    const locationChanged = newDateStr !== date || selectedSlot !== slot;
    if (titleChanged) {
      updateItem(noteId, title.trim());
    }
    if (locationChanged) {
      moveItem(noteId, newDateStr, selectedSlot, 0);
    }
    onOpenChange(false);
  };
  const handleDelete = () => {
    deletePlanned(noteId);
    onOpenChange(false);
  };
  const handleDuplicate = () => {
    if (!title.trim()) return;
    planNote(selectedDate.toString(), selectedSlot, title.trim());
  };
  const handleSlotChange = (value: Key | null) => {
    if (value) {
      setSelectedSlot(value.toString() as Slot);
    }
  };
  return (
    <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
      <Panel.Body>
        <TextField value={title} onChange={setTitle}>
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
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          onSelectDate={setSelectedDate}
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
