/**
 * The store page reader: HTML and its address in, products out. There is no
 * model behind it and no per-shop condition inside it. A supermarket results
 * page is a list already marked up for a search engine, and where the markup
 * is thin the price still sits in an attribute waiting to be read, so the
 * reader is a fixed ladder over what a page states: `ItemList` JSON-LD for
 * the complete list of names and addresses, a DOM pass over the product
 * anchors for the prices, merged on address. See ADR-0028.
 */
import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import * as cheerio from "cheerio";

import type { ProductReading, StoreCandidate } from "@norish/shared/contracts";
import type { PackSize } from "@norish/shared/lib/pack-size";
import { currencyForUrl } from "@norish/shared/lib/currency";
import { parseJsonWithRepair } from "@norish/shared/lib/helpers";
import { packSizeFromCode, readPackSize } from "@norish/shared/lib/pack-size";
import { saleRegularPrice } from "@norish/shared/lib/sale";
import { resolveUnit, unitLabel } from "@norish/shared/lib/units";

export type { ProductReading, StoreCandidate };
export { currencyForUrl } from "@norish/shared/lib/currency";

/** A selection of one element, as cheerio hands it back. */
type CheerioNode = Cheerio<AnyNode>;

type Node = Record<string, unknown>;

function isObject(value: unknown): value is Node {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];

  return Array.isArray(value) ? value : [value];
}

/**
 * A property of a JSON-LD node, whatever case the shop wrote it in. Dirk
 * writes `"Price": 7.99` inside `offers`, which schema.org does not sanction
 * and which the same site does not do on its results page; a spec-faithful
 * reader finds no price on any Dirk product page (ADR-0028).
 */
function prop(node: Node, name: string): unknown {
  const wanted = name.toLowerCase();

  for (const [key, value] of Object.entries(node)) {
    if (key.toLowerCase() === wanted) return value;
  }

  return undefined;
}

function typeOf(node: Node): string[] {
  return asArray(prop(node, "@type") as string | string[] | undefined).map((value) =>
    String(value)
      .replace(/^https?:\/\/schema\.org\//i, "")
      .toLowerCase()
  );
}

function hasType(node: Node, ...types: string[]): boolean {
  const own = typeOf(node);

  return types.some((type) => own.includes(type.toLowerCase()));
}

function readText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (isObject(value)) {
    const name = prop(value, "name");

    if (typeof name === "string") return name.trim() || null;
    const literal = prop(value, "@value");

    if (typeof literal === "string") return literal.trim() || null;
  }

  return null;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * A price as a page writes it: `1.29`, `"1,29"`, `"€ 2,99"`, `"1.234,56"`. A
 * comma is the decimal mark unless a dot already sits behind two digits.
 */
export function parsePriceText(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/[^\d.,]/g, "");

  if (!cleaned) return null;
  const normalized =
    cleaned.includes(",") && !/\.\d{1,2}$/.test(cleaned)
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "£": "GBP",
  $: "USD",
  "₽": "RUB",
  "₩": "KRW",
  zł: "PLN",
  kr: "SEK",
};
const CURRENCY_CODES = new Set([
  "EUR",
  "GBP",
  "USD",
  "CHF",
  "DKK",
  "NOK",
  "SEK",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "BGN",
  "RUB",
  "KRW",
  "JPY",
  "CAD",
  "AUD",
  "NZD",
  "BRL",
]);

function currencyCode(value: unknown): string | null {
  const raw = readText(value);

  if (!raw) return null;
  const code = raw.toUpperCase();

  return CURRENCY_CODES.has(code) ? code : (CURRENCY_SYMBOLS[raw] ?? null);
}

/**
 * The marks a shop writes a price with, wherever the price sits beside them.
 * `kr` is what three countries call their crown; which one is told by the
 * shop's own address where the mark alone cannot say.
 */
const CURRENCY_MARK = "€|£|\\$|₽|₩|zł|kr\\.?(?![a-z])";
/** `2,99`, `1.234,56`, and `2,-` — a whole amount with its cents written as a dash. */
const AMOUNT = "\\d{1,6}(?:[.,]\\d{3})*(?:[.,]\\d{2}|[.,]-)";
const MONEY_BEFORE = new RegExp(`(${CURRENCY_MARK}|\\b[A-Z]{3}\\b)\\s?(${AMOUNT})(?!\\d)`, "g");
const MONEY_AFTER = new RegExp(`(?<![\\d.,])(${AMOUNT})\\s?(${CURRENCY_MARK}|\\b[A-Z]{3}\\b)`, "g");
/**
 * A price per weight or volume rather than per pack: `€ 19,93 / kg`, `€ 1,99
 * per 100 g`. Beside a pack price it is the comparison number Norish does not
 * show; as a card's only price it is what a kilo of something sold loose
 * costs, and that is its Shelf Price (ADR-0029). "Per stuk" — per piece — is
 * the pack price and is neither: the unit table says which words are a
 * weight or a volume, so no list of them lives here.
 */
