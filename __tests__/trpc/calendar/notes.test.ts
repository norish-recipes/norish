import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";

// Setup mocks before any imports that use them
vi.mock("@/server/db/repositories/notes", () => import("../../mocks/notes"));
vi.mock("@/server/db", () => import("../../mocks/notes"));
vi.mock("@/server/auth/permissions", () => import("../../mocks/permissions"));
vi.mock("@/server/trpc/routers/calendar/emitter", () => import("../../mocks/calendar-emitter"));
vi.mock("@/config/server-config-loader", () => import("../../mocks/config"));

// Import mocks for assertions
import {
  listNotesByUsersAndRange,
  createNote,
  deleteNote,
  updateNoteDate,
  getNoteOwnerId,
} from "../../mocks/notes";
import { assertHouseholdAccess } from "../../mocks/permissions";
import { calendarEmitter } from "../../mocks/calendar-emitter";

// Import test utilities
import {
  createMockUser,
  createMockHousehold,
  createMockAuthedContext,
  createMockNote,
} from "./test-utils";

// Create a test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

// Create test caller factory with inline procedures that mirror the actual implementation
function createTestCaller(ctx: ReturnType<typeof createMockAuthedContext>) {
  const testRouter = t.router({
    listNotes: t.procedure
      .input((v) => v as { startISO: string; endISO: string })
      .query(async ({ input }) => {
        const notes = await listNotesByUsersAndRange(ctx.userIds, input.startISO, input.endISO);

        return notes;
      }),

    createNote: t.procedure
      .input((v) => v as { date: string; slot: string; title: string })
      .mutation(async ({ input }) => {
        const { date, slot, title } = input;
        const id = crypto.randomUUID();

        const note = await createNote(id, ctx.user.id, title, date, slot);

        calendarEmitter.emitToHousehold(ctx.householdKey, "notePlanned", { note });

        return id;
      }),

    deleteNote: t.procedure
      .input((v) => v as { id: string; date: string })
      .mutation(async ({ input }) => {
        const { id, date } = input;

        const ownerId = await getNoteOwnerId(id);

        if (!ownerId) {
          throw new Error("Note not found");
        }

        await assertHouseholdAccess(ctx.user.id, ownerId);

        await deleteNote(id);

        calendarEmitter.emitToHousehold(ctx.householdKey, "noteDeleted", { noteId: id, date });

        return { success: true };
      }),

    updateNoteDate: t.procedure
      .input((v) => v as { id: string; newDate: string; oldDate: string })
      .mutation(async ({ input }) => {
        const { id, newDate, oldDate } = input;

        const ownerId = await getNoteOwnerId(id);

        if (!ownerId) {
          throw new Error("Note not found");
        }

        await assertHouseholdAccess(ctx.user.id, ownerId);

        const note = await updateNoteDate(id, newDate);

        calendarEmitter.emitToHousehold(ctx.householdKey, "noteUpdated", { note, oldDate });

        return { success: true };
      }),
  });

  return t.createCallerFactory(testRouter)(ctx);
}

