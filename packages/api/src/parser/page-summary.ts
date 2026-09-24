/**
 * A readable summary of a fetched page for the job monitor: what the renderer
 * handed the parsers, cut down to what decides whether a recipe can be read
 * from it. A challenge page, an empty shell, or JSON-LD that names a recipe
 * the parser still missed are all visible at a glance, which the raw HTML
 * (often megabytes of script) would bury.
 */
import * as cheerio from "cheerio";

import { extractRecipeNodesFromJsonValue } from "@norish/api/parser/jsonld";
import { parseJsonWithRepair } from "@norish/shared/lib/helpers";

/** Enough of the page's text to recognise it, short of the monitor's own cut-off. */
const TEXT_LENGTH = 2000;
const MAX_HEADINGS = 5;
const META_NAMES = ["og:title", "og:type", "og:site_name", "description", "robots"];

export interface PageSummary {
  /** Characters of HTML the renderer returned */
  htmlLength: number;
  title: string | null;
  headings: string[];
  meta: Record<string, string>;
  jsonLd: {
    /** Every block's top-level `@type`s (and those of its `@graph`) */
    types: string[];
    /** The Recipe nodes Norish's own reader finds, as the page wrote them */
    recipes: Record<string, unknown>[];
    /** Blocks that did not parse even after repair */
    unreadable: number;
  };
  /** All of the body's visible text, navigation and banners included */
  text: string;
}

function typesOf(node: unknown): string[] {
  if (typeof node !== "object" || node === null) return [];
  if (Array.isArray(node)) return node.flatMap(typesOf);

  const record = node as Record<string, unknown>;
  const own = record["@type"];
  const types = Array.isArray(own) ? own.map(String) : own === undefined ? [] : [String(own)];

  return [...types, ...typesOf(record["@graph"])];
}

export function summarisePage(html: string): PageSummary {
  const $ = cheerio.load(html);
  const types = new Set<string>();
  const recipes: Record<string, unknown>[] = [];
  let unreadable = 0;

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const value: unknown = parseJsonWithRepair($(element).html() || "");

      for (const type of typesOf(value)) types.add(type);
      recipes.push(...extractRecipeNodesFromJsonValue(value));
    } catch {
      unreadable += 1;
    }
  });

  const meta: Record<string, string> = {};

  for (const name of META_NAMES) {
    const content = $(`meta[property="${name}"], meta[name="${name}"]`).first().attr("content");

    if (content) meta[name] = content.trim();
  }

  const headings = $("h1")
    .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean)
    .slice(0, MAX_HEADINGS);

  $("script, style, noscript, template, svg").remove();
  // Text nodes in adjacent blocks run together without a break between them.
  $("br, p, div, li, h1, h2, h3, h4, h5, h6, tr").after(" ");

  const text = $("body").text().replace(/\s+/g, " ").trim();

  return {
    htmlLength: html.length,
    title: $("title").first().text().trim() || null,
    headings,
    meta,
    jsonLd: { types: [...types], recipes, unreadable },
    text: text.length > TEXT_LENGTH ? `${text.slice(0, TEXT_LENGTH)}…` : text,
  };
}
