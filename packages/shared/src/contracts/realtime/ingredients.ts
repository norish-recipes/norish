/**
 * Ingredients realtime catalogue. The catalogue of Ingredients is one for the
 * whole instance, so a change to what a spelling means is a broadcast. The
 * event names the Ingredients involved and nothing more: a client refetches
 * whatever it holds that is derived from them, so its own echo and a replay
 * off the Resume Buffer are a refetch that changes nothing.
 */

import { z } from "zod";

import { defineRealtimeCatalogue } from "./catalogue";

/**
 * How far a round of Ask AI over Flagged Ingredients has come: the job it
 * runs as, how many foods it has settled of how many, and what came of each:
 * a suggestion of each kind waiting on a person, or AI not sure.
 * `skipped` counts foods no longer flagged by the time the round reached
 * them, or that the person who asked may not edit; `failed` the foods whose
 * question or edit broke, each recorded on its own step. `pending` names the
 * foods it has still to answer: the foods are asked a few at once and their
 * answers written down a twentieth of the round at a time, so a row waits
 * until its answer is. Broadcast like `changed`, because the catalogue is the
 * instance's and so is the round: whoever opens the Ingredients page sees it
 * running and is not offered a second one.
 */
export const ReviewRoundSchema = z.object({
  jobId: z.string(),
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  counts: z.object({
    merge: z.number().int().nonnegative(),
    parent: z.number().int().nonnegative(),
    distinct: z.number().int().nonnegative(),
    unsure: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  pending: z.array(z.string()),
  finished: z.boolean(),
});

export type ReviewRound = z.infer<typeof ReviewRoundSchema>;

/**
 * How far a Draw icons round has come: how many foods it has settled of how
 * many, and what came of each: an icon drawn and set, a food passed over (out
 * of the asker's reach, gone, or given an icon of its own meanwhile), or a
 * drawing that failed, recorded on its own step. `pending` names the foods
 * still to be drawn, so each row shows its own turn. Broadcast like the Ask
 * AI round: the catalogue and its icons are the instance's.
 */
export const IconRoundSchema = z.object({
  jobId: z.string(),
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  counts: z.object({
    drawn: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  pending: z.array(z.string()),
  finished: z.boolean(),
});

export type IconRound = z.infer<typeof IconRoundSchema>;

export const ingredientsRealtime = defineRealtimeCatalogue("ingredients", {
  /** Any edit to these Ingredients: what they are (a merge, an alias move, a rename, a parent, a deletion) or how they read (a spelling, a flag). */
  changed: { scope: "broadcast", payload: z.object({ ingredientIds: z.array(z.string()) }) },
  /** A round of Ask AI moved on, or ended. */
  review: { scope: "broadcast", payload: ReviewRoundSchema },
  /** A Draw icons round moved on, or ended. */
  icons: { scope: "broadcast", payload: IconRoundSchema },
  /**
   * A member of the household corrected these Ingredients' nutrition, or
   * removed a correction (ADR-0039): only that household reads it, so only
   * it hears. Everything derived from their numbers is read again.
   */
  corrected: { scope: "household", payload: z.object({ ingredientIds: z.array(z.string()) }) },
});

export type IngredientsRealtime = typeof ingredientsRealtime;
