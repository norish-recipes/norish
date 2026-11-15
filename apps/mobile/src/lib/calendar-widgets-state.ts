import * as Linking from "expo-linking";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import {
  firstSlotFrom,
  groupTodayItemsBySlot,
  isRecipeItem,
  nextMealSlot,
  TODAY_MEAL_SLOTS,
} from "@norish/shared-react/calendar/todays-meals";
import { dateKey } from "@norish/shared/lib/helpers";

import { TAB_ROUTES } from "./tab-routes";

/** Today and the 13 days after it: how long the widgets roll without the app. */
export const WIDGET_DAYS = 14;
/** The large widget's week; its last entry needs six days past the horizon. */
export const WEEK_DAYS = 7;
/** The days the app reads for the widgets. */
export const WIDGET_DATA_DAYS = WIDGET_DAYS + WEEK_DAYS - 1;
/** The hours `nextMealSlot` changes at, after midnight. */
export const SLOT_CHANGE_HOURS = [10, 14] as const;
/** Lines the large widget's week fits: one per day, empty or not, and three more. */
export const WEEK_LINES = 10;

export type PhotoSize = "meal" | "thumb";
/** A photo's file in the shared folder, or null while it is not on the device. */
export type PhotoLookup = (image: string, size: PhotoSize) => string | null;

export type WidgetStrings = {
  nothingPlanned: string;
  signIn: string;
  open: string;
  calendar: string;
  today: string;
  untitled: string;
  slots: Record<Slot, string>;
  more: (count: number) => string;
  weekday: (date: Date) => string;
  weekdayShort: (date: Date) => string;
};

export type WidgetMessage = { kind: "message"; text: string; url: string };

export type SmallWidgetProps =
  | WidgetMessage
  | {
      kind: "meal";
      weekday: string;
      day: string;
      slot: string;
      name: string;
      /** Absent while not on the device: the widget store takes no null. */
      photo?: string;
      url: string;
    }
  | { kind: "empty"; weekday: string; day: string; text: string; url: string };

export type WeekLine = {
  id: string;
  kind: "recipe" | "note";
  name: string;
  photo?: string;
  url: string;
  /** On a day's last shown line, "+N more" for the items it leaves out. */
  more?: string;
};

export type WeekDay = {
  key: string;
  weekday: string;
  day: string;
  today: boolean;
  url: string;
  lines: WeekLine[];
};

export type LargeWidgetProps =
  WidgetMessage | { kind: "week"; title: string; url: string; days: WeekDay[] };

export type WidgetEntry<P> = { date: number; props: P };

export type WidgetTimelines = {
  small: WidgetEntry<SmallWidgetProps>[];
  large: WidgetEntry<LargeWidgetProps>[];
};

export const recipeUrl = (id: string) => Linking.createURL(`/recipe/${encodeURIComponent(id)}`);
export const calendarDayUrl = (key: string) =>
  Linking.createURL(TAB_ROUTES.calendar.root, { queryParams: { day: key } });
export const todayUrl = () => Linking.createURL(TAB_ROUTES.recipes.root);

/** What both widgets show signed out: one line that opens Sign in. */
export function signedOutTimelines(strings: Pick<WidgetStrings, "signIn">): WidgetTimelines {
  const props: WidgetMessage = { kind: "message", text: strings.signIn, url: todayUrl() };

  return { small: [{ date: 0, props }], large: [{ date: 0, props }] };
}

/**
 * The widgets' timelines from `now` for two weeks: the small one changes at every midnight and
 * slot change, the large one at midnight; the device's local time sets each. After them, "Open Norish".
 */
export function calendarWidgetTimelines(
  plan: Record<string, PlannedItemFromQuery[]>,
  now: number,
  strings: WidgetStrings,
  photo: PhotoLookup
): WidgetTimelines {
  const start = new Date(now);
  // Built from the calendar date, so a daylight-saving change moves no boundary off its hour.
  const at = (offset: number, hour = 0) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset, hour);
  const small: WidgetEntry<SmallWidgetProps>[] = [];
  const large: WidgetEntry<LargeWidgetProps>[] = [];

  for (let offset = 0; offset < WIDGET_DAYS; offset++) {
    const day = at(offset);

    large.push({ date: day.getTime(), props: weekProps(plan, offset, at, strings, photo) });
    for (const hour of [0, ...SLOT_CHANGE_HOURS]) {
      const date = at(offset, hour);

      small.push({
        date: date.getTime(),
        props: smallProps(plan[dateKey(date)] ?? [], date, strings, photo),
      });
    }
  }
  const runOut: WidgetMessage = { kind: "message", text: strings.open, url: todayUrl() };
  const end = at(WIDGET_DAYS).getTime();

  return {
    small: [...fromNow(small, now), { date: end, props: runOut }],
    large: [...fromNow(large, now), { date: end, props: runOut }],
  };
}

