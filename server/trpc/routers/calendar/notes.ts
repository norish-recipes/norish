import type { Slot } from "@/types";

import { TRPCError } from "@trpc/server";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { calendarEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";
import {
  listNotesByUsersAndRange,
  createNote,
  deleteNote,
  updateNoteDate,
  getNoteOwnerId,
  NoteListSchema,
  NoteCreateSchema,
  NoteDeleteSchema,
  NoteUpdateDateSchema,
} from "@/server/db";
import { assertHouseholdAccess } from "@/server/auth/permissions";

// Procedures
const list = authedProcedure.input(NoteListSchema).query(async ({ ctx, input }) => {
  log.debug({ userId: ctx.user.id, input }, "Listing notes");

  const notes = await listNotesByUsersAndRange(ctx.userIds, input.startISO, input.endISO);

  log.debug({ count: notes.length }, "Listed notes");

  return notes;
});

const create = authedProcedure.input(NoteCreateSchema).mutation(({ ctx, input }) => {
  const { date, slot, title } = input;
  const id = crypto.randomUUID();

  log.info({ userId: ctx.user.id, title, date, slot }, "Creating note");

  createNote(id, ctx.user.id, title, date, slot)
    .then((note) => {
      // Emit to household for UI updates
      calendarEmitter.emitToHousehold(ctx.householdKey, "notePlanned", { note });

      // Emit global event for server-side listeners (e.g., CalDAV sync)
      calendarEmitter.emitGlobal("globalNotePlanned", {
        id: note.id,
        title: note.title,
        date: note.date,
        slot: note.slot as Slot,
        userId: ctx.user.id,
      });

      log.info({ id, userId: ctx.user.id }, "Created note");
    })
    .catch((error) => {
      log.error({ error, userId: ctx.user.id }, "Failed to create note");
      calendarEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: "Failed to create note",
      });
    });

  return id;
});

const deleteProcedure = authedProcedure.input(NoteDeleteSchema).mutation(({ ctx, input }) => {
  const { id, date } = input;

  log.info({ userId: ctx.user.id, id, date }, "Deleting note");

  getNoteOwnerId(id)
    .then(async (ownerId) => {
      if (!ownerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Note not found",
        });
      }

      await assertHouseholdAccess(ctx.user.id, ownerId);
      await deleteNote(id);

      // Emit to household for UI updates
      calendarEmitter.emitToHousehold(ctx.householdKey, "noteDeleted", {
        noteId: id,
        date,
      });

      // Emit global event for server-side listeners (e.g., CalDAV sync)
      calendarEmitter.emitGlobal("globalNoteDeleted", {
        id,
        userId: ownerId,
      });

      log.info({ id, userId: ctx.user.id }, "Deleted note");
    })
    .catch((error) => {
      log.error({ error, userId: ctx.user.id, id }, "Failed to delete note");
      calendarEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: error.message || "Failed to delete note",
      });
    });

  return { success: true };
});

const updateDate = authedProcedure.input(NoteUpdateDateSchema).mutation(({ ctx, input }) => {
  const { id, newDate, oldDate } = input;

  log.info({ userId: ctx.user.id, id, newDate, oldDate }, "Updating note date");

  getNoteOwnerId(id)
    .then(async (ownerId) => {
      if (!ownerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Note not found",
        });
      }

      await assertHouseholdAccess(ctx.user.id, ownerId);
      const note = await updateNoteDate(id, newDate);

      // Emit to household for UI updates
      calendarEmitter.emitToHousehold(ctx.householdKey, "noteUpdated", {
        note,
        oldDate,
      });

      // Emit global event for server-side listeners (e.g., CalDAV sync)
      calendarEmitter.emitGlobal("globalNoteUpdated", {
        id: note.id,
        title: note.title,
        newDate: note.date,
        slot: note.slot as Slot,
        userId: ownerId,
      });

      log.info({ id, userId: ctx.user.id, newDate }, "Updated note date");
    })
    .catch((error) => {
      log.error({ error, userId: ctx.user.id, id }, "Failed to update note date");
      calendarEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: error.message || "Failed to update note date",
      });
    });

  return { success: true };
});

export const notesProcedures = router({
  listNotes: list,
  createNote: create,
  deleteNote: deleteProcedure,
  updateNoteDate: updateDate,
});