const PER_UNIT =
  /^\s*((?:\/|per|pro|par|por|al|za|pr\.?|à)\s*(?:\d+\s*)?(\p{L}+(?: \p{L}+)?))\b\.?/iu;
const KRONER = new Set(["DKK", "NOK", "SEK"]);

/** The unit of sale stated right after a price, as the shop words it, or null for a pack price. */
function perUnitAfter(value: string, end: number): string | null {
  const match = PER_UNIT.exec(value.slice(end));
  const family = resolveUnit(match?.[2])?.family;

  if (!match || (family !== "mass" && family !== "volume")) return null;

  // A slash is the shop's shorthand; a shopper reads it as "per".
  return collapse(match[1] ?? "").replace(/^\/\s*/, "per ");
}

function markedCurrency(mark: string, near: string | null | undefined): string | null {
  const code = currencyCode(mark.replace(/\.$/, ""));

  if (code === "SEK" && near && KRONER.has(near)) return near;

  return code;
}

/** A price as a piece of text states it, and the unit of sale beside it if the shop names one. */
export interface PriceInText {
  price: number;
  currency: string;
  /** "per kg", "per 100 gram": the price is for that much of something sold loose. */
  perUnit?: string;
}

/**
 * Every price a piece of text states with its currency, in the order it
 * states them, each with the unit of sale that follows it if any. `near` is
 * what the shop's own address implies it charges in, which only matters for
 * a mark three countries share.
 */
export function readPricesInText(value: string, near?: string | null): PriceInText[] {
  const found: { at: number; reading: PriceInText }[] = [];
  const claimed = new Set<number>();

  for (const match of value.matchAll(MONEY_BEFORE)) {
    const currency = markedCurrency(match[1] ?? "", near);
    const price = parsePriceText(match[2]);

    if (!currency || price === null) continue;
    const perUnit = perUnitAfter(value, match.index + match[0].length);

    claimed.add(match.index);
    found.push({ at: match.index, reading: { price, currency, ...(perUnit ? { perUnit } : {}) } });
  }
  for (const match of value.matchAll(MONEY_AFTER)) {
    const currency = markedCurrency(match[2] ?? "", near);
    const price = parsePriceText(match[1]);

    // `€ 2,99 €` would be one price read twice; the mark before it claimed it.
    if (!currency || price === null || [...claimed].some((at) => Math.abs(at - match.index) < 4)) {
      continue;
    }
    const perUnit = perUnitAfter(value, match.index + match[0].length);

    found.push({ at: match.index, reading: { price, currency, ...(perUnit ? { perUnit } : {}) } });
  }

  return found.sort((a, b) => a.at - b.at).map((entry) => entry.reading);
}

/**
 * The price a piece of text charges: the first it states for a pack, or,
 * where it states prices per kilo and nothing else, the first of those —
 * that is something sold loose, and its Shelf Price is what a kilo costs.
 * Nothing without a currency.
 */
export function readPriceInText(value: string, near?: string | null): PriceInText | null {
  const prices = readPricesInText(value, near);

  return prices.find((reading) => !reading.perUnit) ?? prices[0] ?? null;
}

/** Elements whose text is not the product's: scripts, and a price struck through. */
const NOT_THE_PRICE = new Set(["script", "style", "template"]);
/** A price struck through by its element, or by the class a shop styles it with. */
const STRUCK_TAGS = new Set(["del", "s", "strike"]);
const STRUCK_CLASS = /regular|original|old-?price|strike|was-?price|previous|before-?price/i;

function classOf(node: AnyNode): string {
  return node.type === "tag" ? (node.attribs.class ?? "") : "";
}

/** Whether an element is a price the shop shows struck through: the regular price of a Sale. */
function isStruck(node: AnyNode): boolean {
  if (node.type !== "tag") return false;

  return STRUCK_TAGS.has(node.name.toLowerCase()) || STRUCK_CLASS.test(classOf(node));
}

/**
 * An element a shop labels its deal with: a promotion sticker, a discount
 * badge, a price label. Recognised by the class a shop styles it with — the
 * closed vocabulary of markup, not of any language. What it says is the
 * deal's words, and a price inside it ("2 voor €5.50") is part of the words
 * and never the price charged.
 */
const DEAL_LABEL_CLASS = /promo|deal|discount|badge|sticker|price-?label/i;

function isDealLabel(node: AnyNode): boolean {
  return node.type === "tag" && DEAL_LABEL_CLASS.test(classOf(node));
}

/** Whether an element's text is not the price charged now: struck through, or a deal's words. */
function notThePrice(node: AnyNode): boolean {
  if (node.type !== "tag") return false;

  return NOT_THE_PRICE.has(node.name.toLowerCase()) || isStruck(node) || isDealLabel(node);
}

