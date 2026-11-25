/**
 * List realtime catalogue. A household's Tags, Cuisines and Categories are its own (ADR-0043),
 * so a change reaches whoever may view its recipes; an instance entry's change is a `config`
 * broadcast. The event names only the kinds: a client reads them again, so an echo or a replay
 * changes nothing.
 */

import { z } from "zod";

import { defineRealtimeCatalogue } from "./catalogue";

export const listsRealtime = defineRealtimeCatalogue("lists", {
  changed: {
    scope: "policy",
    payload: z.object({ kinds: z.array(z.enum(["tag", "cuisine", "category"])).min(1) }),
  },
});

export type ListsRealtime = typeof listsRealtime;