/** The entry showing at `now` and every later one; the first keeps its own start, so a resync matches. */
function fromNow<P>(entries: WidgetEntry<P>[], now: number): WidgetEntry<P>[] {
  const current = entries.findLastIndex((entry) => entry.date <= now);

  return entries.slice(Math.max(current, 0));
}

const withPhoto = (file: string | null) => (file ? { photo: file } : {});

function itemName(item: PlannedItemFromQuery, strings: WidgetStrings) {
  return item.recipeName ?? item.title ?? strings.untitled;
}

function smallProps(
  items: PlannedItemFromQuery[],
  date: Date,
  strings: WidgetStrings,
  photo: PhotoLookup
): SmallWidgetProps {
  const bySlot = groupTodayItemsBySlot(items);
  const filled = TODAY_MEAL_SLOTS.filter((slot) => bySlot[slot].length > 0);
  // The slot for the hour, or the next filled one later in the same day.
  const slot = firstSlotFrom(filled, nextMealSlot(date.getHours()));
  const header = { weekday: strings.weekday(date), day: String(date.getDate()) };
  const item = slot ? bySlot[slot][0] : undefined;

  if (!slot || !item) {
    return { kind: "empty", ...header, text: strings.nothingPlanned, url: todayUrl() };
  }
  const recipe = isRecipeItem(item);

  return {
    kind: "meal",
    ...header,
    slot: strings.slots[slot],
    name: itemName(item, strings),
    ...withPhoto(recipe && item.recipeImage ? photo(item.recipeImage, "meal") : null),
    url: recipe ? recipeUrl(item.recipeId) : calendarDayUrl(dateKey(date)),
  };
}

function weekProps(
  plan: Record<string, PlannedItemFromQuery[]>,
  offset: number,
  at: (offset: number) => Date,
  strings: WidgetStrings,
  photo: PhotoLookup
): LargeWidgetProps {
  const dates = Array.from({ length: WEEK_DAYS }, (_, index) => at(offset + index));
  const items = dates.map((date) => {
    const bySlot = groupTodayItemsBySlot(plan[dateKey(date)] ?? []);

    return TODAY_MEAL_SLOTS.flatMap((slot) => bySlot[slot]);
  });
  const budget = lineBudget(items.map((day) => day.length));

  return {
    kind: "week",
    title: strings.calendar,
    url: calendarDayUrl(dateKey(dates[0]!)),
    days: dates.map((date, index) => {
      const key = dateKey(date);
      const dayItems = items[index] ?? [];
      const shown = budget[index] ?? 0;
      const lines: WeekLine[] = dayItems.slice(0, shown).map((item) => {
        const recipe = isRecipeItem(item);

        return {
          id: item.id,
          name: itemName(item, strings),
          kind: recipe ? "recipe" : "note",
          ...withPhoto(recipe && item.recipeImage ? photo(item.recipeImage, "thumb") : null),
          url: recipe ? recipeUrl(item.recipeId) : calendarDayUrl(key),
        };
      });
      const last = lines.at(-1);

      if (last && dayItems.length > lines.length)
        last.more = strings.more(dayItems.length - lines.length);

      return {
        key,
        weekday: index === 0 ? strings.today : strings.weekdayShort(date),
        day: String(date.getDate()),
        today: index === 0,
        url: calendarDayUrl(key),
        lines,
      };
    }),
  };
}

/** Item lines per day: one for each day with items, then the spare lines one per day in turn. */
export function lineBudget(counts: number[]): number[] {
  const budget = counts.map((count) => Math.min(count, 1));
  let left = WEEK_LINES - counts.length;

  while (left > 0 && budget.some((lines, index) => lines < (counts[index] ?? 0))) {
    for (let index = 0; index < budget.length && left > 0; index++) {
      if ((budget[index] ?? 0) < (counts[index] ?? 0)) {
        budget[index] = (budget[index] ?? 0) + 1;
        left -= 1;
      }
    }
  }

  return budget;
}
