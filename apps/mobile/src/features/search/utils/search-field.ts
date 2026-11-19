// UIKit empties the field on Cancel next to its event, in either order, as it does on the clear button.
export const CANCEL_WINDOW_MS = 300;

/** What the field holds, and what it needs to tell UIKit's emptying from the reader's. */
export type FieldState = {
  text: string;
  confirmed: boolean;
  cancelledAt: number;
  /** The text the last emptying removed, for a Cancel that follows it. */
  wiped: { text: string; confirmed: boolean; at: number } | null;
};

export const FRESH_FIELD: FieldState = { text: "", confirmed: false, cancelledAt: 0, wiped: null };

export type FieldEvent =
  { type: "typed"; text: string } | { type: "submitted"; text: string } | { type: "cancelled" };

/** `push` is the text the native field must show again, when the event did not take. */
export type FieldStep = { state: FieldState; push?: string };

/** The field's rules: typing edits a confirmed search back into a question, the search key confirms a
 * text, Cancel keeps everything, and the emptying UIKit does beside it is not the reader's. */
export function fieldStep(state: FieldState, event: FieldEvent, now: number): FieldStep {
  switch (event.type) {
    case "typed":
      return typed(state, event.text, now);
    case "submitted": {
      const { state: next, push } = typed(state, event.text, now);

      return { state: { ...next, confirmed: next.text.trim() !== "" || next.confirmed }, push };
    }
    case "cancelled": {
      const { wiped } = state;
      const cancelled = { ...state, cancelledAt: now, wiped: null };

      if (!wiped || now - wiped.at >= CANCEL_WINDOW_MS) return { state: cancelled };

      return {
        state: { ...cancelled, text: wiped.text, confirmed: wiped.confirmed },
        push: wiped.text,
      };
    }
  }
}

function typed(state: FieldState, text: string, now: number): FieldStep {
  if (text === state.text) return { state };

  // The empty text that follows a Cancel is UIKit's, not the reader's.
  if (text === "" && now - state.cancelledAt < CANCEL_WINDOW_MS) {
    return { state, push: state.text };
  }

  const wiped = text === "" ? { text: state.text, confirmed: state.confirmed, at: now } : null;

  return { state: { ...state, text, confirmed: false, wiped } };
}
