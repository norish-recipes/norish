/** List realtime catalogue. A household's lists are its own (ADR-0043), so a change reaches whoever
 * may view its recipes; the event names only the kinds, a client rereads, so an echo changes nothing. */

import { z } from "zod";

import { defineRealtimeCatalogue } from "./catalogue";

export const listsRealtime = defineRealtimeCatalogue("lists", {
  changed: {
    scope: "policy",
    payload: z.object({ kinds: z.array(z.enum(["tag", "cuisine", "category"])).min(1) }),
  },
});

export type ListsRealtime = typeof listsRealtime;
