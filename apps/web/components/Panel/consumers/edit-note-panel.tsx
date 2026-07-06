"use client";

import type { Key } from "react";
import { useEffect, useState } from "react";
import { useCalendarContext } from "@/app/(app)/calendar/context";
import { Panel } from "@/components/Panel/Panel";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { DatePicker, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useTranslations } from "next-intl";

import { Slot } from "@norish/shared/contracts";

const SLOTS: Slot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
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
  const [selectedDate, setSelectedDate] = useState(parseDate(date));
  const [selectedSlot, setSelectedSlot] = useState<Slot>(slot);
  const t = useTranslations("calendar.editNote");
  const tSlots = useTranslations("common.slots");
  const tActions = useTranslations("common.actions");
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setSelectedDate(parseDate(date));
      setSelectedSlot(slot);
    }
  }, [open, initialTitle, date, slot]);
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

        <div className="flex gap-3">
          <DatePicker
            isRequired
            className="flex-1"
            label={t("date")}
            value={selectedDate}
            onChange={(d) => d && setSelectedDate(d)}
          />
          <Select
            className="flex-1"
            selectedKey={selectedSlot}
            variant="secondary"
            onSelectionChange={handleSlotChange}
          >
            <Label>{t("slot")}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {SLOTS.map((s) => (
                  <ListBox.Item key={s} id={s} textValue={tSlots(s.toLowerCase())}>
                    {tSlots(s.toLowerCase())}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup>
          <IconActionButton action="delete" label={tActions("delete")} onPress={handleDelete} />
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
