"use client";

import type { DateValue } from "@internationalized/date";
import type { Key } from "react";
import { useState } from "react";
import Link from "next/link";
import { PlannedItemThumbnail } from "@/components/calendar/planned-item-thumbnail";
import { Panel, PanelPortal } from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";
import { Calendar, DateField, DatePicker, Label, ListBox, Select } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useTranslations } from "next-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { useCalendarMutations } from "@norish/shared-react/calendar";
import { isRecipeItem, isRecipeOutOfView } from "@norish/shared-react/calendar/todays-meals";
import { Slot } from "@norish/shared/contracts";

const SLOTS: Slot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

type EditPlannedRecipePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PlannedItemFromQuery;
};
export function EditPlannedRecipePanel({ open, onOpenChange, item }: EditPlannedRecipePanelProps) {
  const { id: itemId, date, slot } = item;
  const recipeName = item.recipeName ?? "";
  const recipeId = isRecipeItem(item) ? item.recipeId : null;
  const { planRecipe, deleteItem, moveItem } = useCalendarMutations();
  const [selectedDate, setSelectedDate] = useState<DateValue>(() => parseDate(date));
  const [selectedSlot, setSelectedSlot] = useState<Slot>(slot);
  const [seededFrom, setSeededFrom] = useState({ open, date, slot });
  const t = useTranslations("calendar.editPlannedRecipe");
  const tSlots = useTranslations("common.slots");
  const tActions = useTranslations("common.actions");
  const tTimeline = useTranslations("calendar.timeline");

  if (seededFrom.open !== open || seededFrom.date !== date || seededFrom.slot !== slot) {
    setSeededFrom({ open, date, slot });
    if (open) {
      setSelectedDate(parseDate(date));
      setSelectedSlot(slot);
    }
  }
  const handleSave = () => {
    const newDateStr = selectedDate.toString();
    const locationChanged = newDateStr !== date || selectedSlot !== slot;

    if (locationChanged) {
      moveItem(itemId, newDateStr, selectedSlot, 0);
    }
    onOpenChange(false);
  };
  const handleDelete = () => {
    deleteItem(itemId);
    onOpenChange(false);
  };
  const handleDuplicate = (id: string) => {
    planRecipe(selectedDate.toString(), selectedSlot, id);
  };
  const handleSlotChange = (value: Key | null) => {
    if (value) {
      setSelectedSlot(value.toString() as Slot);
    }
  };

  return (
    <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
      <Panel.Body sections>
        {recipeId ? (
          <Link
            className="focus-visible:ring-accent group flex items-center gap-3 rounded-xl p-2 outline-none focus-visible:ring-2"
            href={`/recipes/${recipeId}`}
            onClick={() => onOpenChange(false)}
          >
            <PlannedItemThumbnail
              alt={recipeName}
              image={item.recipeImage ?? null}
              itemType="recipe"
              size="md"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-foreground truncate text-base font-medium">{recipeName}</span>
              <span className="text-accent flex items-center gap-1 text-sm group-hover:underline">
                {tTimeline("goToRecipe")}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        ) : isRecipeOutOfView(item) ? (
          <div className="flex items-center gap-3 p-2" data-testid="planned-recipe-title-only">
            <PlannedItemThumbnail alt={recipeName} image={null} itemType="recipe" size="md" />
            <span className="text-foreground min-w-0 flex-1 truncate text-base font-medium">
              {recipeName}
            </span>
          </div>
        ) : null}

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
          {recipeId ? (
            <ActionButton action="duplicate" onPress={() => handleDuplicate(recipeId)}>
              {tActions("duplicate")}
            </ActionButton>
          ) : null}
          <ActionButton action="save" onPress={handleSave}>
            {tActions("save")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}

/**
 * Its own component so the portal container is read from inside the Panel — a
 * hook called in the Panel's parent sees no panel at all.
 */
export function DateAndSlotFields({
  selectedDate,
  selectedSlot,
  onSelectDate,
  onSelectSlot,
}: {
  selectedDate: DateValue;
  selectedSlot: Slot;
  onSelectDate: (date: DateValue) => void;
  onSelectSlot: (value: Key | null) => void;
}) {
  const t = useTranslations("calendar.editPlannedRecipe");
  const tSlots = useTranslations("common.slots");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DatePicker
        isRequired
        className="w-full"
        name="planned-recipe-date"
        value={selectedDate}
        onChange={(d) => d && onSelectDate(d)}
      >
        <Label>{t("date")}</Label>
        <DateField.Group fullWidth variant="secondary">
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <PanelPortal>
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
        </PanelPortal>
      </DatePicker>
      <Select
        className="w-full"
        value={selectedSlot}
        variant="secondary"
        onChange={(value) => onSelectSlot(value)}
      >
        <Label>{t("slot")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <PanelPortal>
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
        </PanelPortal>
      </Select>
    </div>
  );
}
