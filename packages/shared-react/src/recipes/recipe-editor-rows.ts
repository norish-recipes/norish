import type { UnitsMap } from "@norish/config/zod/server-config";
import type { MeasurementSystem } from "@norish/shared/contracts";
import { formatAmount } from "@norish/shared/lib/format-amount";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
import { deriveStepIngredientAmount, toLineAmount } from "@norish/shared/lib/step-ingredients";

import type { ParsedIngredient, Step, StepImage } from "./recipe-editor";

/** A row starting with `#` is a section heading, not a line or a step. */
export function isHeadingText(text: string): boolean {
  return text.trim().startsWith("#");
}

/** Each row's number counting only non-heading rows; a heading gets null. */
export function rowNumbers(texts: string[]): (number | null)[] {
  let count = 0;

  return texts.map((text) => (isHeadingText(text) ? null : ++count));
}

// ---------------------------------------------------------------------------
// Ingredient rows

/** An ingredient row with a stable id for reordering. */
export interface IngredientRow {
  id: string;
  text: string;
  recipeIngredientId?: string;
  version?: number;
  /** The stored line this row was seeded from, kept while its text is as seeded. */
  seed?: { text: string; line: ParsedIngredient };
}

let nextIngredientRowId = 0;

export function createIngredientRow(
  text: string,
  meta?: Pick<IngredientRow, "recipeIngredientId" | "version" | "seed">
): IngredientRow {
  return { id: `ing-${nextIngredientRowId++}`, text, ...meta };
}

/** The editor's rows for the given lines, plus the empty row to type into. */
export function seedIngredientRows(ingredients: ParsedIngredient[]): IngredientRow[] {
  return [
    ...ingredients.map((ing) => {
      const parts: string[] = [];

      if (ing.amount !== null) parts.push(String(ing.amount));
      if (ing.unit) parts.push(ing.unit);
      if (ing.ingredientName) parts.push(ing.ingredientName);

      const text = parts.join(" ");

      return createIngredientRow(text, {
        recipeIngredientId: ing.id,
        version: ing.version,
        seed: { text, line: ing },
      });
    }),
    createIngredientRow(""),
  ];
}

/** A row's line as Save reads it; null for an empty row. An untouched row is never re-parsed. */
export function parseIngredientRow(
  row: IngredientRow,
  order: number,
  units: UnitsMap,
  systemUsed: MeasurementSystem
): ParsedIngredient | null {
  const trimmed = row.text.trim();

  if (!trimmed) return null;
  if (row.seed && row.text === row.seed.text) return { ...row.seed.line, order, systemUsed };
  const first = parseIngredientWithDefaults(trimmed, units)?.[0];

  return {
    id: row.recipeIngredientId,
    version: row.version,
    ingredientName: first ? first.description || trimmed : trimmed,
    amount: first?.quantity ? Number(first.quantity) : null,
    unit: first ? first.unitOfMeasure || null : null,
    order,
    systemUsed,
  };
}

export function ingredientRowsToLines(
  rows: IngredientRow[],
  units: UnitsMap,
  systemUsed: MeasurementSystem
): ParsedIngredient[] {
  return rows
    .map((row, idx) => parseIngredientRow(row, idx, units, systemUsed))
    .filter((ing): ing is ParsedIngredient => ing !== null);
}

/** The dragged order over `current`: a row can change while held, so each is read by id. */
export function inDraggedOrder<T extends { id: string }>(dragged: T[], current: T[]): T[] {
  const byId = new Map(current.map((row) => [row.id, row]));

  return dragged.map((row) => byId.get(row.id) ?? row);
}

/** The rows after a reorder: empty rows dropped, one empty row to type into at the end. */
export function normalizeIngredientRows(rows: IngredientRow[]): IngredientRow[] {
  return [...rows.filter((row) => row.text.trim().length > 0), createIngredientRow("")];
}

/** The rows with `index` set to `text`; typing in the trailing row grows the list. */
export function typeIngredientRow(
  rows: IngredientRow[],
  index: number,
  text: string
): IngredientRow[] {
  const current = rows[index];

  if (!current) return rows;
  const updated = [...rows];

  updated[index] = { ...current, text };
  if (index === rows.length - 1 && text.trim()) updated.push(createIngredientRow(""));

  return updated;
}

export function hasIngredientContent(row: IngredientRow): boolean {
  return row.text.trim().length > 0;
}

/** The rows once `index` is left: an emptied row goes, unless it is the trailing one to type into. */
export function rowsAfterLeaving<T>(
  rows: T[],
  index: number,
  hasContent: (row: T) => boolean
): T[] {
  const row = rows[index];

  return row && !hasContent(row) && index < rows.length - 1
    ? rows.filter((_, i) => i !== index)
    : rows;
}

