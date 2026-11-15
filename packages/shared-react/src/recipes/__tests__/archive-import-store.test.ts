import { beforeEach, describe, expect, it } from "vitest";

import { useArchiveImport } from "@norish/shared-react/recipes";

const archive = () => useArchiveImport.getState();
const error = (file: string) => ({ file, error: "unreadable" });

describe("useArchiveImport", () => {
  beforeEach(() => archive().clear());

  it("starts idle", () => {
    expect(useArchiveImport.getInitialState()).toMatchObject({
      current: 0,
      total: 0,
      imported: 0,
      notes: [],
      errors: [],
      isImporting: false,
    });
  });

  it("reads an outcome with no progress before it as complete with its counts", () => {
    archive().completed({ imported: 3, notes: [], errors: [error("a.json")] });

    expect(archive()).toMatchObject({ current: 4, total: 4, imported: 3, isImporting: false });
  });

  it("follows the progress, then holds the outcome", () => {
    archive().started(5);
    archive().progressed({ current: 2, total: 5, imported: 1, errors: [error("a.json")] });
    archive().progressed({ current: 4, total: 5, imported: 3, errors: [error("b.json")] });

    expect(archive()).toMatchObject({
      current: 4,
      total: 5,
      imported: 3,
      errors: [error("a.json"), error("b.json")],
      isImporting: true,
    });

    const notes = [{ file: "c.json", note: "dropped a video" }];

    archive().completed({ imported: 4, notes, errors: [error("a.json")] });

    expect(archive()).toMatchObject({
      current: 5,
      total: 5,
      imported: 4,
      notes,
      errors: [error("a.json")],
      isImporting: false,
    });
  });

  it("counts an outcome it saw no progress of by itself, not by an earlier import's total", () => {
    archive().started(10);
    archive().completed({ imported: 10, notes: [], errors: [] });

    archive().completed({ imported: 2, notes: [], errors: [error("a.json")] });

    expect(archive()).toMatchObject({ current: 3, total: 3, imported: 2, isImporting: false });
  });

  it("picks up an import it saw no start of from its progress", () => {
    archive().progressed({ current: 1, total: 3, imported: 1, errors: [] });

    expect(archive()).toMatchObject({ current: 1, total: 3, imported: 1, isImporting: true });
  });

  it("starts a new import fresh", () => {
    archive().started(5);
    archive().completed({ imported: 3, notes: [], errors: [error("a.json")] });
    archive().clear();
    archive().started(2);

    expect(archive()).toMatchObject({
      current: 0,
      total: 2,
      imported: 0,
      notes: [],
      errors: [],
      isImporting: true,
    });
  });
});
