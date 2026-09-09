/**
 * How a shop says it is searched, read off its own homepage: an OpenSearch
 * descriptor, a form marked as search, and only then a form matched against
 * words. Pure readers — HTML or XML in, a Search Address out; the visits that
 * fetch those pages live in `store-search.ts`, and the products a results
 * page offers are read in `store-page.ts`.
 */
import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import * as cheerio from "cheerio";

import type { SearchAddressReading } from "@norish/shared/contracts";
import { SEARCH_ADDRESS_PLACEHOLDER } from "@norish/shared/lib/search-address";

import { resolveUrl } from "./store-page";

/** A selection of one element, as cheerio hands it back. */
type CheerioNode = Cheerio<AnyNode>;

/**
 * Search words in the fourteen locales Norish ships, plus the parameter names
 * every framework writes. This is the **last** rung of discovery and never
 * the first: a shop searches in a word this list does not have, and the rungs
 * above it — an OpenSearch descriptor, `role="search"`, `type="search"` —
 * read no words at all.
 */
const SEARCH_WORDS = [
  "q",
  "s",
  "k",
  "query",
  "term",
  "keyword",
  "keywords",
  "search",
  "searchterm",
  "zoek",
  "zoeken",
  "zoekterm",
  "suche",
  "suchen",
  "suchbegriff",
  "recherche",
  "rechercher",
  "buscar",
  "busqueda",
  "búsqueda",
  "cerca",
  "ricerca",
  "busca",
  "pesquisa",
  "soeg",
  "søg",
  "sog",
  "sok",
  "søk",
  "szukaj",
  "szukanie",
  "wyszukiwarka",
  "poisk",
  "поиск",
  "tarsene",
  "търсене",
  "검색",
  "검색어",
];

const TEXT_INPUT_TYPES = new Set(["text", "search", ""]);
const TERM_MARK = "__norish_query__";

function formAddress(
  $: cheerio.CheerioAPI,
  form: CheerioNode,
  termName: string,
  pageUrl: string
): string | null {
  const action = resolveUrl(form.attr("action") ?? "", pageUrl) ?? pageUrl;
  const address = new URL(action);

  form.find("input").each((_, element) => {
    const input = $(element);
    const type = (input.attr("type") ?? "").trim().toLowerCase();
    const name = input.attr("name");

    if (type === "hidden" && name) address.searchParams.set(name, input.attr("value") ?? "");
  });
  address.searchParams.set(termName, TERM_MARK);

  return address.href.replace(TERM_MARK, SEARCH_ADDRESS_PLACEHOLDER);
}

function termInputName($: cheerio.CheerioAPI, form: CheerioNode): string | null {
  const typed = form.find('input[type="search"][name]').first().attr("name");

  if (typed) return typed;
  const inputs = form
    .find("input")
    .toArray()
    .map((element) => $(element))
    .filter((input) => TEXT_INPUT_TYPES.has((input.attr("type") ?? "").trim().toLowerCase()));

  return inputs.length === 1 ? (inputs[0]?.attr("name") ?? null) : null;
}

/**
 * What a homepage states about how it is searched, in three rungs: an
 * OpenSearch descriptor, whose template names its own slot; a form marked as
 * search, whose input name is taken whatever language it is in; and only
 * then a form matched against words, which is the rung that is wrong
 * everywhere it has not been extended.
 */
export function readSearchAddressFromPage(
  html: string,
  pageUrl: string
): SearchAddressReading | null {
  if (!html.trim()) return null;
  const $ = cheerio.load(html);
  const descriptor = $('link[rel~="search"][type="application/opensearchdescription+xml"]').first();
  const descriptionUrl =
    descriptor.length > 0 ? resolveUrl(descriptor.attr("href"), pageUrl) : null;

  if (descriptionUrl) return { kind: "opensearch", descriptionUrl };

  const forms = $("form")
    .toArray()
    .map((element) => $(element) as unknown as CheerioNode)
    .filter((form) => (form.attr("method") ?? "get").trim().toLowerCase() === "get");
  const marked = forms.filter(
    (form) =>
      (form.attr("role") ?? "").trim().toLowerCase() === "search" ||
      form.find('input[type="search"]').length > 0
  );

  for (const form of marked) {
    const name = termInputName($, form);
    const address = name ? formAddress($, form, name, pageUrl) : null;

    if (address) return { kind: "form", searchAddress: address };
  }

  for (const form of forms) {
    // Whole segments only: `action.includes("s")` would make a search form of
    // every `/products` and `/newsletter` on the web.
    const actionWords = (form.attr("action") ?? "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    const named = form
      .find("input[name]")
      .toArray()
      .map((element) => $(element).attr("name") ?? "")
      .find((name) => SEARCH_WORDS.includes(name.toLowerCase()));
    const byAction = actionWords.some((word) => SEARCH_WORDS.includes(word));
    const name = named ?? (byAction ? termInputName($, form) : null);
    const address = name ? formAddress($, form, name, pageUrl) : null;

    if (address) return { kind: "form", searchAddress: address };
  }

  return null;
}

/** The html search template an OpenSearch description declares, as a Search Address. */
export function readOpenSearchTemplate(xml: string, descriptionUrl: string): string | null {
  const $ = cheerio.load(xml, { xml: true });
  let template: string | null = null;

  $("Url").each((_, element) => {
    if (template) return;
    const url = $(element);
    const type = (url.attr("type") ?? "").toLowerCase();
    const method = (url.attr("method") ?? "get").toLowerCase();
    const raw = url.attr("template");

    if (type !== "text/html" || method !== "get" || !raw) return;
    template = raw;
  });

  if (template === null) return null;
  // Everything optional but the term is left out — `{startPage?}` and its kind
  // would otherwise survive into the address as literal braces — and a template
  // that requires something Norish cannot fill is not an address at all.
  const withMark = (template as string)
    .replace(/\{searchTerms\??\}/g, TERM_MARK)
    .replace(/([?&])[^&=]+=\{[^}]*\?\}(&|$)/g, (_, lead: string, tail: string) =>
      tail ? lead : ""
    )
    .replace(/[?&]$/, "");

  if (/\{[^}]+\}/.test(withMark)) return null;
  const resolved = resolveUrl(withMark, descriptionUrl);

  return resolved ? resolved.replace(TERM_MARK, SEARCH_ADDRESS_PLACEHOLDER) : null;
}
