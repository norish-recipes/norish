/**
 * @deprecated Legacy rollback parser helpers kept only for `LEGACY_RECIPE_PARSER_ROLLBACK`.
 * JSON-LD helpers: scan HTML, collect structured data, and return Recipe nodes.
 */
import * as cheerio from "cheerio";

import { normalizeRecipeFromJson } from "@norish/api/parser/normalize";
import { parserLogger as log } from "@norish/shared-server/logger";
import { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { parseJsonWithRepair } from "@norish/shared/lib/helpers";

import { extractImageCandidates } from "./parsers";

function hasImage(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;

  const imageField = (node as { image?: unknown }).image;

  if (typeof imageField === "string") return imageField.trim().length > 0;
  if (Array.isArray(imageField)) return imageField.length > 0;
  if (imageField && typeof imageField === "object") return true;

  return false;
}

function isRecipeNode(node: any): boolean {
  if (!node || typeof node !== "object") return false;

  const typeField = (node["@type"] ?? node.type) as unknown;

  if (Array.isArray(typeField)) return typeField.some((v) => String(v).toLowerCase() === "recipe");

  if (typeof typeField === "string") return typeField.toLowerCase() === "recipe";

  return false;
}

function collectRecipeNodesFromJsonGraph(rootNode: any): any[] {
  const results: any[] = [];
  const containerKeys = [
    "@graph",
    "graph",
    "mainEntity",
    "itemListElement",
    "item",
    "items",
    "@list",
    "hasPart",
    "isPartOf",
  ];

  const visit = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);

      return;
    }

    if (typeof node === "object") {
      if (isRecipeNode(node)) results.push(node);

      for (const key of containerKeys) {
        if (key in node) visit((node as any)[key]);
      }

      for (const value of Object.values(node)) {
        if (value && (typeof value === "object" || Array.isArray(value))) visit(value);
      }
    }
  };

  visit(rootNode);

  return results;
}

export function extractRecipeNodesFromJsonValue(input: unknown): Record<string, unknown>[] {
  const rootNodes = Array.isArray(input) ? input : [input];
  const recipeNodes: Record<string, unknown>[] = [];

  for (const root of rootNodes) {
    recipeNodes.push(...collectRecipeNodesFromJsonGraph(root));
  }

  const seenKeys = new Set<string>();

  return recipeNodes.filter((node) => {
    const dedupeKey =
      (typeof node["@id"] === "string" && node["@id"].trim()) ||
      `${typeof node.name === "string" ? node.name : ""}|${typeof node.url === "string" ? node.url : ""}` ||
      JSON.stringify(node).slice(0, 200);

    if (seenKeys.has(dedupeKey)) return false;

    seenKeys.add(dedupeKey);

    return true;
  });
}

export function extractRecipeNodesFromJsonLd(htmlContent: string) {
  const $ = cheerio.load(htmlContent);

  const recipeNodes: any[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const scriptContent = $(element).html() || "{}";
      const parsedJson = parseJsonWithRepair(scriptContent);

      recipeNodes.push(...extractRecipeNodesFromJsonValue(parsedJson));
    } catch (parseErr) {
      // JSON-LD parsing can fail on malformed data, log but continue
      log.error({ err: parseErr }, "Failed to parse JSON-LD script");
    }
  });

  return recipeNodes;
}

export async function tryExtractRecipeFromJsonLd(
  url: string,
  htmlContent: string,
  recipeId: string
): Promise<FullRecipeInsertDTO | null> {
  const nodes = extractRecipeNodesFromJsonLd(htmlContent);

  if (!nodes || nodes.length === 0) return null;

  const firstNode = nodes[0] as Record<string, unknown>;

  if (!hasImage(firstNode)) {
    const candidates = extractImageCandidates(htmlContent, url);

    if (candidates.length > 0) {
      firstNode.image = candidates;
    }
  }

  const parsed = await normalizeRecipeFromJson(firstNode, recipeId);

  parsed && (parsed.url = url);

  return parsed;
}
