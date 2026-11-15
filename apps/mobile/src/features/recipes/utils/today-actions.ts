import type { ActionDefinition } from "./card-actions";

export type TodayMenuAction = "open" | "move" | "remove";

/** A Today card's long-press menu; a note has no recipe to open. */
export function todayMenuActions(isRecipe: boolean): TodayMenuAction[] {
  return isRecipe ? ["open", "move", "remove"] : ["move", "remove"];
}

export const TODAY_ACTION_DEFINITIONS: Record<TodayMenuAction, ActionDefinition> = {
  open: { labelId: "calendar.today.openRecipe", icon: "arrow.up.right" },
  move: { labelId: "calendar.today.move", icon: "arrow.left.arrow.right" },
  remove: { labelId: "common.actions.remove", icon: "trash", destructive: true },
};
