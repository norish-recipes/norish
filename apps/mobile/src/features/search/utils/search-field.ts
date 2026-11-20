// UIKit empties the field right after its Cancel event; an emptying before any Cancel is the reader's.
export const CANCEL_WINDOW_MS = 300;

/** What the field holds, and when Cancel last came, to tell UIKit's emptying from the reader's. */
export type FieldState = {
  text: string;
  confirmed: boolean;
  cancelledAt: number;
};

export const FRESH_FIELD: FieldState = { text: "", confirmed: false, cancelledAt: 0 };

export type FieldEvent =
  | { type: "typed"; text: string }
  | { type: "submitted"; text: string }
  | { type: "cancelled" }
  | { type: "narrowed" };

/** `push` is the text the native field must show again, when the event did not take. */
export type FieldStep = { state: FieldState; push?: string };

/** The field's rules: typing edits a confirmed search back into a question, the search key confirms a
 * text, narrowing to a filter empties it, Cancel keeps everything, and the emptying UIKit does just
 * after it is not the reader's. The "Search for" row confirms as the key does: `submitted` with the text. */
export function fieldStep(state: FieldState, event: FieldEvent, now: number): FieldStep {
  switch (event.type) {
    case "typed":
      return typed(state, event.text, now);
    case "submitted": {
      const { state: next, push } = typed(state, event.text, now);

      return { state: { ...next, confirmed: next.text.trim() !== "" || next.confirmed }, push };
    }
    case "cancelled":
      return { state: { ...state, cancelledAt: now } };
    case "narrowed":
      return { state: { ...state, text: "", confirmed: false }, push: "" };
  }
}

function typed(state: FieldState, text: string, now: number): FieldStep {
  if (text === state.text) return { state };

  // The empty text that follows a Cancel is UIKit's, not the reader's.
  if (text === "" && now - state.cancelledAt < CANCEL_WINDOW_MS) {
    return { state, push: state.text };
  }

  return { state: { ...state, text, confirmed: false } };
}