/** The rows without `index`, never fewer than the one empty row. */
export function removeIngredientRow(rows: IngredientRow[], index: number): IngredientRow[] {
  const updated = rows.filter((_, i) => i !== index);

  return updated.length === 0 ? [createIngredientRow("")] : updated;
}

/** Where each line went when the rows were reordered or one was removed, by its old order (its
 * index). A removed line maps to null. Null when nothing moved. */
export type LineMoves = ReadonlyMap<number, number | null>;

export function lineMoves(before: IngredientRow[], after: IngredientRow[]): LineMoves | null {
  const index = new Map(after.map((row, i) => [row.id, i]));
  const moves = new Map(before.map((row, i) => [i, index.get(row.id) ?? null]));

  return [...moves].every(([from, to]) => from === to) ? null : moves;
}

/** Step references kept on their lines after a move; one to a removed line goes with it. */
export function remapStepRefs<T extends { ingredientOrder: number }>(
  refs: T[],
  moves: LineMoves
): T[] {
  return refs.flatMap((ref) => {
    const to = moves.has(ref.ingredientOrder)
      ? moves.get(ref.ingredientOrder)
      : ref.ingredientOrder;

    return to == null ? [] : [{ ...ref, ingredientOrder: to }];
  });
}

// ---------------------------------------------------------------------------
// Step rows

/** A chip as the editor holds it: which line, and how much of it. */
export interface StepIngredientDraft {
  ingredientOrder: number;
  share: number;
}

/** A step row with a stable id for reordering. */
export interface StepRow {
  id: string;
  text: string;
  images: StepImage[];
  stepIngredients: StepIngredientDraft[];
  version?: number;
}

let nextStepRowId = 0;

export function createStepRow(
  text: string,
  images: StepImage[] = [],
  version?: number,
  stepIngredients: StepIngredientDraft[] = []
): StepRow {
  return { id: `step-${nextStepRowId++}`, text, images, stepIngredients, version };
}

/** The editor's rows for the given steps, plus the empty row to type into. */
export function seedStepRows(steps: Step[]): StepRow[] {
  return [
    ...steps.map((step) =>
      createStepRow(
        step.step,
        step.images || [],
        step.version,
        [...(step.stepIngredients ?? [])]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((ref) => ({ ingredientOrder: ref.ingredientOrder, share: ref.share }))
      )
    ),
    createStepRow(""),
  ];
}

export function hasStepContent(row: StepRow): boolean {
  return row.text.trim().length > 0 || row.images.length > 0;
}

/** The steps Save sends for the rows; empty rows are dropped. */
export function stepRowsToSteps(rows: StepRow[], systemUsed: MeasurementSystem): Step[] {
  return rows
    .map((row, idx) => ({
      step: row.text.trim(),
      order: idx,
      systemUsed,
      version: row.version,
      images: row.images,
      // A row that became a heading sheds its chips rather than saving links no one sees.
      stepIngredients: isHeadingText(row.text)
        ? []
        : row.stepIngredients.map((ref, refIdx) => ({ ...ref, order: refIdx })),
    }))
    .filter((step) => step.step || step.images.length > 0);
}

/** The rows with each step's references as the form holds them: the form owns them, so after
 * lines move the rows take them back however many moves one render brought. */
export function withStepRefsOf(rows: StepRow[], steps: Step[]): StepRow[] {
  let next = 0;

  return rows.map((row) => {
    const step = hasStepContent(row) ? steps[next++] : undefined;

    return step
      ? {
          ...row,
          stepIngredients: [...(step.stepIngredients ?? [])]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((ref) => ({ ingredientOrder: ref.ingredientOrder, share: ref.share })),
        }
      : row;
  });
}

export function normalizeStepRows(rows: StepRow[]): StepRow[] {
  return [...rows.filter(hasStepContent), createStepRow("")];
}

export function typeStepRow(rows: StepRow[], index: number, text: string): StepRow[] {
  const current = rows[index];

  if (!current) return rows;
  const updated = [...rows];

  updated[index] = { ...current, text };
  if (index === rows.length - 1 && text.trim()) updated.push(createStepRow(""));

  return updated;
}

export function removeStepRow(rows: StepRow[], index: number): StepRow[] {
  const updated = rows.filter((_, i) => i !== index);

  return updated.length === 0 ? [createStepRow("")] : updated;
}

/** A line the `@` popup offers: the line's name, keyed by its order. */
export interface IngredientSuggestion {
  key: string;
  label: string;
  ingredientOrder: number;
}

