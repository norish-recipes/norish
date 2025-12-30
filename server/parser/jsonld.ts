/** JSON-LD helpers: scan HTML, collect structured data, and return Recipe nodes. */
import * as cheerio from "cheerio";

import { parseJsonWithRepair } from "@/lib/helpers";
import { normalizeRecipeFromJson } from "@/server/parser/normalize";
import { FullRecipeInsertDTO } from "@/types/dto/recipe";
import { parserLogger as log } from "@/server/logger";

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

export function extractRecipeNodesFromJsonLd(htmlContent: string) {
  const $ = cheerio.load(htmlContent);

  const recipeNodes: any[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const scriptContent = $(element).html() || "{}";
      const parsedJson = parseJsonWithRepair(scriptContent);

      const rootNodes = Array.isArray(parsedJson) ? parsedJson : [parsedJson];

      for (const root of rootNodes) {
        recipeNodes.push(...collectRecipeNodesFromJsonGraph(root));
      }
    } catch (parseErr) {
      // JSON-LD parsing can fail on malformed data, log but continue
      log.error({ err: parseErr }, "Failed to parse JSON-LD script");
    }
  });

  const seenKeys = new Set<string>();
  const uniqueRecipeNodes = recipeNodes.filter((node) => {
    const dedupeKey =
      node["@id"] || `${node.name || ""}|${node.url || ""}` || JSON.stringify(node).slice(0, 200);

    if (seenKeys.has(dedupeKey)) return false;

    seenKeys.add(dedupeKey);

    return true;
  });

  return uniqueRecipeNodes;
}

export async function tryExtractRecipeFromJsonLd(
  url: string,
  htmlContent: string
): Promise<FullRecipeInsertDTO | null> {
  const nodes = extractRecipeNodesFromJsonLd(htmlContent);

  if (!nodes || nodes.length === 0) return null;

  const parsed = await normalizeRecipeFromJson(nodes[0]);

  parsed && (parsed.url = url);

  return parsed;
}
