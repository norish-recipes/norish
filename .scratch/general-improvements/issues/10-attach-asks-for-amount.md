# 10 — Attaching a Step Ingredient asks for the amount

**What to build:** Both attach gestures — the `@` mention and the **Link ingredient** picker — currently attach at the whole line and stop; setting an amount means noticing the chip, opening its menu, and picking Amount…. After attaching a line that has an amount, the chip's amount entry should open by itself: focused, prefilled with the whole line's amount, type-over ready. The ask must cost nothing to ignore — closing unedited (Escape, blur, clicking on) keeps the whole line, exactly as attaching works today. A line with no amount attaches silently as before: there is no number to ask for.

**Blocked by:** None — extends 09 (amount-based entry), shipped.

**Spec:** `.scratch/general-improvements/spec.md`; post-ship feedback on 09: "using @<ingredient> it doesn't ask for an amount neither when clicking the dedicated link ingredient button; it should ask for an amount after adding."

**Status:** done

- [x] Picking a line from the **Link ingredient** picker attaches it at the whole line and opens its amount entry when the line has an amount; an amountless line attaches silently.
- [x] The `@` mention does the same for a newly attached amounted line; a re-mention of an already-attached line changes nothing and asks nothing.
- [x] The entry opens focused with the whole line's amount selected, so typing replaces it; Enter commits the equivalent share, Escape or an unedited close keeps the whole line.
- [x] Closing the auto-opened entry by keyboard returns focus to the step's text, so the sentence continues where it left off; a mouse blur leaves focus where the person put it.
- [x] The mention gesture's caret lands after the inserted word even when the entry took focus — the text input restores the caret without stealing focus back from the entry.
- [x] Docs and release notes describe the ask-after-attach flow.

## Comments

- Filed from post-ship feedback on 09. The entry affordance itself shipped there; this is about when it appears.
- Shipped on general-improvements. The picker sets a pending entry inside the chips row; the mention returns "caller takes focus" to SmartTextInput, which then restores the caret without re-focusing the textarea. SmartTextInput now forwards a ref (React 19 ref-as-prop), which also makes step-input's long-dead Enter-to-next-row focus work again. Auto-opened entries report keyboard closes so the step's textarea regains focus. All entries — auto and menu-opened alike — now select their prefill on open, so typing replaces it.
- Review found and fixed a real bug before commit: closing the ask hands focus away, which blurs the still-mounted input, and that blur re-entered commit with the stale typed value — so Escape-after-typing committed the abandoned amount. A one-close-per-open guard (closingRef) fixes it; covered by a jsdom regression test and a real-browser e2e that also proves the picker menu's own focus restore does not defeat the ask.
