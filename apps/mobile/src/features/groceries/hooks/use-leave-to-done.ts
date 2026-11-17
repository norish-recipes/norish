import type { Measurable } from "@/hooks/use-focused-field-in-view";
import type { ExitAnimationsValues, LayoutAnimation } from "react-native-reanimated";
import { useEffect, useRef } from "react";
import { useReducedMotion, useSharedValue } from "react-native-reanimated";
import { settleTo } from "@/lib/motion/settle-to";

import type { ListItem, ListRow } from "../utils/list-rows";
import { DONE_ROW_HEIGHT, sectionKeyOf } from "../utils/list-rows";

/** Where a ticked row heads: the window y of its section's Done row's middle before the row leaves. */
type Aim = { key: string; y: number };

/** How long an aim stays, which an unmount of the row outlasts. */
const AIM_MS = 800;

/** A ticked row flies to its section's Done row, or where it appears under the last open row, and
 * shrinks (a fade under Reduce Motion); every other row fades. */
export function useLeaveToDone(rows: readonly ListRow[]) {
  const reduceMotion = useReducedMotion();
  const aim = useSharedValue<Aim | null>(null);
  const doneViewsRef = useRef(new Map<string, Measurable | null>());
  const itemViewsRef = useRef(new Map<string, Measurable | null>());
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const exitingFor =
    (key: string) =>
    (values: ExitAnimationsValues): LayoutAnimation => {
      "worklet";
      const target = aim.get();
      const toward = target?.key === key;
      const fade = settleTo(0, { reduceMotion, overshootClamping: true });

      return {
        initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
        animations: {
          opacity: fade,
          transform: [
            {
              translateY:
                toward && !reduceMotion
                  ? // The row's middle meets the Done row, which rises by the row's height as it goes.
                    settleTo(target.y - values.currentGlobalOriginY - 1.5 * values.currentHeight, {
                      reduceMotion,
                    })
                  : 0,
            },
            { scale: toward && !reduceMotion ? settleTo(0.6, { reduceMotion }) : 1 },
          ],
        },
      };
    };

  /** Runs `tick` once the target is known, so a row that will leave knows where to. */
  const leaveThen = (item: ListItem, ticking: boolean, tick: () => void) => {
    const section = item.store?.id ?? null;
    // The by-recipe list has no Store sections, so no Done row to head for.
    const inStore = rows.some(
      (row) =>
        row.kind === "heading" &&
        row.value.type === "store" &&
        (row.value.store?.id ?? null) === section
    );
    const lastOpen = rows
      .flatMap((row) =>
        row.kind === "item" && (row.value.store?.id ?? null) === section && !row.value.done
          ? [row.value]
          : []
      )
      .at(-1);
    const doneRow = doneViewsRef.current.get(sectionKeyOf(section));
    const below = doneRow ?? (lastOpen ? itemViewsRef.current.get(lastOpen.key) : undefined);

    if (!ticking || !inStore || !below) return tick();

    below.measureInWindow((_x, y, _w, h) => {
      aim.set({ key: item.key, y: doneRow ? y + h / 2 : y + h + DONE_ROW_HEIGHT / 2 });
      tick();
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => aim.set(null), AIM_MS);
    });
  };

  return {
    exitingFor,
    leaveThen,
    doneRef: (sectionKey: string) => (view: Measurable | null) =>
      void doneViewsRef.current.set(sectionKey, view),
    itemRef: (key: string) => (view: Measurable | null) => void itemViewsRef.current.set(key, view),
  };
}