function textNodesOf(node: AnyNode): string[] {
  if (node.type === "text") return [node.data];
  if (notThePrice(node)) return [];
  if ("children" in node) return node.children.flatMap(textNodesOf);

  return [];
}

/** Whether an element sits under one whose text is not the price charged now. */
function insideNotThePrice($: cheerio.CheerioAPI, element: AnyNode, card: CheerioNode): boolean {
  return $(element)
    .parents()
    .toArray()
    .some((parent) => notThePrice(parent) && card.has(parent as never).length > 0);
}

/**
 * A card's text with a space between its pieces. Cheerio's `.text()` glues
 * sibling texts together, so `<span>x12</span><span>2,49 €</span>` reads as
 * `x122,49 €` and a dozen eggs cost a hundred and twenty euros.
 */
function spacedText(card: CheerioNode): string {
  return collapse(card.toArray().flatMap(textNodesOf).join(" "));
}

export function resolveUrl(candidate: unknown, pageUrl: string): string | null {
  const raw = readText(candidate);

  if (!raw) return null;
  try {
    const resolved = new URL(raw, pageUrl);

    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    resolved.hash = "";

    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * A pack size as a shopper reads it: a number and the shop's own word for it,
 * with whatever the shop adds in brackets after it — "1 kg (ca. 5 stuks)".
 */
const SIZE_SHAPE =
  /^(?:ca\.?\s*)?\d+(?:[.,]\d+)?\s*(?:[x×]\s*\d+(?:[.,]\d+)?\s*)?\p{L}{1,12}\.?(?:\s*\([^)]{0,40}\))?$/u;
/** A unit of sale with no number of packs: "per kg", "per 100 gram", "Per stuk". */
const PER_UNIT_SHAPE = /^(?:per|\/)\s*(?:\d+(?:[.,]\d+)?\s*)?\p{L}{1,12}\.?$/iu;

/** `12,34 zł` and `29.90 CHF` have the shape of a size and are prices; they are not sizes. */
function looksLikeSize(value: string): boolean {
  const trimmed = value.trim();

  return (
    (SIZE_SHAPE.test(trimmed) || PER_UNIT_SHAPE.test(trimmed)) && readPriceInText(trimmed) === null
  );
}

/** The shop's size words, and the Pack Size they state where the unit table can read them. */
interface SizeReading {
  size: string;
  pack: PackSize | null;
}

function sizeWords(words: string): SizeReading {
  const size = collapse(words);

  return { size, pack: readPackSize(size) };
}

function readSize(value: unknown): SizeReading | null {
  if (typeof value === "string") return looksLikeSize(value) ? sizeWords(value) : null;
  if (!isObject(value)) return null;
  const amount = readText(prop(value, "value") ?? prop(value, "amount"));

  if (!amount) return null;
  // A unit code is the surest reading there is; the words are made from it.
  const pack = packSizeFromCode(
    amount,
    readText(prop(value, "unitCode")) ?? readText(prop(value, "unitText"))
  );

  if (pack) return { size: collapse(`${amount} ${unitLabel(pack.unit)}`), pack };
  const unitText = readText(prop(value, "unitText"));

  if (unitText) return sizeWords(`${amount} ${unitText}`);

  // A size written as "1,5 l" with no unit beside it carries its unit in the text.
  return looksLikeSize(amount) ? sizeWords(amount) : null;
}

function sizeOf(node: Node): SizeReading | undefined {
  return (
    readSize(prop(node, "weight")) ??
    readSize(prop(node, "size")) ??
    readSize(prop(node, "netContent")) ??
    undefined
  );
}

/** The fields a size reading puts on a candidate or a product: the words, and the pack if read. */
function sized(reading: SizeReading | null | undefined) {
  if (!reading) return {};

  return { size: reading.size, ...(reading.pack ? { pack: reading.pack } : {}) };
}

interface OfferReading {
  price: number;
  currency: string | null;
}

function readOffer(offer: Node): OfferReading | null {
  const price = parsePriceText(prop(offer, "price")) ?? parsePriceText(prop(offer, "lowPrice"));

  if (price === null) return null;

  return { price, currency: currencyCode(prop(offer, "priceCurrency")) };
}

function offerOf(node: Node): OfferReading | null {
  return (
    asArray(prop(node, "offers") as Node | Node[])
      .filter(isObject)
      .map(readOffer)
      .find((reading) => reading !== null) ?? null
  );
}

/** Every node of any type in a JSON-LD document, however it is nested. */
function walk(root: unknown, visit: (node: Node) => void): void {
  if (Array.isArray(root)) {
    for (const child of root) walk(child, visit);

    return;
  }
  if (!isObject(root)) return;
  visit(root);
  for (const value of Object.values(root)) {
    if (value && typeof value === "object") walk(value, visit);
  }
}

function jsonLdNodes($: cheerio.CheerioAPI): Node[] {
  const nodes: Node[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      walk(parseJsonWithRepair($(element).html() || "{}"), (node) => nodes.push(node));
    } catch {
      // A malformed script is not a reading.
    }
  });

  return nodes;
}

