import * as cheerio from "cheerio";

import { MeasurementSystem } from "@norish/shared/contracts/dto/recipe";

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

export function extractSanitizedBody(html: string): string {
  // Check if input looks like HTML (has tags) or is plain text
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(html);

  if (!hasHtmlTags) {
    // Plain text input - just clean up whitespace and return
    return html.replace(/\s+/g, " ").trim();
  }

  try {
    const $ = cheerio.load(html);
    const $body = $("body");

    if (!$body.length) {
      return html.replace(/\s+/g, " ").trim();
    }

    // Remove obvious non-content
    $body
      .find(
        `
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
    `
      )
      .remove();

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
    const $root = $body.find("main").first().length
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
