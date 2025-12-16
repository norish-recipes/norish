import { MeasurementSystem } from "@/types/dto/recipe";
import * as cheerio from "cheerio";

export function normalizeIngredient(i: any, system: MeasurementSystem) {
  return {
    ingredientId: null,
    ingredientName: String(i.ingredientName || "").trim(),
    order: i.order ?? 0,
    amount: i.amount == null ? null : Number(i.amount),
    unit: i.unit ? String(i.unit).trim() : null,
    systemUsed: system,
  };
}

export function normalizeStep(s: any, system: MeasurementSystem) {
  return {
    step: String(s.step || "").trim(),
    order: s.order ?? 0,
    systemUsed: system,
  };
}

export function extractImageCandidates(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[property="og:image:url"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content");

  if (ogImage) {
    urls.add(ogImage);
    return [...urls];
  }

  const candidates: {
    src: string;
    score: number;
  }[] = [];

  $("img[src]").each((i, el) => {
    const src = $(el).attr("src");
    if (!src) return;

    if (src.endsWith(".svg")) return;
    if (src.startsWith("data:")) return;

    const alt = ($(el).attr("alt") || "").toLowerCase();

    const width = Number($(el).attr("width")) || 0;
    const height = Number($(el).attr("height")) || 0;
    const area = width * height;

    let score = area;

    if (alt.length > 10) score += 5_000;
    if (i < 5) score += 10_000;

    if (alt.includes("logo")) score -= 50_000;
    if (alt.includes("icon")) score -= 50_000;
    if (alt.includes("social")) score -= 50_000;

    candidates.push({ src, score });
  });

  candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .forEach(c => urls.add(c.src));

  return [...urls];
}

export function extractSanitizedBody(html: string): string {
  try {
    const $ = cheerio.load(html);
    const $body = $("body");
    if (!$body.length) return "";

    // Remove obvious non-content
    $body.find(`
      script,
      style,
      noscript,
      svg,
      iframe,
      canvas,
      link,
      meta,
      header,
      footer,
      nav,
      aside,
      form,
      button,
      input,
      textarea
    `).remove();

    const blocks: string[] = [];
    const seen = new Set<string>();

    const push = (text?: string) => {
      if (!text) return;
      const t = text.replace(/\s+/g, " ").trim();

      if (t.length < 2) return;
      if (seen.has(t)) return;

      seen.add(t);
      blocks.push(t);
    };

    // Prefer main/article if present
    const $root =
      $body.find("main").first().length
        ? $body.find("main").first()
        : $body.find("article").first().length
          ? $body.find("article").first()
          : $body;

    // Title
    const title =
      $root.find('h1[itemprop="name"]').first().text().trim() ||
      $root.find("h1").first().text().trim();

    if (title) push(title);

    const selectors = "h2,h3,h4,h5,h6,p,li,dt,dd,figcaption";

    $root.find(selectors).each((_, el) => {
      push($(el).text());
    });

    return blocks.join("\n");
  } catch {
    return "";
  }
}