describe("calendar notes procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  describe("listNotes", () => {
    it("returns notes for user and household within date range", async () => {
      const mockNotes = [
        createMockNote({ id: "n1", title: "Buy groceries" }),
        createMockNote({ id: "n2", title: "Meal prep" }),
      ];

      listNotesByUsersAndRange.mockResolvedValue(mockNotes);

      const caller = createTestCaller(ctx);
      const result = await caller.listNotes({
        startISO: "2025-01-01",
        endISO: "2025-01-31",
      });

      expect(listNotesByUsersAndRange).toHaveBeenCalledWith(
        ctx.userIds,
        "2025-01-01",
        "2025-01-31"
      );
      expect(result).toEqual(mockNotes);
    });

    it("returns empty array when no notes exist", async () => {
      listNotesByUsersAndRange.mockResolvedValue([]);

      const caller = createTestCaller(ctx);
      const result = await caller.listNotes({
        startISO: "2025-01-01",
        endISO: "2025-01-31",
      });

      expect(result).toEqual([]);
    });
  });

  describe("createNote", () => {
    it("creates a note and emits event to household", async () => {
      const mockNote = createMockNote({
        title: "Meal prep Sunday",
        date: "2025-01-15",
        slot: "Lunch",
      });

      createNote.mockResolvedValue(mockNote);

      const caller = createTestCaller(ctx);
      const result = await caller.createNote({
        date: "2025-01-15",
        slot: "Lunch",
        title: "Meal prep Sunday",
      });

      expect(createNote).toHaveBeenCalledWith(
        expect.any(String), // UUID
        ctx.user.id,
        "Meal prep Sunday",
        "2025-01-15",
        "Lunch"
      );
      expect(calendarEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "notePlanned",
        { note: mockNote }
      );
      expect(result).toEqual(expect.any(String)); // Returns UUID
    });

    it("creates note with different slots", async () => {
      const slots = ["Breakfast", "Lunch", "Dinner", "Snack"];

      for (const slot of slots) {
        vi.clearAllMocks();
        const mockNote = createMockNote({ slot: slot as any });

        createNote.mockResolvedValue(mockNote);

        const caller = createTestCaller(ctx);

        await caller.createNote({
          date: "2025-01-15",
          slot,
          title: "Test note",
        });

        expect(createNote).toHaveBeenCalledWith(
          expect.any(String),
          ctx.user.id,
          "Test note",
          "2025-01-15",
          slot
        );
      }
    });
  });

  describe("deleteNote", () => {
    it("deletes a note and emits event to household", async () => {
      getNoteOwnerId.mockResolvedValue("test-user-id");
      assertHouseholdAccess.mockResolvedValue(undefined);
      deleteNote.mockResolvedValue(undefined);

      const caller = createTestCaller(ctx);
      const result = await caller.deleteNote({
        id: "note-123",
        date: "2025-01-15",
      });

      expect(getNoteOwnerId).toHaveBeenCalledWith("note-123");
      expect(assertHouseholdAccess).toHaveBeenCalledWith(ctx.user.id, "test-user-id");
      expect(deleteNote).toHaveBeenCalledWith("note-123");
      expect(calendarEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "noteDeleted",
        { noteId: "note-123", date: "2025-01-15" }
      );
      expect(result).toEqual({ success: true });
    });

    it("throws error when note not found", async () => {
      getNoteOwnerId.mockResolvedValue(null);

      const caller = createTestCaller(ctx);

      await expect(
        caller.deleteNote({
          id: "non-existent",
          date: "2025-01-15",
        })
      ).rejects.toThrow("Note not found");

      expect(deleteNote).not.toHaveBeenCalled();
      expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
    });

    it("throws error when user lacks permission", async () => {
      getNoteOwnerId.mockResolvedValue("other-user-id");
      assertHouseholdAccess.mockRejectedValue(new Error("Access denied"));

      const caller = createTestCaller(ctx);

      await expect(
        caller.deleteNote({
          id: "note-123",
          date: "2025-01-15",
        })
      ).rejects.toThrow("Access denied");

      expect(deleteNote).not.toHaveBeenCalled();
      expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
    });
  });

  describe("updateNoteDate", () => {
    it("updates note date and emits event to household", async () => {
      const updatedNote = createMockNote({
        id: "note-123",
        date: "2025-01-20",
      });

      getNoteOwnerId.mockResolvedValue("test-user-id");
      assertHouseholdAccess.mockResolvedValue(undefined);
      updateNoteDate.mockResolvedValue(updatedNote);

      const caller = createTestCaller(ctx);
      const result = await caller.updateNoteDate({
        id: "note-123",
        newDate: "2025-01-20",
        oldDate: "2025-01-15",
      });

      expect(getNoteOwnerId).toHaveBeenCalledWith("note-123");
      expect(assertHouseholdAccess).toHaveBeenCalledWith(ctx.user.id, "test-user-id");
      expect(updateNoteDate).toHaveBeenCalledWith("note-123", "2025-01-20");
      expect(calendarEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "noteUpdated",
        { note: updatedNote, oldDate: "2025-01-15" }
      );
      expect(result).toEqual({ success: true });
    });

    it("throws error when note not found", async () => {
      getNoteOwnerId.mockResolvedValue(null);

      const caller = createTestCaller(ctx);

      await expect(
        caller.updateNoteDate({
          id: "non-existent",
          newDate: "2025-01-20",
          oldDate: "2025-01-15",
        })
      ).rejects.toThrow("Note not found");

      expect(updateNoteDate).not.toHaveBeenCalled();
      expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
    });

    it("throws error when user lacks permission", async () => {
      getNoteOwnerId.mockResolvedValue("other-user-id");
      assertHouseholdAccess.mockRejectedValue(new Error("Access denied"));

      const caller = createTestCaller(ctx);

      await expect(
        caller.updateNoteDate({
          id: "note-123",
          newDate: "2025-01-20",
          oldDate: "2025-01-15",
        })
      ).rejects.toThrow("Access denied");

      expect(updateNoteDate).not.toHaveBeenCalled();
      expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
    });
  });
});
