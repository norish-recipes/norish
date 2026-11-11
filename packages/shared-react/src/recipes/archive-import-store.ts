import { create } from "zustand";

import type { ArchiveImportError, ArchiveImportNote } from "@norish/shared/contracts/uploads";

type Counts = { current: number; total: number; imported: number; errors: ArchiveImportError[] };

export type ArchiveImport = Counts & {
  notes: ArchiveImportNote[];
  isImporting: boolean;
};

interface ArchiveImportState extends ArchiveImport {
  /** The server took the archive and will import `total` recipes. */
  started: (total: number) => void;
  /** A progress event: the counts so far and the errors since the last one. */
  progressed: (progress: Counts) => void;
  /** The import ended with what it imported, its notes and its errors. */
  completed: (outcome: Pick<ArchiveImport, "imported" | "notes" | "errors">) => void;
  clear: () => void;
}

const IDLE: ArchiveImport = {
  current: 0,
  total: 0,
  imported: 0,
  notes: [],
  isImporting: false,
  errors: [],
};

/** The Reader's Recipe Archive import. Global, since it runs on while they are elsewhere. */
export const useArchiveImport = create<ArchiveImportState>()((set) => ({
  ...IDLE,
  started: (total) => set({ ...IDLE, total, isImporting: true }),
  progressed: ({ current, total, imported, errors }) =>
    set((prev) =>
      prev.isImporting
        ? { current, imported, errors: [...prev.errors, ...errors] }
        : { ...IDLE, current, total, imported, errors, isImporting: true }
    ),
  // Without a running import's start (a reload, or one begun elsewhere) the outcome is its own total.
  completed: ({ imported, notes, errors }) =>
    set((prev) => {
      const total = prev.isImporting ? prev.total : imported + errors.length;

      return { current: total, total, imported, notes, errors, isImporting: false };
    }),
  clear: () => set(IDLE),
}));
