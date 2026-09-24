/**
 * Calendar realtime catalogue.
 *
 * Planned items belong to a household, so the client events are
 * household-scoped. The CalDAV listener is a server-internal subscriber and a
 * household channel cannot be listened to without knowing the household, so
 * every event it reacts to has an `internal` companion, published beside the
 * household event with the same payload (`calendarInternalCompanion`).
 */

import { z } from "zod";

import {
  PlannedItemWithRecipePayloadSchema,
  SlotItemSortUpdateSchema,
} from "@norish/shared/contracts/zod/planned-items";

import { defineRealtimeCatalogue } from "./catalogue";

const SlotSchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);

const ItemCreatedSchema = z.object({ item: PlannedItemWithRecipePayloadSchema });
const ItemDeletedSchema = z.object({ itemId: z.string(), date: z.string(), slot: SlotSchema });
const ItemMovedSchema = z.object({
  item: PlannedItemWithRecipePayloadSchema,
  targetSlotItems: z.array(SlotItemSortUpdateSchema),
  sourceSlotItems: z.array(SlotItemSortUpdateSchema).nullable(),
  oldDate: z.string(),
  oldSlot: SlotSchema,
  oldSortOrder: z.number(),
});
const ItemUpdatedSchema = z.object({ item: PlannedItemWithRecipePayloadSchema });

/** The client events that carry an `internal` companion, and its name. */
export const calendarInternalCompanion = {
  itemCreated: "itemCreatedInternal",
  itemDeleted: "itemDeletedInternal",
  itemMoved: "itemMovedInternal",
  itemUpdated: "itemUpdatedInternal",
} as const;

export type CalendarItemEvent = keyof typeof calendarInternalCompanion;

export const calendarRealtime = defineRealtimeCatalogue("calendar", {
  failed: { scope: "household", payload: z.object({ reason: z.string() }) },
  itemCreated: { scope: "household", payload: ItemCreatedSchema },
  itemDeleted: { scope: "household", payload: ItemDeletedSchema },
  itemMoved: { scope: "household", payload: ItemMovedSchema },
  itemUpdated: { scope: "household", payload: ItemUpdatedSchema },
  itemCreatedInternal: { scope: "internal", payload: ItemCreatedSchema },
  itemDeletedInternal: { scope: "internal", payload: ItemDeletedSchema },
  itemMovedInternal: { scope: "internal", payload: ItemMovedSchema },
  itemUpdatedInternal: { scope: "internal", payload: ItemUpdatedSchema },
});

export type CalendarRealtime = typeof calendarRealtime;
