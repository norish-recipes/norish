/**
 * Tags, Cuisines and Categories as household lists (ADR-0043). Every member manages the
 * household's entries; instance entries are an administrator's, and built-in Categories are fixed.
 * Another household's entries are never offered or changed, whatever the Permission Policy.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { ListEntryRow, ListKind, ListScope } from "@norish/db/repositories/list-entries";
import {
  addEntry,
  deleteEntry,
  findOwnEntry,
  LIST_KINDS,
  listEntries,
  mergeEntries,
  recipeHouseholdId,
  renameEntry,
} from "@norish/db/repositories/list-entries";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { config } from "@norish/shared-server/realtime/config";
import { lists } from "@norish/shared-server/realtime/lists";

import type { AuthedProcedureContext } from "../../middleware";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { assertRecipeAccess, notFoundError } from "../recipes/helpers";

const KindSchema = z.enum(LIST_KINDS);
const NameSchema = z.string().trim().min(1).max(80);

type ListContext = Pick<AuthedProcedureContext, "householdId" | "isServerAdmin">;

/** Whether the caller may change an entry of their scope: built-in Categories never, other instance entries as an admin. */
function mayChangeInstance(ctx: ListContext, kind: ListKind): boolean {
  return kind === "cuisine" && ctx.isServerAdmin;
}

/** An entry as the caller's list shows it, with whether they may rename, merge or delete it. */
function shown(ctx: ListContext, kind: ListKind, household: string, entry: ListEntryRow) {
  const editable = entry.instance ? mayChangeInstance(ctx, kind) : household === ctx.householdId;

  return { ...entry, editable };
}

/** The household a read or create works on: the caller's, or an editable recipe's own (ADR-0041). */
async function listHousehold(ctx: ListContext, recipeId: string | undefined): Promise<string> {
  if (!recipeId) return ctx.householdId;

  await assertRecipeAccess(ctx, recipeId, "edit");

  const householdId = await recipeHouseholdId(recipeId);

  if (!householdId) throw notFoundError("recipe");

  return householdId;
}

/** The scope of an entry the caller may change: their household's, or the instance's for an admin. */
async function changeableScope(ctx: ListContext, kind: ListKind, id: string): Promise<ListScope> {
  if (await findOwnEntry(kind, ctx.householdId, id)) return ctx.householdId;
  if (await findOwnEntry(kind, null, id)) {
    if (mayChangeInstance(ctx, kind)) return null;

    throw new TRPCError({ code: "FORBIDDEN", message: "This entry cannot be changed" });
  }

  throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
}

/** A household list change reaches the household; an instance entry's reaches everyone. */
function announce(kind: ListKind, scope: ListScope) {
  if (scope === null) void config.publish("changed", {}, undefined);
  else void lists.publish("changed", { kind }, { householdId: scope });
}

/**
 * The household's entries plus the instance's, each with the count of the household's recipes
 * carrying it. With `recipeId` (one the caller may edit) it is that recipe's household's list.
 */
const list = authedProcedure
  .input(z.object({ kind: KindSchema, recipeId: z.uuid().optional() }))
  .query(async ({ ctx, input }) => {
    const household = await listHousehold(ctx, input.recipeId);
    const entries = await listEntries(input.kind, household);

    return entries.map((entry) => shown(ctx, input.kind, household, entry));
  });

/**
 * Adds a name to the household's list, or to the recipe's household's for `recipeId`, or (an
 * admin's Cuisine) to the instance's. A name already there answers that entry, `created` false.
 */
const add = authedProcedure
  .input(
    z.object({
      kind: KindSchema,
      name: NameSchema,
      recipeId: z.uuid().optional(),
      instance: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (input.instance && !mayChangeInstance(ctx, input.kind)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only an administrator adds these" });
    }

    const scope = input.instance ? null : await listHousehold(ctx, input.recipeId);
    const added = await addEntry(input.kind, scope, input.name);

    if (!added) throw new TRPCError({ code: "BAD_REQUEST", message: "Names nothing" });

    log.info({ userId: ctx.user.id, kind: input.kind, created: added.created }, "List entry added");
    if (added.created) announce(input.kind, scope);

    return {
      entry: shown(ctx, input.kind, scope ?? ctx.householdId, added.entry),
      created: added.created,
    };
  });

const EntryRefSchema = z.object({ id: z.uuid(), version: z.number().int() });

/** A change against an older version than the entry's changes nothing and answers `stale`. */
const STALE = { stale: true } as const;

/** Renames an entry; a name the list already has merges the two and answers the one kept. */
const rename = authedProcedure
  .input(EntryRefSchema.extend({ kind: KindSchema, name: NameSchema }))
  .mutation(async ({ ctx, input }) => {
    const scope = await changeableScope(ctx, input.kind, input.id);
    const renamed = await renameEntry(input.kind, scope, input, input.name);

    if (!renamed) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
    if (renamed.stale) return STALE;

    const { entry, merged } = renamed.value;

    log.info({ userId: ctx.user.id, kind: input.kind, merged }, "List entry renamed");
    announce(input.kind, scope);

    return { stale: false, entry: shown(ctx, input.kind, scope ?? ctx.householdId, entry), merged };
  });

/** Moves the source's recipes onto the target (the household's own or an instance entry) and removes the source. */
const merge = authedProcedure
  .input(z.object({ kind: KindSchema, source: EntryRefSchema, target: EntryRefSchema }))
  .mutation(async ({ ctx, input }) => {
    const scope = await changeableScope(ctx, input.kind, input.source.id);
    const merged = await mergeEntries(input.kind, scope, input.source, input.target);

    if (!merged) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
    if (merged.stale) return STALE;

    log.info({ userId: ctx.user.id, kind: input.kind }, "List entries merged");
    announce(input.kind, scope);

    return { stale: false, entry: shown(ctx, input.kind, scope ?? ctx.householdId, merged.value) };
  });

/** Deletes an entry, taking it off its recipes; answers how many recipes it came off. */
const remove = authedProcedure
  .input(EntryRefSchema.extend({ kind: KindSchema }))
  .mutation(async ({ ctx, input }) => {
    const scope = await changeableScope(ctx, input.kind, input.id);
    const deleted = await deleteEntry(input.kind, scope, input);

    if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
    if (deleted.stale) return STALE;

    log.info({ userId: ctx.user.id, kind: input.kind, ...deleted.value }, "List entry deleted");
    announce(input.kind, scope);

    return { stale: false, ...deleted.value };
  });

export const listsProcedures = router({ list, add, rename, merge, delete: remove });
