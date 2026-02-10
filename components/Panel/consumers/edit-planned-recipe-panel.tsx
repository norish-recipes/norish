"use client";

import { useEffect, useState } from "react";
import { Button, DatePicker, Select, SelectItem } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Panel, PANEL_HEIGHT_COMPACT } from "@/components/Panel/Panel";
import { PlannedItemThumbnail } from "@/components/calendar/planned-item-thumbnail";
import { useCalendarContext } from "@/app/(app)/calendar/context";
import { Slot } from "@/types";

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
  const { deletePlanned, moveItem } = useCalendarContext();
  const [selectedDate, setSelectedDate] = useState(parseDate(date));
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

  return (
    <Panel height={PANEL_HEIGHT_COMPACT} open={open} title={t("title")} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-4">
        {/* Recipe preview */}
        <Link
          className="flex items-center gap-3 rounded-lg"
          href={`/recipes/${recipeId}`}
          onClick={() => onOpenChange(false)}
        >
          <PlannedItemThumbnail alt={recipeName} image={recipeImage} itemType="recipe" size="md" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-foreground truncate text-base font-medium">{recipeName}</span>
            <span className="text-primary flex items-center gap-1 text-sm">
              {tTimeline("goToRecipe")}
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>

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
            label={t("slot")}
            selectedKeys={[selectedSlot]}
            onChange={(e) => setSelectedSlot(e.target.value as Slot)}
          >
            {SLOTS.map((s) => (
              <SelectItem key={s}>{tSlots(s.toLowerCase())}</SelectItem>
            ))}
          </Select>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button
            className="min-w-16"
            color="danger"
            size="sm"
            variant="flat"
            onPress={handleDelete}
          >
            {tActions("delete")}
          </Button>
          <Button className="min-w-16" color="primary" size="sm" onPress={handleSave}>
            {tActions("save")}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
