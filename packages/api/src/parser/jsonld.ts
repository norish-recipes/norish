/**
 * JSON-LD helpers: scan HTML, collect structured data, and return Recipe nodes.
 */
import * as cheerio from "cheerio";

import { parserLogger as log } from "@norish/shared-server/logger";
import { parseJsonWithRepair } from "@norish/shared/lib/helpers";

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