/** The lines a step's chips may use: the active system's, as amounts are read in its units. */
export function chipLinesOf<T extends { systemUsed: MeasurementSystem }>(
  ingredients: T[],
  systemUsed: MeasurementSystem
): T[] {
  return ingredients.filter((ingredient) => ingredient.systemUsed === systemUsed);
}

export function ingredientSuggestionsOf(
  lines: { ingredientName: string; order: number }[]
): IngredientSuggestion[] {
  return lines
    .filter((line) => !isHeadingText(line.ingredientName))
    .map((line) => ({
      key: `${line.order}`,
      label: line.ingredientName,
      ingredientOrder: line.order,
    }));
}

/** The `@` mention: the word lands in the step's text and its chip attaches at the full share.
 * `asksAmount` says whether the new chip should ask how much of an amounted line the step uses. */
export function mentionIngredient(
  rows: StepRow[],
  index: number,
  suggestion: IngredientSuggestion,
  newText: string,
  lines: { order: number; amount?: number | string | null }[]
): { rows: StepRow[]; asksAmount: boolean } {
  const target = rows[index];

  if (!target) return { rows, asksAmount: false };
  const updated = [...rows];
  const alreadyAttached = target.stepIngredients.some(
    (ref) => ref.ingredientOrder === suggestion.ingredientOrder
  );

  updated[index] = {
    ...target,
    text: newText,
    stepIngredients: alreadyAttached
      ? target.stepIngredients
      : [...target.stepIngredients, { ingredientOrder: suggestion.ingredientOrder, share: 1 }],
  };
  if (index === rows.length - 1 && newText.trim()) updated.push(createStepRow(""));

  const line = lines.find((candidate) => candidate.order === suggestion.ingredientOrder);
  const asksAmount =
    !alreadyAttached &&
    !isHeadingText(newText) &&
    line != null &&
    toLineAmount(line.amount) != null;

  return { rows: updated, asksAmount };
}

/** A chip using the whole line is the bare name; part of an amounted line reads as the derived
 * amount ("2.5 g salt"), and only an amountless line falls back to the fraction. */
export function stepChipLabel(
  line: { ingredientName: string; amount?: number | string | null; unit?: string | null },
  share: number
): string {
  if (Math.abs(share - 1) < 0.0001) return line.ingredientName;
  const lineAmount = toLineAmount(line.amount);

  if (lineAmount == null) return `${formatAmount(share, "fraction")} × ${line.ingredientName}`;

  return [
    formatAmount(deriveStepIngredientAmount(lineAmount, share), "decimal"),
    line.unit ?? "",
    line.ingredientName,
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------------
// The `@` and `/` triggers in a text field

export type TriggerMatch = { query: string; triggerStart: number; cursorPosition: number };

/** An `@` before the caret that starts a word, with what was typed after it. */
export function ingredientTriggerAt(value: string, cursorPosition: number): TriggerMatch | null {
  const before = value.slice(0, cursorPosition);
  const triggerStart = before.lastIndexOf("@");

  if (triggerStart === -1) return null;
  const previousChar = triggerStart > 0 ? before.charAt(triggerStart - 1) : "";

  if (/[A-Za-z0-9_]/.test(previousChar)) return null;
  const query = before.slice(triggerStart + 1);

  if (query.includes("\n") || query.includes("{") || query.includes("}")) return null;

  return { query, triggerStart, cursorPosition };
}

/** A `/` before the caret after a space or a line start, with at least one character after it. */
export function recipeTriggerAt(value: string, cursorPosition: number): TriggerMatch | null {
  const before = value.slice(0, cursorPosition);
  const triggerStart = before.lastIndexOf("/");

  if (triggerStart === -1) return null;
  const previousChar = triggerStart > 0 ? before[triggerStart - 1] : " ";

  if (!(previousChar === " " || previousChar === "\n" || triggerStart === 0)) return null;
  const query = before.slice(triggerStart + 1);

  if (query.length < 1 || query.includes("\n")) return null;

  return { query, triggerStart, cursorPosition };
}

/** The suggestions an `@` query matches, at most eight. */
export function matchIngredientSuggestions(
  suggestions: IngredientSuggestion[],
  query: string
): IngredientSuggestion[] {
  const needle = query.trim().toLowerCase();

  return suggestions
    .filter((suggestion) => suggestion.label.toLowerCase().includes(needle))
    .slice(0, 8);
}

/** The text with the trigger and its query replaced, and where the caret goes after it. */
export function replaceTrigger(
  value: string,
  match: TriggerMatch,
  insert: string
): { text: string; caret: number } {
  const before = value.slice(0, match.triggerStart);

  return {
    text: `${before}${insert}${value.slice(match.cursorPosition)}`,
    caret: before.length + insert.length,
  };
}