function productCandidate(node: Node, pageUrl: string): StoreCandidate | null {
  const name = readText(prop(node, "name"));
  const url = resolveUrl(prop(node, "url"), pageUrl) ?? resolveUrl(prop(node, "@id"), pageUrl);

  if (!name || !url) return null;
  const offer = offerOf(node);

  return {
    name,
    url,
    ...(offer ? { price: offer.price } : {}),
    ...(offer?.currency ? { currency: offer.currency } : {}),
    ...sized(sizeOf(node)),
  };
}

/** The products a results page states outright, in the order it states them. */
function readJsonLdCandidates($: cheerio.CheerioAPI, pageUrl: string): StoreCandidate[] {
  const nodes = jsonLdNodes($);
  const found: StoreCandidate[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (!hasType(node, "Product", "IndividualProduct", "ProductModel")) continue;
    const candidate = productCandidate(node, pageUrl);

    if (!candidate || seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    found.push(candidate);
  }

  return found;
}

const NON_PAGE_PROTOCOL = /^(mailto:|tel:|javascript:|#)/i;

/** How many of a group's cards are looked at before the group is judged. */
const PRICED_SAMPLE = 6;

/** Whether a card states a price at all, however the shop happens to write it. */
function statesAPrice($: cheerio.CheerioAPI, card: CheerioNode): boolean {
  return (
    readPriceInText(cardLabels($, card)) !== null ||
    readPriceInText(spacedText(card)) !== null ||
    decimalInCard($, card) !== null ||
    priceFromDigitRun($, card) !== null
  );
}

/**
 * How many of a group's links have a price beside them, read off a sample and
 * scaled to the whole group. A menu of sections is priced nowhere and a shelf
 * is priced almost everywhere, so this separates the two without knowing
 * anything about either shop.
 */
function pricedLinks(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  group: Map<string, CheerioNode>
): number {
  const sample = [...group.entries()].slice(0, PRICED_SAMPLE);

  if (sample.length === 0) return 0;
  const priced = sample.filter(([url, element]) =>
    statesAPrice($, cardOf($, element, url, pageUrl))
  ).length;

  return Math.round((priced / sample.length) * group.size);
}

/**
 * The product anchors of a results page, found by the one thing every results
 * page has in common: it links to many pages of the same shape. Links are
 * grouped by how deep their path runs and what section it starts in, and the
 * shelf is the group with the most prices beside it.
 *
 * Prices rather than size, because size answers the wrong question: a shop
 * whose search found one product still puts its whole footer of sections on
 * the page, and the more exactly a shopper names what they want the more
 * certainly that footer outnumbers the shelf. A group nothing is priced in
 * falls back to the largest, which is a guess and is held to three links —
 * a lone link is indistinguishable from navigation.
 */
function productAnchorGroup(
  $: cheerio.CheerioAPI,
  pageUrl: string
): { url: string; element: CheerioNode }[] {
  const page = new URL(pageUrl);
  const groups = new Map<string, Map<string, CheerioNode>>();

  $("a[href]").each((_, element) => {
    const link = $(element) as unknown as CheerioNode;
    const href = ($(element).attr("href") ?? "").trim();

    if (!href || NON_PAGE_PROTOCOL.test(href)) return;
    const resolved = resolveUrl(href, pageUrl);

    if (!resolved) return;
    const target = new URL(resolved);

    if (target.hostname !== page.hostname) return;
    if (target.pathname === page.pathname) return;
    const segments = target.pathname.split("/").filter((part) => part !== "");

    if (segments.length < 2) return;
    const signature = `${segments.length}:${segments[0]?.toLowerCase() ?? ""}`;
    const group = groups.get(signature) ?? new Map<string, CheerioNode>();

    if (!group.has(target.href)) group.set(target.href, link);
    groups.set(signature, group);
  });

  const scored = [...groups.values()]
    .map((group) => ({ group, priced: pricedLinks($, pageUrl, group) }))
    .sort((a, b) => b.priced - a.priced || b.group.size - a.group.size);
  const shelf = scored[0]?.priced ? scored[0].group : null;
  const largest = [...groups.values()].sort((a, b) => b.size - a.size)[0] ?? null;
  const best = shelf ?? (largest && largest.size >= 3 ? largest : null);

  if (!best) return [];

  return [...best.entries()].map(([url, element]) => ({ url, element }));
}

/**
 * The smallest piece of the page that is about this product alone: the anchor
 * grown outwards while everything it links to is still the same product.
 */
function cardOf(
  $: cheerio.CheerioAPI,
  link: CheerioNode,
  url: string,
  pageUrl: string
): CheerioNode {
  let card = link;

  for (let step = 0; step < 6; step += 1) {
    const parent = card.parent() as unknown as CheerioNode;

    if (parent.length === 0 || (parent as unknown as CheerioNode).is("body, html")) break;
    const elsewhere = parent
      .find("a[href]")
      .toArray()
      .some((other) => {
        const href = ($(other).attr("href") ?? "").trim();

        // A card's own buttons — `href="#"`, `javascript:` — link nowhere else,
        // and neither does the same page with tracking on it.
        if (!href || NON_PAGE_PROTOCOL.test(href)) return false;
        const resolved = resolveUrl(href, pageUrl);

        return resolved !== null && withoutQuery(resolved) !== withoutQuery(url);
      });

    if (elsewhere) break;
    card = parent;
  }

  return card;
}

function cardTexts($: cheerio.CheerioAPI, card: CheerioNode): string[] {
  const texts: string[] = [];

  card.find("*").each((_, element) => {
    const node = $(element);

    if (node.children().length > 0) return;
    const value = collapse(node.text());

    if (value) texts.push(value);
  });

  return texts;
}

/**
 * A price a shop states as bare digits, its cents included: "799" beside a
 * card is 7.99 and "88" is 0.88 — the same rule, because a shop that styles
 * its euros and cents in separate elements is writing one number in two
 * pieces. The outermost run is the whole number; a run nested inside it is
 * only its cents.
 */
function priceFromDigitRun($: cheerio.CheerioAPI, card: CheerioNode): number | null {
  let longest = "";

  card.find("*").each((_, element) => {
    if (notThePrice(element) || insideNotThePrice($, element, card)) return;
    const value = collapse($(element).text());

    if (!/^\d{2,6}$/.test(value) || value.length <= longest.length) return;
    // "500" inside "500 g" is a pack size, not five euros. A run whose
    // surroundings read as a size is left alone.
    if (looksLikeSize(collapse($(element).parent().text()))) return;
    longest = value;
  });

  return longest ? Number(longest) / 100 : null;
}

/**
 * A price a card states as a bare decimal, `2,99` or `7.49`, with no mark
 * beside it. Read before the digit run: where a card holds one of these, the
 * digit run would read its review count or its pack size instead.
 */
function decimalInCard($: cheerio.CheerioAPI, card: CheerioNode): number | null {
  let found: number | null = null;

  card.find("*").each((_, element) => {
    if (found !== null) return;
    const node = $(element);

    if (node.children().length > 0) return;
    if (notThePrice(element) || insideNotThePrice($, element, card)) return;
    const value = collapse(node.text());

    if (!/^\d{1,4}[.,]\d{2}$/.test(value)) return;
    if (looksLikeSize(collapse(node.parent().text()))) return;
    found = parsePriceText(value);
  });

  return found;
}

/**
 * The prices a card shows struck through: what the shop charged before the
 * Sale, in a `del` or under a class that says so — Dirk's "van 2.65", Albert
 * Heijn's old price with a line through it. Read with a mark or as a bare
 * decimal, since a struck price is written the way the price beside it is.
 */
function struckPrices($: cheerio.CheerioAPI, card: CheerioNode): number[] {
  const found: number[] = [];

  card.find("*").each((_, element) => {
    if (!isStruck(element)) return;
    const text = collapse($(element).text());
    const marked = readPriceInText(text)?.price;
    const bare = text.match(/(?<![\d.,])\d{1,4}[.,]\d{2}(?![\d])/)?.[0];
    const price = marked ?? (bare ? parsePriceText(bare) : null);

    if (price !== null && price !== undefined) found.push(price);
  });

  return found;
}

/**
 * The words of a card's deal label, read by its own accessible label where
 * it has one, else by its innermost words with the struck price beside them
 * left out. Words that are only a number are a price, not a deal.
 */
function dealWordsOf($: cheerio.CheerioAPI, card: CheerioNode): string | undefined {
  const labelled = card.find("*").toArray().filter(isDealLabel);

  if (labelled.length === 0) return undefined;
  const isWords = (value: string) => value.length > 0 && !/^[\d.,\s€£$]+$/.test(value);
  const aria = labelled
    .map((element) => collapse($(element).attr("aria-label") ?? ""))
    .find(isWords);

  if (aria) return aria;
  const innermost = labelled.filter((element) => !$(element).find("*").toArray().some(isDealLabel));
  const ownText = (element: AnyNode) =>
    collapse(
      ("children" in element ? element.children : [])
        .flatMap((child) => (isStruck(child) ? [] : textNodesOfWords(child)))
        .join(" ")
    );

  return innermost.map(ownText).find(isWords);
}

/** The text of a deal label itself, which is not the price and so is not what `textNodesOf` reads. */
function textNodesOfWords(node: AnyNode): string[] {
  if (node.type === "text") return [node.data];
  if (node.type === "tag" && (NOT_THE_PRICE.has(node.name.toLowerCase()) || isStruck(node))) {
    return [];
  }
  if ("children" in node) return node.children.flatMap(textNodesOfWords);

  return [];
}

/** What a card presents as its Sale: the regular price above its price, and the deal's words. */
interface SaleReading {
  regularPrice?: number;
  dealWords?: string;
}

/**
 * The price a card charges now and the regular price it shows beside it. A
 * regular price is what the shop struck through; where nothing is struck,
 * a label that states a higher price before a lower one — "Van €4.38 Voor
 * €3.50" — is read the same way. A price read from a label that turns out
 * to be the struck one is not the price charged: the lower one after it is.
 */
function saleOf(
  $: cheerio.CheerioAPI,
  card: CheerioNode,
  label: string,
  price: number
): { price: number; sale: SaleReading } {
  const labelPrices = readPricesInText(label)
    .filter((reading) => !reading.perUnit)
    .map((reading) => reading.price);
  const struck = struckPrices($, card);
  let regular: number | null = struck.length > 0 ? Math.max(...struck) : null;
  const first = labelPrices[0];
  const second = labelPrices[1];

  if (regular === null && first !== undefined && second !== undefined && first > second) {
    regular = first;
  }
  let charged = price;

  if (regular !== null && charged === regular) {
    charged = labelPrices.find((value) => value < regular) ?? price;
  }
  const regularPrice = saleRegularPrice(charged, regular);
  const dealWords = dealWordsOf($, card);

  return {
    price: charged,
    sale: {
      ...(regularPrice !== null ? { regularPrice } : {}),
      ...(dealWords ? { dealWords } : {}),
    },
  };
}

function cardLabels($: cheerio.CheerioAPI, card: CheerioNode): string {
  const labels: string[] = [];
  const own = card.attr("aria-label");

  if (own) labels.push(own);
  card.find("[aria-label], [title]").each((_, element) => {
    const node = $(element);

    labels.push(node.attr("aria-label") ?? "", node.attr("title") ?? "");
  });

  return labels.filter(Boolean).join(" • ");
}

/** What a card calls the product: the link's own words, else the picture beside it. */
function cardName(
  $: cheerio.CheerioAPI,
  card: CheerioNode,
  link: CheerioNode,
  label: string
): string | null {
  const fromImage = card.find("img[alt]").first().attr("alt");
  const fromLabel = label.split(/[,•]/)[0];
  // An anchor wrapped around the whole card says everything the card says,
  // price and size included; its heading says what the product is called.
  const fromHeading = link.find("h1, h2, h3, h4, h5, h6, [itemprop='name']").first().text();
  const candidates = [
    collapse(fromHeading),
    collapse(link.text()),
    collapse(fromImage ?? ""),
    collapse(link.attr("title") ?? ""),
    collapse(fromLabel ?? ""),
  ];

  return candidates.find((value) => value.length >= 2) ?? null;
}

/**
 * The size beside the price, as the shop words it: in the label before the
 * price, else in the card's own text, else the unit of sale the price itself
 * was stated per.
 */
function cardSize(texts: string[], label: string, perUnit: string | undefined): string | undefined {
  const beforePrice = label.match(/([\p{L}\d][\p{L}\d.,\s]{0,20}?)\s*(?:€|£|\$|₽|₩|zł)\s?\d/u)?.[1];

  if (beforePrice) {
    const words = collapse(beforePrice).split(/[,•]/);
    const last = words[words.length - 1]?.trim() ?? "";

    if (looksLikeSize(last)) return last;
  }

  return texts.find((value) => looksLikeSize(value) && !/^\d+$/.test(value)) ?? perUnit;
}

/**
 * The anchors pointing at addresses the page already named as products. When
 * the page states its shelf outright there is nothing to infer: those are the
 * products, however few of them there are.
 */
function withoutQuery(url: string): string {
  const at = url.indexOf("?");

  return at < 0 ? url : url.slice(0, at);
}

function anchorsForUrls(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  wanted: Set<string>
): { url: string; element: CheerioNode }[] {
  const found = new Map<string, CheerioNode>();
  // The page's data names the product page; its anchors may carry a `?ref=`
  // the data does not. The page is the same page either way.
  const byPath = new Map([...wanted].map((url) => [withoutQuery(url), url] as const));

  $("a[href]").each((_, element) => {
    const resolved = resolveUrl($(element).attr("href"), pageUrl);

    if (!resolved) return;
    const url = wanted.has(resolved) ? resolved : byPath.get(withoutQuery(resolved));

    if (!url || found.has(url)) return;
    found.set(url, $(element) as unknown as CheerioNode);
  });

  return [...found.entries()].map(([url, element]) => ({ url, element }));
}

function readDomCandidates(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  anchors: { url: string; element: CheerioNode }[],
  fallbackCurrency: string | null
): StoreCandidate[] {
  return anchors
    .map(({ url, element }) => {
      const card = cardOf($, element, url, pageUrl);
      const label = cardLabels($, card);
      const texts = cardTexts($, card);
      const name = cardName($, card, element, label);

      if (!name) return null;
      const marked =
        readPriceInText(label, fallbackCurrency) ??
        readPriceInText(spacedText(card), fallbackCurrency);
      // A price per kilo is the card's price only where the card states no
      // pack price at all — not even as bare digits, which is how a shop
      // that prints "€ 19,93 / kg" beside them styles its pack price.
      const unmarked =
        marked === null || marked.perUnit
          ? (decimalInCard($, card) ?? priceFromDigitRun($, card))
          : null;
      const money = marked && (!marked.perUnit || unmarked === null) ? marked : null;
      const price = money?.price ?? unmarked;

      if (price === undefined || price === null) return { name, url } satisfies StoreCandidate;
      const currency = marked?.currency ?? fallbackCurrency;
      const size = cardSize(texts, label, money?.perUnit);
      const { price: charged, sale } = saleOf($, card, label, price);

      return {
        name,
        url,
        price: charged,
        ...(currency ? { currency } : {}),
        ...sized(size ? sizeWords(size) : null),
        ...sale,
      } satisfies StoreCandidate;
    })
    .filter((candidate): candidate is StoreCandidate => candidate !== null);
}

/**
 * The products a results page offers. What the page states outright comes
 * first and is complete; the DOM pass beside it carries the prices, which on
 * a shop like Dirk is five sixths of the shelf (ADR-0028).
 */
export function readSearchResults(html: string, baseUrl: string): StoreCandidate[] {
  if (!html.trim()) return [];
  const $ = cheerio.load(html);
  const stated = readJsonLdCandidates($, baseUrl);
  const merged = new Map<string, StoreCandidate>();
  // What the page charges in, for a card that states a number and no mark: a
  // mark stated anywhere on the page, else what the shop's address implies.
  const tldCurrency = currencyForUrl(baseUrl);
  const pageCurrency =
    readPriceInText(spacedText($("body") as unknown as CheerioNode), tldCurrency)?.currency ??
    tldCurrency;

  for (const candidate of stated) merged.set(candidate.url, candidate);
  // A page that names its products needs no guessing about which links they
  // are — which is the only way a result set of one or two is readable at all,
  // since a lone link is indistinguishable from navigation.
  const anchors =
    stated.length > 0
      ? anchorsForUrls($, baseUrl, new Set(stated.map((candidate) => candidate.url)))
      : productAnchorGroup($, baseUrl);

  for (const candidate of readDomCandidates($, baseUrl, anchors, pageCurrency)) {
    const existing = merged.get(candidate.url);

    if (!existing) {
      merged.set(candidate.url, candidate);
      continue;
    }
    const charged = existing.price ?? candidate.price;

    merged.set(candidate.url, {
      ...existing,
      price: charged,
      currency: existing.currency ?? candidate.currency,
      ...sized(existing.size ? { size: existing.size, pack: existing.pack ?? null } : null),
      ...(existing.size
        ? {}
        : sized(candidate.size ? { size: candidate.size, pack: candidate.pack ?? null } : null)),
      // A Sale is what the card presents; the data states no regular price.
      ...(charged !== undefined && saleRegularPrice(charged, candidate.regularPrice) !== null
        ? { regularPrice: candidate.regularPrice }
        : {}),
      ...(candidate.dealWords ? { dealWords: candidate.dealWords } : {}),
    });
  }

  return [...merged.values()].map((candidate) => ({
    ...candidate,
    ...(candidate.price !== undefined && !candidate.currency
      ? { currency: pageCurrency ?? undefined }
      : {}),
  }));
}

/**
 * A store that names its product after the page title, "Halfvolle melk
 * bestellen | Albert Heijn", is read without the site's own name behind the
 * bar: the product is the part before it.
 */
function withoutSiteSuffix(name: string, title: string): string {
  if (!title || name !== title) return name;
  const bar = name.lastIndexOf(" | ");

  return bar > 0 ? name.slice(0, bar).trim() : name;
}

/**
 * A page whose data names the product for search engines while its heading
 * names it for people is read by its heading.
 */
function byPageHeading(name: string, heading: string): string {
  if (!heading || heading.length >= name.length) return name;

  return name.toLowerCase().startsWith(heading.toLowerCase()) ? heading : name;
}

/** The part of a product page that is about the product: the heading's neighbourhood. */
function nearHeading($: cheerio.CheerioAPI, found: (scope: CheerioNode) => boolean): void {
  const heading = $("h1").first();

  if (heading.length === 0) return;
  let scope = heading.parent() as unknown as CheerioNode;

  for (let step = 0; step < 3 && scope.length > 0; step += 1) {
    if (found(scope)) return;
    scope = scope.parent() as unknown as CheerioNode;
  }
}

/** The pack size a product page states beside its heading, when its data states none. */
function sizeNearHeading($: cheerio.CheerioAPI): SizeReading | undefined {
  let reading: SizeReading | undefined;

  nearHeading($, (scope) => {
    const found = scope
      .find("*")
      .toArray()
      .map((element) => collapse($(element).text()))
      .find((value) => looksLikeSize(value));

    if (found) reading = sizeWords(found);

    return reading !== undefined;
  });

  return reading;
}

/**
 * The Sale a product page presents beside its heading: a struck regular
 * price above the price, and the shop's words for the deal. A page's data
 * states neither, so this is read from what the page shows a shopper.
 */
function saleNearHeading($: cheerio.CheerioAPI, price: number): SaleReading {
  let sale: SaleReading = {};

  nearHeading($, (scope) => {
    const struck = struckPrices($, scope);
    const regularPrice = struck.length > 0 ? saleRegularPrice(price, Math.max(...struck)) : null;
    const dealWords = dealWordsOf($, scope);

    sale = {
      ...(regularPrice !== null ? { regularPrice } : {}),
      ...(dealWords ? { dealWords } : {}),
    };

    return regularPrice !== null || dealWords !== undefined;
  });

  return sale;
}

function microdataValue($: cheerio.CheerioAPI, scope: CheerioNode, name: string): string | null {
  const element = scope.find(`[itemprop="${name}"]`).first();

  if (element.length === 0) return null;
  const content = element.attr("content") ?? element.attr("href");

  return collapse(content ?? element.text()) || null;
}

function readMicrodataProduct($: cheerio.CheerioAPI): { name: string; money: string } | null {
  const scope = $('[itemscope][itemtype*="schema.org/Product"]').first() as unknown as
    CheerioNode | undefined;

  if (!scope || scope.length === 0) return null;
  const name = microdataValue($, scope, "name");
  const price = microdataValue($, scope, "price");
  const currency = microdataValue($, scope, "priceCurrency");

  if (!name || !price) return null;

  return { name, money: `${price} ${currency ?? ""}` };
}

/**
 * The authoritative Shelf Price: what one product page states about the one
 * product it is about.
 */
export function readProduct(html: string, url: string): ProductReading | null {
  if (!html.trim()) return null;
  const $ = cheerio.load(html);
  const title = collapse($("title").first().text());
  const heading = collapse($("h1").first().text());
  const fallbackCurrency = currencyForUrl(url);

  /**
   * One reading, however the page happened to state it: named for people
   * rather than for search engines, sized by whatever the page says, and
   * refused outright without a currency — a price without one is not a
   * reading.
   */
  const reading = (
    name: string | null,
    price: number | null,
    currency: string | null,
    size: SizeReading | undefined
  ): ProductReading | null => {
    const named = name ? byPageHeading(withoutSiteSuffix(name, title), heading) : "";
    const inCurrency = currency ?? fallbackCurrency;

    if (!named || price === null || !inCurrency) return null;

    return {
      name: named,
      price,
      currency: inCurrency,
      ...sized(size ?? sizeNearHeading($)),
      ...saleNearHeading($, price),
    };
  };

  // A product page often lists related products in the same data. The one
  // this page is about is the one whose address is this page's; the first
  // priced product is only what is left when none says.
  const products = jsonLdNodes($)
    .filter((node) => hasType(node, "Product", "IndividualProduct", "ProductModel"))
    .map((node) => ({ node, offer: offerOf(node) }))
    .filter((entry) => entry.offer !== null);
  const own = products.find(
    ({ node }) => withoutQuery(resolveUrl(prop(node, "url"), url) ?? "") === withoutQuery(url)
  );
  const pageCurrency = readPriceInText(
    spacedText($("body") as unknown as CheerioNode),
    fallbackCurrency
  )?.currency;

  for (const { node, offer } of own ? [own, ...products.filter((p) => p !== own)] : products) {
    if (!offer) continue;
    const found = reading(
      readText(prop(node, "name")),
      offer.price,
      offer.currency ?? pageCurrency ?? null,
      sizeOf(node)
    );

    if (found) return found;
  }

  const microdata = readMicrodataProduct($);

  if (microdata) {
    const money = readPriceInText(microdata.money, fallbackCurrency);
    const found = reading(
      microdata.name,
      money?.price ?? parsePriceText(microdata.money),
      money?.currency ?? null,
      undefined
    );

    if (found) return found;
  }

  const metaPrice =
    $('meta[property="product:price:amount"]').attr("content") ??
    $('meta[property="og:price:amount"]').attr("content");
  const metaCurrency =
    $('meta[property="product:price:currency"]').attr("content") ??
    $('meta[property="og:price:currency"]').attr("content");

  return reading(
    heading || title,
    parsePriceText(metaPrice),
    currencyCode(metaCurrency),
    undefined
  );
}
