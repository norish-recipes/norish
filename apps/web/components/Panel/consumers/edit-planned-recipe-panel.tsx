"use client";

import type { DateValue } from "@internationalized/date";
import type { Key } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCalendarContext } from "@/app/(app)/calendar/context";
import { PlannedItemThumbnail } from "@/components/calendar/planned-item-thumbnail";
import { Panel } from "@/components/Panel/Panel";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";
import { Calendar, DateField, DatePicker, Label, ListBox, Select } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useTranslations } from "next-intl";

import { Slot } from "@norish/shared/contracts";

const SLOTS: Slot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
type EditPlannedRecipePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  recipeName: string;
  recipeImage: string | null;
  recipeId: string;
  date: string;
  slot: Slot;
};
export function EditPlannedRecipePanel({
  open,
  onOpenChange,
  itemId,
  recipeName,
  recipeImage,
  recipeId,
  date,
  slot,
}: EditPlannedRecipePanelProps) {
  const { deletePlanned, moveItem, planMeal } = useCalendarContext();
  const [selectedDate, setSelectedDate] = useState<DateValue>(parseDate(date));
  const [selectedSlot, setSelectedSlot] = useState<Slot>(slot);
  const t = useTranslations("calendar.editPlannedRecipe");
  const tSlots = useTranslations("common.slots");
  const tActions = useTranslations("common.actions");
  const tTimeline = useTranslations("calendar.timeline");
  useEffect(() => {
    if (open) {
      setSelectedDate(parseDate(date));
      setSelectedSlot(slot);
    }
  }, [open, date, slot]);
  const handleSave = () => {
    const newDateStr = selectedDate.toString();
    const locationChanged = newDateStr !== date || selectedSlot !== slot;
    if (locationChanged) {
      moveItem(itemId, newDateStr, selectedSlot, 0);
    }
    onOpenChange(false);
  };
  const handleDelete = () => {
    deletePlanned(itemId);
    onOpenChange(false);
  };
  const handleDuplicate = () => {
    planMeal(selectedDate.toString(), selectedSlot, recipeId);
  };
  const handleSlotChange = (value: Key | null) => {
    if (value) {
      setSelectedSlot(value.toString() as Slot);
    }
  };
  return (
    <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
      <Panel.Body className="gap-5">
        {/* Recipe preview */}
        <Link
          className="focus-visible:ring-accent group flex items-center gap-3 rounded-xl p-2 outline-none focus-visible:ring-2"
          href={`/recipes/${recipeId}`}
          onClick={() => onOpenChange(false)}
        >
          <PlannedItemThumbnail alt={recipeName} image={recipeImage} itemType="recipe" size="md" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-foreground truncate text-base font-medium">{recipeName}</span>
            <span className="text-accent flex items-center gap-1 text-sm group-hover:underline">
              {tTimeline("goToRecipe")}
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>

        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            isRequired
            className="w-full"
            name="planned-recipe-date"
            value={selectedDate}
            onChange={(d) => d && setSelectedDate(d)}
          >
            <Label>{t("date")}</Label>
            <DateField.Group fullWidth variant="secondary">
              <DateField.Input>
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
              <DateField.Suffix>
                <DatePicker.Trigger>
                  <DatePicker.TriggerIndicator />
                </DatePicker.Trigger>
              </DateField.Suffix>
            </DateField.Group>
            <DatePicker.Popover>
              <Calendar aria-label={t("date")}>
                <Calendar.Header>
                  <Calendar.YearPickerTrigger>
                    <Calendar.YearPickerTriggerHeading />
                    <Calendar.YearPickerTriggerIndicator />
                  </Calendar.YearPickerTrigger>
                  <Calendar.NavButton slot="previous" />
                  <Calendar.NavButton slot="next" />
                </Calendar.Header>
                <Calendar.Grid>
                  <Calendar.GridHeader>
                    {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                  </Calendar.GridHeader>
                  <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                </Calendar.Grid>
                <Calendar.YearPickerGrid>
                  <Calendar.YearPickerGridBody>
                    {({ year }) => <Calendar.YearPickerCell year={year} />}
                  </Calendar.YearPickerGridBody>
                </Calendar.YearPickerGrid>
              </Calendar>
            </DatePicker.Popover>
          </DatePicker>
          <Select
            className="w-full"
            value={selectedSlot}
            variant="secondary"
            onChange={(value) => handleSlotChange(value)}
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
