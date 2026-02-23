/**
 * Mock for @norish/db/repositories/notes
 */
import { vi } from "vitest";

export const listNotesByUsersAndRange = vi.fn();
export const createNote = vi.fn();
export const deleteNote = vi.fn();
export const updateNoteDate = vi.fn();
export const getNoteOwnerId = vi.fn();
export const getNoteViewById = vi.fn();

export function resetNotesMocks() {
  listNotesByUsersAndRange.mockReset();
  createNote.mockReset();
  deleteNote.mockReset();
  updateNoteDate.mockReset();
  getNoteOwnerId.mockReset();
  getNoteViewById.mockReset();
}
