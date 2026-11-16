import type { ExitAnimationsValues, LayoutAnimation } from "react-native-reanimated";
import { useRef } from "react";
import { useReducedMotion, useSharedValue } from "react-native-reanimated";
import { settleTo } from "@/lib/motion/settle-to";

import type { ListItem, ListRow } from "../utils/list-rows";
import { sectionKeyOf } from "../utils/list-rows";

/** Where a ticked row heads: the window y of its section's Done row, and the row it is for. */
type Aim = { key: string; y: number };

/** Half of the Done row's 44 pt. */
const HALF_DONE_ROW = 22;
/** How long an aim stays, which an unmount of the row outlasts. */
const AIM_MS = 800;

export type Measurable = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

/**
 * A ticked row leaves towards its section's Done row on the app's spring and shrinks as it goes
 * (a fade under Reduce Motion); every other row leaves by fading. The target is the Done row, or
 * where it will appear, under the section's last open row.
 */
export function useLeaveToDone(rows: readonly ListRow[]) {
  const reduceMotion = useReducedMotion();
  const aim = useSharedValue<Aim | null>(null);
  const doneViewsRef = useRef(new Map<string, Measurable | null>());
  const itemViewsRef = useRef(new Map<string, Measurable | null>());

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
                  ? settleTo(target.y - values.currentGlobalOriginY - values.currentHeight / 2, {
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
      aim.set({ key: item.key, y: doneRow ? y + h / 2 : y + h + HALF_DONE_ROW });
      tick();
      setTimeout(() => aim.set(null), AIM_MS);
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
