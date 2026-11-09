/**
 * Config realtime catalogue. The reference data an administrator edits (units,
 * words, Cuisines, timers, locales) is one for the whole instance, so an edit
 * is a broadcast. The event names nothing: a client reads every such read
 * again, so its own echo and a replay are a read that changes nothing.
 */

import { z } from "zod";

import { defineRealtimeCatalogue } from "./catalogue";

export const configRealtime = defineRealtimeCatalogue("config", {
  changed: { scope: "broadcast", payload: z.object({}) },
});

export type ConfigRealtime = typeof configRealtime;
