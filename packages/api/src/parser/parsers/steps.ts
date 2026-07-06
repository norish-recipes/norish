/**
 * Steps/instructions parsing for JSON-LD recipe normalization.
 *
 * Handles Schema.org HowToStep, HowToSection, HowToDirection, and ListItem structures.
 * Extracts section headings as `# Section Name` format for frontend rendering.
 */

import { decode } from "html-entities";

import type { MeasurementSystem } from "@norish/shared/contracts/dto/recipe";

export interface ParsedStep {
  step: string;
  systemUsed: MeasurementSystem;
  order: number;
}

/**
 * Determine the @type of a JSON-LD node (case-insensitive).
 */
function getNodeType(node: Record<string, unknown>): string {
  const typeField = node["@type"] ?? node.type;

  if (Array.isArray(typeField)) {
    return typeField.map((v) => String(v).toLowerCase()).join(",");
  }

  return typeof typeField === "string" ? typeField.toLowerCase() : "";
}

/**
 * Check if a node type indicates a step-like element.
 */
function isStepType(type: string): boolean {
  return type.includes("howtostep") || type.includes("howtodirection") || type.includes("listitem");
}

/**
 * Check if a node type indicates a section/group element.
 */
function isSectionType(type: string): boolean {
  return type.includes("howtosection");
}

/**
 * Extract text content from a node, checking text and name fields.
 *
 * For HowToStep nodes with both name and text, combines them as:
 * "**Name:** Text content" to render the step name as bold.
 *
 * Examples:
 * - { name: "Prep", text: "Chop vegetables" } => "**Prep:** Chop vegetables"
 * - { text: "Mix ingredients" } => "Mix ingredients"
 * - { name: "Roll" } => "Roll"
 */
function extractTextFromNode(node: Record<string, unknown>): string | null {
  // Check for nested item object
  const item =
    node.item && typeof node.item === "object" ? (node.item as Record<string, unknown>) : undefined;

  // Extract and trim text field (convert empty strings to undefined)
  const rawText =
    typeof node.text === "string"
      ? decode(node.text).trim()
      : item && typeof item.text === "string"
        ? decode(item.text).trim()
        : undefined;
  const text = rawText || undefined;

  // Extract and trim name field (convert empty strings to undefined)
  const rawName =
    typeof node.name === "string"
      ? decode(node.name).trim()
      : item && typeof item.name === "string"
        ? decode(item.name).trim()
        : undefined;
  const name = rawName || undefined;

  // If both name and text exist (non-empty), combine as "**Name:** Text"
  if (name && text) {
    return `**${name}:** ${text}`;
  }

  // Otherwise return whichever one exists (text preferred over name)
  return text ?? name ?? null;
}

/**
 * Collect all steps from JSON-LD recipeInstructions.
 *
 * This function recursively traverses the instruction structure, handling:
 * - Plain strings
 * - Arrays of instructions
 * - HowToStep objects
 * - HowToSection objects (extracted as `# Section Name` headings)
 * - HowToDirection objects
 * - ListItem objects
 * - Nested itemListElement and item properties
 *
 * @param node - The recipeInstructions node from JSON-LD
 * @returns Array of raw step strings (including heading strings prefixed with #)
 */
export function collectSteps(node: unknown): string[] {
  const rawSteps: string[] = [];

  const visit = (current: unknown): void => {
    if (!current) return;

    // Handle plain strings
    if (typeof current === "string") {
      const s = decode(current).trim();

      if (s) rawSteps.push(s);

      return;
    }

    // Handle arrays
    if (Array.isArray(current)) {
      current.forEach(visit);

      return;
    }

    // Handle objects
    if (typeof current === "object") {
      const obj = current as Record<string, unknown>;
      const type = getNodeType(obj);

      // Check if this is a section with a name - extract as heading
      if (isSectionType(type)) {
        const sectionName = typeof obj.name === "string" ? decode(obj.name).trim() : null;

        // Add section name as a heading (prefixed with #)
        if (sectionName) {
          rawSteps.push(`# ${sectionName}`);
        }

        // Continue to process children (itemListElement, etc.)
        if (obj.itemListElement) visit(obj.itemListElement);
        if (obj.item) visit(obj.item);

        return;
      }

      // Extract text content from the node
      const text = extractTextFromNode(obj);

      if (text) {
        // Only push as a step if it's a step-like type OR has no nested content
        if (isStepType(type) || (!obj.itemListElement && !obj.item)) {
          rawSteps.push(text);
        }
      }

      // Recurse into nested structures
      if (obj.itemListElement) visit(obj.itemListElement);
      if (obj.item) visit(obj.item);
    }
  };

  visit(node);

  return rawSteps;
}

/**
 * Deduplicate steps while preserving order.
 *
 * Removes exact duplicates (case-insensitive comparison) while maintaining
 * the original order of first occurrence. Headings (starting with #) are
 * never deduplicated as they may legitimately repeat.
 *
 * @param rawSteps - Array of raw step strings
 * @returns Deduplicated array
 */
export function deduplicateSteps(rawSteps: string[]): string[] {
  const seenSteps = new Set<string>();

  return rawSteps.filter((s) => {
    const trimmed = s?.trim();

    if (!trimmed) return false;

    // Don't deduplicate headings - they're structural
    if (trimmed.startsWith("#")) return true;

    const key = trimmed.toLowerCase();

    if (seenSteps.has(key)) return false;

    seenSteps.add(key);

    return true;
  });
}

/**
 * Parse recipe instructions from JSON-LD into normalized step objects.
 *
 * @param recipeInstructions - The recipeInstructions field from JSON-LD
 * @param systemUsed - The measurement system to assign to steps
 * @returns Array of parsed step objects with order
 */
export function parseSteps(
  recipeInstructions: unknown,
  systemUsed: MeasurementSystem
): ParsedStep[] {
  const rawSteps = collectSteps(recipeInstructions);
  const deduplicated = deduplicateSteps(rawSteps);

  return deduplicated.map((text, i) => ({
    step: text,
    systemUsed,
    order: i + 1,
  }));
}
